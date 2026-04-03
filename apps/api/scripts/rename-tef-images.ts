/**
 * Renames TEF scan PNGs to TEF-{A|B}-{01..99}.png by sorted position in each folder.
 *
 * Usage: pnpm rename-tef           — dry-run (prints planned renames)
 *        pnpm rename-tef -- --apply — execute renames (two-phase to avoid collisions)
 */
import { existsSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CONFIG_DIR = join(__dirname, "../config");
const TEF_ROOT = join(CONFIG_DIR, "tef-exercices");

const apply = process.argv.includes("--apply");

function pngFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function runSection(section: "A" | "B"): void {
  const dir = join(TEF_ROOT, `TEF-${section}`);
  const files = pngFiles(dir);
  if (files.length === 0) {
    console.log(`Section ${section}: no PNG files in ${dir}`);
    return;
  }

  const tempPrefix = `.__tef_renaming_${section}_`;
  const phase1: { from: string; to: string }[] = [];
  const phase2: { from: string; to: string }[] = [];

  files.forEach((name, i) => {
    const n = String(i + 1).padStart(2, "0");
    const finalName = `TEF-${section}-${n}.png`;
    if (name === finalName) return;
    const tempName = `${tempPrefix}${i}.png`;
    phase1.push({ from: name, to: tempName });
    phase2.push({ from: tempName, to: finalName });
  });

  if (phase1.length === 0) {
    console.log(`Section ${section}: all ${files.length} files already match TEF-${section}-NN.png`);
    return;
  }

  console.log(`\nSection ${section} (${files.length} PNGs, ${phase1.length} to rename):`);
  for (let i = 0; i < phase1.length; i++) {
    const p1 = phase1[i]!;
    const p2 = phase2[i]!;
    console.log(`  ${p1.from} → ${p2.to}`);
  }

  if (!apply) {
    console.log("  (dry-run; pass --apply to execute)");
    return;
  }

  for (const { from, to } of phase1) {
    renameSync(join(dir, from), join(dir, to));
  }
  for (const { from, to } of phase2) {
    renameSync(join(dir, from), join(dir, to));
  }
  console.log(`  Applied ${phase1.length} renames.`);
}

function main(): void {
  if (!existsSync(TEF_ROOT)) {
    console.error(`TEF root not found: ${TEF_ROOT}`);
    process.exit(1);
  }
  console.log(apply ? "Applying renames…" : "Dry-run (no changes)…");
  runSection("A");
  runSection("B");
  if (!apply) {
    console.log("\nRun with --apply to perform renames.");
  }
}

main();
