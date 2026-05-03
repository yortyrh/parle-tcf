/**
 * Shared helpers for TEF vision pipelines (instructions vs conseils).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export const CONFIG_DIR = join(__dirname, "../config");
export const TEF_ROOT = join(CONFIG_DIR, "tef-exercices");

export const STANDARD_PNG = /^TEF-(A|B)-(\d{2})\.png$/i;

/** Prepended to every `*.instructions.md` before `EXERCICE À UTILISER:` (per-section, editable). */
const PREAMBLE_FILENAME = "_instructions-preamble.md";

/** Inserted between optional preamble and the exercise-specific body. */
export const EXERCICE_HEADING = "EXERCICE À UTILISER:";

const COMPLETION_TOKEN_BUDGET = 4096;

export function completionTokenParams(
  model: string,
): { max_tokens: number } | { max_completion_tokens: number } {
  const m = model.toLowerCase();
  if (
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4")
  ) {
    return { max_completion_tokens: COMPLETION_TOKEN_BUDGET };
  }
  return { max_tokens: COMPLETION_TOKEN_BUDGET };
}

export interface TefGenCliOptions {
  force: boolean;
  only: Set<string> | null;
  model: string;
  stub: boolean;
}

export function parseTefGenCliArgs(argv: string[]): TefGenCliOptions {
  let force = false;
  let stub = false;
  let model = "gpt-5.4-mini";
  const only = new Set<string>();
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--force") force = true;
    else if (a === "--stub") stub = true;
    else if (a === "--model" && argv[i + 1]) {
      model = argv[++i]!;
    } else if (a === "--only") {
      i++;
      while (i < argv.length && !argv[i]!.startsWith("--")) {
        only.add(argv[i]!.toUpperCase().replace(/\.PNG$/i, ".png"));
        i++;
      }
      continue;
    }
    i++;
  }
  return {
    force,
    only: only.size > 0 ? only : null,
    model,
    stub,
  };
}

const instructionsPreambleCache: Partial<Record<"A" | "B", string>> = {};

/** Shared prefix from `TEF-{A|B}/_instructions-preamble.md` (trimmed). */
export function getInstructionsPreamble(section: "A" | "B"): string {
  if (instructionsPreambleCache[section] !== undefined) {
    return instructionsPreambleCache[section]!;
  }
  const path = join(TEF_ROOT, `TEF-${section}`, PREAMBLE_FILENAME);
  let text = "";
  if (existsSync(path)) {
    text = readFileSync(path, "utf-8").trim();
  }
  instructionsPreambleCache[section] = text;
  return text;
}

/** Warm the preamble cache (call before batches so edits mid-run are not seen). */
export function primeInstructionsPreambleCache(section: "A" | "B"): void {
  getInstructionsPreamble(section);
}

/** Full Realtime system prompt for one exercise (agent only — no candidate guide). */
export function wrapInstructionsPrompt(
  exerciseMarkdown: string,
  section: "A" | "B",
): string {
  const preamble = getInstructionsPreamble(section);
  const pre = preamble.length > 0 ? `${preamble}\n\n` : "";
  return `${pre}${EXERCICE_HEADING}\n${exerciseMarkdown.trim()}`;
}

export function stubExerciseFragment(id: string, section: "A" | "B"): string {
  const intro =
    section === "A"
      ? "Le candidat téléphone pour obtenir des informations. Tu décroches au téléphone."
      : "Le candidat te présente une annonce pour te convaincre. Tu es son ami / sa amie ; tu ne connais pas l’annonce au départ.";
  return `# ${id} — (à compléter)

> **Brouillon** : exécutez \`pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --force\` (avec \`OPENAI_API_KEY\`) pour remplir l’exercice à partir de l’image.

## Rôle
${intro}

## Contexte de l’annonce
(À générer depuis l’image — voir \`config/tef-exercices/TEF-${section}/${id}.png\`.)

## Informations que le personnage connaît
- (À compléter : tarifs, horaires, lieux, conditions visibles sur l’annonce.)

## Consigne du candidat
(À compléter : consigne officielle visible sur l’image.)
`;
}

export function stubConseilsMarkdown(id: string, section: "A" | "B"): string {
  return `# Guide de préparation (${id})

> **Brouillon** : exécutez \`pnpm --filter @yorty-tcf/api run generate-tef-conseils -- --force\` (avec \`OPENAI_API_KEY\`) à partir de \`config/tef-exercices/TEF-${section}/${id}.png\`.
`;
}

