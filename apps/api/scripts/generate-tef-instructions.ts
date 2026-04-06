/**
 * For each TEF-A-NN / TEF-B-NN pair, writes TEF-A-NN.md as a **self-contained** system
 * prompt for OpenAI Realtime: YAML template (tef-section-{a|b}.yml) + EXERCICE À UTILISER +
 * exercise-specific body (from vision or existing file).
 *
 * Usage:
 *   pnpm generate-tef-instructions
 *   pnpm generate-tef-instructions -- --force
 *   pnpm generate-tef-instructions -- --upgrade   (re-merge YAML + existing exercise body, no vision)
 *   pnpm generate-tef-instructions -- --only TEF-A-01 TEF-B-02
 *   pnpm generate-tef-instructions -- --model gpt-4o
 *   pnpm generate-tef-instructions -- --stub   (placeholders without OPENAI_API_KEY)
 */
import dotenv from "dotenv";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { parse } from "yaml";

dotenv.config({ path: ".env.local" });

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CONFIG_DIR = join(__dirname, "../config");
const TEF_ROOT = join(CONFIG_DIR, "tef-exercices");

const STANDARD_PNG = /^TEF-(A|B)-(\d{2})\.png$/i;

/** Same text formerly appended in ExamSessionService for section A (now baked into each MD). */
const TEF_SECTION_A_INSTRUCTION_CLOSING = `

---
RAPPEL FINAL — Section A (prime sur toute phrase du bloc « EXERCICE À UTILISER » qui suggérerait un refus d’information) :

Pendant l’appel, ne bloque pas l’échange en renvoyant le candidat à l’affiche, au site, à un courriel, à « appeler ailleurs » ou à un autre service comme seule réponse, ni en répétant que le détail « n’est pas sur l’annonce », « n’est pas écrit », « vous auriez dû lire » ou équivalent. Ce ton est pédagogiquement contre-productif et tue l’oral.

À la place, reste entièrement dans le personnage : réponds aux questions, y compris lorsque le point ne figure pas clairement sur la fiche du candidat. Donne une information courte et crédible qu’un interlocuteur au téléphone fournirait, ou une suite naturelle (prise de note, vérification, « pour votre situation on fait comme ceci », rappel avec le détail, précision d’usage), en restant cohérent avec l’annonce et les faits de l’exercice. Les mentions « (illisible sur le scan) » indiquent ce que le candidat ne voit pas sur son document ; elles n’obligent pas à refuser la réponse : au téléphone tu peux préciser ces points comme le ferait le service.

L’évaluation pourra noter dans le rapport si une question visait une info hors fiche ; pendant l’épreuve, le personnage accueille et répond sans moraliser sur la démarche à suivre.`;

const EXERCICE_MARKER = "\n\nEXERCICE À UTILISER:\n";

const COMPLETION_TOKEN_BUDGET = 4096;

interface AgentYamlFragment {
  baseInstructions: string;
  instructions: string;
}

