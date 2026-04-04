/**
 * For each TEF-A-NN.png / TEF-B-NN.png, generates TEF-A-NN.md with exercise-specific
 * instructions for OpenAI Realtime (editable by developers).
 *
 * Usage:
 *   pnpm generate-tef-instructions
 *   pnpm generate-tef-instructions -- --force
 *   pnpm generate-tef-instructions -- --only TEF-A-01 TEF-B-02
 *   pnpm generate-tef-instructions -- --model gpt-4o
 *   pnpm generate-tef-instructions -- --stub   (placeholders without OPENAI_API_KEY)
 */
import dotenv from "dotenv";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CONFIG_DIR = join(__dirname, "../config");
const TEF_ROOT = join(CONFIG_DIR, "tef-exercices");

const STANDARD_PNG = /^TEF-(A|B)-(\d{2})\.png$/i;

const COMPLETION_TOKEN_BUDGET = 4096;

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
} {
  const argv = process.argv.slice(2);
  let force = false;
  let stub = false;
  let model = "gpt-5.4-mini";
  const only = new Set<string>();
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--force") force = true;
    if (a === "--stub") stub = true;
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
  return { force, only: only.size > 0 ? only : null, model, stub };
}

function stubMarkdown(id: string, section: "A" | "B"): string {
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

async function generateMdForImage(
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

Produis un fichier markdown en français pour compléter les instructions générales déjà fournies ailleurs (comportement examen, anti-patterns, rapport CECR, phase coach). Ici : UNIQUEMENT le contenu spécifique à CET exercice.

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
    ? `- Section A : dans « Informations que le personnage connaît », pour les détails absents de l'image, décris les **faits** que le personnage pourrait encore devoir préciser au fil d'un échange téléphonique crédible ; évite la seule consigne « répondre que ce n'est pas sur la fiche ». Indique plutôt ce qui manque à l'annonce et, si utile, comment le personnage peut **poursuivre l'appel** (vérification, rappel, habitude du service) sans faire la leçon au candidat.\n`
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
  const { force, only, model, stub } = parseArgs();

  if (stub) {
    for (const section of ["A", "B"] as const) {
      for (const filename of listStandardPngs(section)) {
        const id = basename(filename, ".png").toUpperCase();
        if (only && !only.has(id)) continue;
        const mdPath = join(TEF_ROOT, `TEF-${section}`, `${basename(filename, ".png")}.md`);
        if (existsSync(mdPath) && !force) {
          console.log(`Skip stub ${id} (exists)`);
          continue;
        }
        writeFileSync(mdPath, stubMarkdown(id, section), "utf-8");
        console.log(`Stub ${id}`);
      }
    }
    console.log("Stub pass done.");
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
      const md = await generateMdForImage(client, section, filename, model);
      writeFileSync(mdPath, md, "utf-8");
      console.log(`  ✓ ${id}`);
    } catch (e) {
      console.error(`  ✗ ${id}`, e);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("Done.");
}

main().catch(console.error);