export function listStandardPngs(section: "A" | "B"): string[] {
  const dir = join(TEF_ROOT, `TEF-${section}`);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => STANDARD_PNG.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const SECTION_CONTEXT: Record<"A" | "B", string> = {
  A: `Section A — le candidat téléphone pour obtenir des informations sur l'annonce (conversation téléphonique). L'agent joue la personne qui décroche.`,
  B: `Section B — le candidat présente l'annonce à un(e) ami(e) et tente de le/la convaincre. L'agent joue l'ami(e) qui ne connaît pas l'annonce au départ.`,
};

export async function generateExerciseFragmentForImage(
  client: OpenAI,
  section: "A" | "B",
  filename: string,
  model: string,
): Promise<string> {
  const imagePath = join(TEF_ROOT, `TEF-${section}`, filename);
  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString("base64");
  const mimeType = "image/png";
  const baseId = basename(filename, ".png");

  const userPrompt = `Tu analyses une image d'exercice du TEF Canada (Expression Orale), ${SECTION_CONTEXT[section]}.

Lis attentivement TOUT le texte visible sur l'image (annonce, consigne officielle du candidat, détails).

Produis un fichier markdown en français qui sera inséré dans le bloc « EXERCICE À UTILISER » d'un prompt système complet. Donne UNIQUEMENT le contenu spécifique à CET exercice (comportement examen général est déjà fourni ailleurs).

Structure EXACTE (titres en français, contenu riche et factuel) :

# ${baseId} — [titre court de l'annonce]

## Rôle
[Une ou deux phrases : qui est l'agent, dans quel contexte il/elle répond.]

## Contexte de l'annonce
[Paragraphe(s) : résumer fidèlement le contenu de l'annonce visible sur l'image.]

## Informations que le personnage connaît
[Liste à puces : faits précis (tarifs, horaires, lieux, conditions) que l'agent peut donner SI le candidat les demande — pour la section B, c'est ce que l'ami peut découvrir au fil de la conversation si le candidat les mentionne ; ne pas tout dévoiler d'emblée côté ami.]

## Consigne du candidat
[Reprendre ou paraphraser la consigne officielle visible sur l'image pour le candidat.]

Règles :
- Ne pas mentionner « IA », « examen », « TEF » dans le contenu du markdown (c'est pour le moteur, pas pour le candidat).
- Rester factuel par rapport à l'image ; si un détail est illisible, indique « (illisible sur le scan) ».
${
  section === "A"
    ? `- Section A : dans « Informations que le personnage connaît », pour les détails absents ou illisibles sur l'image, liste ce que le personnage **peut quand même préciser au téléphone** (réponses courtes, cohérentes avec l'offre) : horaires plausibles, tarif indicatif, modalités d'inscription, etc. **Ne jamais** formuler une consigne du type « dire que ce n'est pas sur l'annonce », « renvoyer au site », « dire d'appeler un autre numéro » ou « refuser l'info » : l'oral doit rester fluide. Tu peux marquer « (illisible sur le scan) » pour ce que le **candidat** ne lit pas sur l'image, mais complète toujours par **ce que l'agent peut répondre en scène** si on l'interroge.\n`
    : ""
}- Réponds UNIQUEMENT avec le markdown, sans bloc de code, sans préambule.`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high",
            },
          },
          { type: "text", text: userPrompt },
        ],
      },
    ],
    ...completionTokenParams(model),
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty model response");

  let md = content.replace(/^```markdown\n?/i, "").replace(/^```\n?/, "");
  md = md.replace(/\n?```$/i, "").trim();
  return md;
}

const GUIDE_TOKEN_BUDGET = 4096;

