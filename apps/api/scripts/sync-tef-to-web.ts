/**
 * Copies TEF-A-*.png and TEF-B-*.png from apps/api/config/tef-exercices/ to
 * apps/web/public/tef-exercices/ (does not copy .md).
 *
 * Usage: pnpm sync-tef
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEF_ROOT = join(__dirname, "../config/tef-exercices");
const WEB_PUBLIC = join(__dirname, "../../web/public/tef-exercices");

const PNG = /^TEF-[AB]-\d{2}\.png$/i;

function syncSection(section: "A" | "B"): void {
  const srcDir = join(TEF_ROOT, `TEF-${section}`);
  const destDir = join(WEB_PUBLIC, `TEF-${section}`);
  if (!existsSync(srcDir)) {
    console.warn(`Missing source dir: ${srcDir}`);
    return;
  }
  mkdirSync(destDir, { recursive: true });
  const files = readdirSync(srcDir).filter((f) => PNG.test(f));
  for (const f of files.sort()) {
    copyFileSync(join(srcDir, f), join(destDir, f));
  }
  console.log(`Synced ${files.length} PNG(s) → ${destDir}`);
}

function main(): void {
  if (!existsSync(TEF_ROOT)) {
    console.error(`TEF root not found: ${TEF_ROOT}`);
    process.exit(1);
  }
  syncSection("A");
  syncSection("B");
}

main();
