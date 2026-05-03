/**
 * Shared helpers for TEF vision pipelines (instructions vs conseils).
 * Instruction files are Realtime **text-only** system prompts; vision is used only when generating them.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export const CONFIG_DIR = join(__dirname, "../config");
export const TEF_ROOT = join(CONFIG_DIR, "tef-exercices");

export const STANDARD_PNG = /^TEF-(A|B)-(\d{2})\.png$/i;

/** Question unique envoyée au modèle (avec l’image) pour produire le prompt Realtime. */
export const TEF_INSTRUCTIONS_META_QUESTION =
  "Quel est le meilleur prompt pour indiquer à OpenAI Realtime de se dérouler comme l'évaluateur qui évalue l'étudiante dans le cadre de cet exercice?";

const COMPLETION_TOKEN_BUDGET = 4096;

/** Budget sortie pour la génération d’instructions (prompt système potentiellement long). */
const TEF_INSTRUCTIONS_MAX_OUTPUT_TOKENS = 16_384;

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
  let model = "gpt-5.5";
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

export function stubExerciseFragment(id: string, section: "A" | "B"): string {
  return `# ${id} — brouillon

Exécutez \`pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --force\` (avec \`OPENAI_API_KEY\`) pour générer les instructions depuis \`config/tef-exercices/TEF-${section}/${id}.png\`.
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

export function parseTefInstructionsStructuredOutput(outputText: string): string {
  const trimmed = outputText.trim();
  const tryParse = (s: string): string => {
    const data = JSON.parse(s) as { prompt?: unknown };
    if (typeof data.prompt !== "string" || !data.prompt.trim()) {
      throw new Error('Réponse JSON invalide : champ "prompt" manquant ou vide');
    }
    return data.prompt.trim();
  };

  try {
    return tryParse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      return tryParse(fence[1].trim());
    }
    throw new Error(
      "Impossible d’extraire le JSON : sortie du modèle inattendue (voir logs).",
    );
  }
}

/**
 * Génère le markdown complet des instructions Realtime pour une fiche TEF (image PNG).
 * Utilise l’API Responses (gpt-5.5 + effort medium conseillé), sortie JSON strict → champ `prompt`.
 */
export async function generateTefInstructionsForImage(
  client: OpenAI,
  section: "A" | "B",
  filename: string,
  model: string,
): Promise<string> {
  const imagePath = join(TEF_ROOT, `TEF-${section}`, filename);
  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString("base64");
  const mimeType = "image/png";
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const useReasoning =
    model.toLowerCase().startsWith("gpt-5.") ||
    model.toLowerCase().startsWith("o1") ||
    model.toLowerCase().startsWith("o3") ||
    model.toLowerCase().startsWith("o4");

  const response = await client.responses.create({
    model,
    ...(useReasoning ? { reasoning: { effort: "medium" } } : {}),
    max_output_tokens: TEF_INSTRUCTIONS_MAX_OUTPUT_TOKENS,
    instructions: `Tu réponds exclusivement selon le schéma JSON demandé.
Le champ "prompt" doit contenir uniquement le texte brut des instructions système pour OpenAI Realtime, en français : prêt à être collé tel quel, sans préambule (« Voici… »), sans phrase d’introduction, sans blocs markdown (\`\`\`).`,
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: dataUrl, detail: "high" },
          { type: "input_text", text: TEF_INSTRUCTIONS_META_QUESTION },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "tef_realtime_system_prompt",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              description:
                "Instructions système complètes pour OpenAI Realtime pour cet exercice TEF (texte seul).",
            },
          },
        },
      },
    },
  });

  const out = response.output_text?.trim();
  if (!out) throw new Error("Réponse API vide (output_text)");

  return parseTefInstructionsStructuredOutput(out);
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