export async function generatePracticeGuideForImage(
  client: OpenAI,
  section: "A" | "B",
  filename: string,
  model: string,
): Promise<string> {
  const imagePath = join(TEF_ROOT, `TEF-${section}`, filename);
  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString("base64");

  const sectionPrompt =
    section === "A"
      ? `L'exercice est une **prise de renseignements téléphoniques** : le candidat voit l'annonce et doit appeler pour obtenir des informations. Génère un guide de préparation en **trois sections ## exactement** :

## Présentation de l'appel
Donne **deux options** (libellées **Option 1** et **Option 2**) pour commencer l'appel. Chaque option est une phrase complète, naturelle, **spécifique au sujet de cette annonce** (nomme clairement le service / l'activité / le produit affiché). Pas de crochets ni de textes génériques.

## Questions à poser
Liste **15 questions numérotées** (1 à 15), interrogatives et complètes, **spécifiques au contenu de cette annonce** (utilise les détails, le lieu, les tarifs, l'activité, le public cible réels visibles). Les questions doivent être variées (tarif, horaires, lieu, modalités, public, matériel, durée, inscription, annulation, etc.). Pas de crochets ni de placeholders.

## Prendre congé
Donne **deux options** (libellées **Option 1** et **Option 2**) pour terminer l'appel poliment. Phrases complètes, ton naturel pour un appel de renseignements. Pas de crochets.`
      : `L'exercice est une **présentation d'une annonce à un·e ami·e** pour le/la convaincre. Génère un **guide de préparation pour l'étudiant** en **deux sections ## exactement** :

## Introduction
Donne **deux variantes** (libellées **Variante 1** et **Variante 2**) pour débuter la conversation avec l'ami·e. Chaque variante fait **3 à 4 phrases**, est naturelle, **spécifique au sujet de cette annonce** (nomme l'activité / le service / le produit réel). Plante bien la situation : comment on a découvert l'annonce, pourquoi ça a attiré l'attention, un détail concret qui donne envie. Ton entre amis, chaleureux. Pas de crochets ni de placeholders.

## Arguments et réponses aux objections
Liste numérotée **unique** de **7 éléments**. C'est un **guide de préparation**, pas un script de dialogue. Pas de labels comme « Objection possible » ou « Comment répondre ». Chaque élément a un titre en gras suivi directement du texte de l'argument.

**Éléments 1 à 3 — Arguments généraux proactifs.** Ce sont des arguments que l'étudiant peut utiliser de lui-même pour convaincre son ami·e.
- Titre : **Argument général** (le numéro est déjà fourni par la liste numérotée, ne pas le répéter dans le titre en gras)
- Texte : **3 à 4 phrases développées**, concrètes, spécifiques à l'annonce (vrais détails : lieu, prix, activité, avantages…). Couvre trois angles différents : valeur/prix, expérience/originalité, praticité/logistique.

**Éléments 4 à 7 — Réponses aux contre-arguments.** Ce sont des réponses à des objections réalistes que l'ami·e pourrait soulever.
- Titre : un mot-clé décrivant le thème de l'objection (ex. **Le prix**, **Le froid**, **Le danger**, **Le manque d'intérêt** — le numéro est déjà fourni par la liste numérotée, ne pas le répéter dans le titre). Pense aux vraies réticences qu'un·e ami·e aurait face à CETTE annonce précise (coût, météo, danger, éloignement, manque d'intérêt, contraintes pratiques…).
- Texte : **4 à 5 phrases** structurées ainsi, directement (sans labels) :
  (a) reconnaître franchement la préoccupation (« C'est vrai que… », « Je comprends que… ») ;
  (b) développer une explication qui met en perspective pourquoi ça ne devrait pas bloquer ;
  (c) ajouter une précision concrète tirée de l'annonce (chiffre, caractéristique, service inclus…) ;
  (d) conclure sur la conséquence positive : le bénéfice concret qu'on en tire, pour relancer l'envie.

Les 4 contre-arguments (éléments 4-7) doivent couvrir des angles **variés et réalistes** liés au thème précis de l'annonce. Ne pas rester générique. Pas de crochets ni de placeholders.`;

  const userPrompt = `Tu analyses une image d'exercice du TEF Canada (Expression Orale), Section ${section}.

Lis attentivement le contenu de l'annonce visible sur l'image.

${sectionPrompt}

Règles générales :
- Rédigé entièrement en français.
- Pas de crochets, pas de texte générique type "[le service]" ou "[votre annonce]" : utilise les **vrais mots** tirés de l'annonce.
- Réponds UNIQUEMENT avec le markdown demandé, sans préambule ni bloc de code.`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: "high",
            },
          },
          { type: "text", text: userPrompt },
        ],
      },
    ],
    ...(model.toLowerCase().startsWith("o1") ||
    model.toLowerCase().startsWith("o3") ||
    model.toLowerCase().startsWith("o4") ||
    model.toLowerCase().startsWith("gpt-5")
      ? { max_completion_tokens: GUIDE_TOKEN_BUDGET }
      : { max_tokens: GUIDE_TOKEN_BUDGET }),
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty guide response");

  let md = content.replace(/^```markdown\n?/i, "").replace(/^```\n?/, "");
  md = md.replace(/\n?```$/i, "").trim();
  return md;
}

export function pathForInstructions(section: "A" | "B", baseWithoutExt: string) {
  return join(TEF_ROOT, `TEF-${section}`, `${baseWithoutExt}.instructions.md`);
}

export function pathForConseils(section: "A" | "B", baseWithoutExt: string) {
  return join(TEF_ROOT, `TEF-${section}`, `${baseWithoutExt}.conseils.md`);
}