/** Newer chat models reject `max_tokens` and require `max_completion_tokens`. */
function completionTokenParams(model: string): { max_tokens: number } | { max_completion_tokens: number } {
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

function parseArgs(): {
  force: boolean;
  only: Set<string> | null;
  model: string;
  stub: boolean;
  upgrade: boolean;
} {
  const argv = process.argv.slice(2);
  let force = false;
  let stub = false;
  let upgrade = false;
  let model = "gpt-5.4-mini";
  const only = new Set<string>();
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--force") force = true;
    if (a === "--stub") stub = true;
    else if (a === "--upgrade") upgrade = true;
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
  return { force, only: only.size > 0 ? only : null, model, stub, upgrade };
}

function loadAgentYaml(section: "A" | "B"): AgentYamlFragment {
  const taskType = section === "A" ? "tef-section-a" : "tef-section-b";
  const configPath = join(CONFIG_DIR, "agents", `${taskType}.yml`);
  const fileContent = readFileSync(configPath, "utf-8");
  const config = parse(fileContent) as Record<string, unknown>;
  const baseInstructions = config.baseInstructions;
  const instructions = config.instructions;
  if (typeof baseInstructions !== "string" || typeof instructions !== "string") {
    throw new Error(`Invalid agent YAML (need baseInstructions, instructions): ${taskType}.yml`);
  }
  return { baseInstructions, instructions };
}

function buildGenericRulesPrefix(section: "A" | "B"): string {
  const { baseInstructions, instructions } = loadAgentYaml(section);
  let prefix = `${baseInstructions.trimEnd()}\n\n${instructions.trimEnd()}`;
  if (section === "A") {
    prefix += TEF_SECTION_A_INSTRUCTION_CLOSING;
  }
  return prefix;
}

const genericPrefixCache: Partial<Record<"A" | "B", string>> = {};

function getGenericRulesPrefix(section: "A" | "B"): string {
  if (!genericPrefixCache[section]) {
    genericPrefixCache[section] = buildGenericRulesPrefix(section);
  }
  return genericPrefixCache[section]!;
}

function wrapFullSystemPrompt(exerciseMarkdown: string, section: "A" | "B"): string {
  const generic = getGenericRulesPrefix(section);
  return `${generic}${EXERCICE_MARKER}${exerciseMarkdown.trim()}`;
}

/**
 * Extract exercise-only body from a .md file: content after EXERCICE À UTILISER, or the
 * whole file if legacy (fragment-only) format.
 */
function extractExerciseBodyFromExistingMd(fileContent: string): string {
  const idx = fileContent.indexOf(EXERCICE_MARKER);
  if (idx >= 0) {
    return fileContent.slice(idx + EXERCICE_MARKER.length).trim();
  }
  return fileContent.trim();
}

function stubExerciseFragment(id: string, section: "A" | "B"): string {
  const intro =
    section === "A"
      ? "Le candidat téléphone pour obtenir des informations. Tu décroches au téléphone."
      : "Le candidat te présente une annonce pour te convaincre. Tu es son ami / sa amie ; tu ne connais pas l’annonce au départ.";
  return `# ${id} — (à compléter)

> **Brouillon** : exécute \`pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --force\` (avec \`OPENAI_API_KEY\`) pour remplir ce fichier à partir de l’image.

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

function listStandardPngs(section: "A" | "B"): string[] {
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

async function generateExerciseFragmentForImage(
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

async function main(): Promise<void> {
  const { force, only, model, stub, upgrade } = parseArgs();

  if (stub && upgrade) {
    console.error("Use either --stub or --upgrade, not both.");
    process.exit(1);
  }

  if (stub) {
    for (const section of ["A", "B"] as const) {
      getGenericRulesPrefix(section);
      for (const filename of listStandardPngs(section)) {
        const id = basename(filename, ".png").toUpperCase();
        if (only && !only.has(id)) continue;
        const mdPath = join(TEF_ROOT, `TEF-${section}`, `${basename(filename, ".png")}.md`);
        if (existsSync(mdPath) && !force) {
          console.log(`Skip stub ${id} (exists)`);
          continue;
        }
        const full = wrapFullSystemPrompt(stubExerciseFragment(id, section), section);
        writeFileSync(mdPath, full, "utf-8");
        console.log(`Stub ${id}`);
      }
    }
    console.log("Stub pass done.");
    return;
  }

  if (upgrade) {
    let count = 0;
    for (const section of ["A", "B"] as const) {
      getGenericRulesPrefix(section);
      for (const filename of listStandardPngs(section)) {
        const id = basename(filename, ".png").toUpperCase();
        if (only && !only.has(id)) continue;
        const mdPath = join(TEF_ROOT, `TEF-${section}`, `${basename(filename, ".png")}.md`);
        if (!existsSync(mdPath)) {
          console.log(`Skip upgrade ${id} (no .md yet)`);
          continue;
        }
        const raw = readFileSync(mdPath, "utf-8");
        const exerciseBody = extractExerciseBodyFromExistingMd(raw);
        const full = wrapFullSystemPrompt(exerciseBody, section);
        writeFileSync(mdPath, full, "utf-8");
        console.log(`Upgrade ${id}`);
        count++;
      }
    }
    console.log(`Upgrade done (${count} file(s)).`);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY not found. Use --stub for placeholders or set .env.local");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  type Job = { section: "A" | "B"; filename: string; id: string };
  const jobs: Job[] = [];

  for (const section of ["A", "B"] as const) {
    getGenericRulesPrefix(section);
    for (const filename of listStandardPngs(section)) {
      const id = basename(filename, ".png").toUpperCase();
      if (only && !only.has(id)) continue;
      const mdPath = join(TEF_ROOT, `TEF-${section}`, `${basename(filename, ".png")}.md`);
      if (existsSync(mdPath) && !force) {
        console.log(`Skip ${id} (exists, use --force)`);
        continue;
      }
      jobs.push({ section, filename, id });
    }
  }

  if (jobs.length === 0) {
    console.log("Nothing to generate.");
    return;
  }

  console.log(`Generating ${jobs.length} file(s) with model ${model}…`);

  for (const { section, filename, id } of jobs) {
    const mdPath = join(TEF_ROOT, `TEF-${section}`, `${basename(filename, ".png")}.md`);
    try {
      console.log(`  ${id}…`);
      const fragment = await generateExerciseFragmentForImage(client, section, filename, model);
      const full = wrapFullSystemPrompt(fragment, section);
      writeFileSync(mdPath, full, "utf-8");
      console.log(`  ✓ ${id}`);
    } catch (e) {
      console.error(`  ✗ ${id}`, e);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("Done.");
}

main().catch(console.error);
