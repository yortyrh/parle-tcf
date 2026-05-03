/**
 * One-off / maintenance: splits legacy combined TEF exercise markdown
 * (`TEF-A-NN.md` with `<<<GUIDE_CANDIDAT>>>`) into:
 *   - `TEF-A-NN.instructions.md` — agent / Realtime system prompt
 *   - `TEF-A-NN.conseils.md` — candidate-facing rich markdown (Conseils tab)
 *
 * Does not call any LLM. Skips files that do not match `TEF-[AB]-\\d{2}.md`
 * (ignores `_default-practice-guide.md`, already-split files, etc.).
 *
 * Usage (from apps/api):
 *   pnpm split-tef-markdown
 *   pnpm split-tef-markdown -- --dry-run
 */
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const TEF_ROOT = join(__dirname, "../config/tef-exercices");
const COMBINED_MD = /^TEF-[AB]-\d{2}\.md$/i;
const GUIDE_MARKER = "<<<GUIDE_CANDIDAT>>>";

function splitContent(raw: string): { instructions: string; conseils: string } {
  const idx = raw.indexOf(GUIDE_MARKER);
  if (idx === -1) {
    throw new Error(`missing ${GUIDE_MARKER}`);
  }
  return {
    instructions: raw.slice(0, idx).trimEnd(),
    conseils: raw.slice(idx + GUIDE_MARKER.length).trim(),
  };
}

const dryRun = process.argv.includes("--dry-run");

let splitCount = 0;
for (const section of ["A", "B"] as const) {
  const dir = join(TEF_ROOT, `TEF-${section}`);
  if (!existsSync(dir)) continue;

  const names = readdirSync(dir).filter((f) => COMBINED_MD.test(f));
  for (const name of names) {
    const combinedPath = join(dir, name);
    const base = name.replace(/\.md$/i, "");
    const instPath = join(dir, `${base}.instructions.md`);
    const consPath = join(dir, `${base}.conseils.md`);

    if (existsSync(instPath) || existsSync(consPath)) {
      console.warn(`skip ${name}: split outputs already exist`);
      continue;
    }

    const raw = readFileSync(combinedPath, "utf-8");
    let instructions: string;
    let conseils: string;
    try {
      ({ instructions, conseils } = splitContent(raw));
    } catch (e) {
      console.error(`${combinedPath}: ${e}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`${dryRun ? "[dry-run] " : ""}write ${instPath}`);
    console.log(`${dryRun ? "[dry-run] " : ""}write ${consPath}`);
    if (!dryRun) {
      writeFileSync(instPath, instructions + (instructions.endsWith("\n") ? "" : "\n"), "utf-8");
      writeFileSync(consPath, conseils + (conseils.endsWith("\n") ? "" : "\n"), "utf-8");
      unlinkSync(combinedPath);
    }
    splitCount++;
  }
}

console.log(dryRun ? `Would split ${splitCount} file(s).` : `Split ${splitCount} file(s).`);
