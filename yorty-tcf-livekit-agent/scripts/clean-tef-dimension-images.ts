/**
 * Supprime les images générées dont le nom se termine par des dimensions
 * (ex. TEF-A-01-1536x1024.jpg, TEF-A-01-1024x1024.jpg).
 * Conserve les images principales (TEF-A-01.jpg, etc.).
 * Retire également generatedImagePaths du JSON (références aux fichiers supprimés).
 *
 * Usage: pnpm clean-tef-dimension-images
 */
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXERCISES_PATH = join(__dirname, '../config/tef-exercises.json');
const WEB_PUBLIC_DIR = join(
  __dirname,
  '../../yorty-tcf-livekit-web/public/tef-exercices/generated',
);

/** Fichiers dont le nom se termine par -WxH.jpg (ex. -1536x1024.jpg, -1024x1024.jpg) */
const DIMENSION_SUFFIX_RE = /-\d+x\d+\.jpg$/;

interface TEFExercise {
  id: string;
  generatedImagePaths?: Record<string, string>;
}

function main() {
  let deletedCount = 0;

  if (existsSync(WEB_PUBLIC_DIR)) {
    const files = readdirSync(WEB_PUBLIC_DIR);
    for (const file of files) {
      if (DIMENSION_SUFFIX_RE.test(file)) {
        unlinkSync(join(WEB_PUBLIC_DIR, file));
        deletedCount++;
      }
    }
  }

  const exercises: TEFExercise[] = JSON.parse(readFileSync(EXERCISES_PATH, 'utf-8'));
  let pathsRemoved = 0;
  for (const ex of exercises) {
    if (ex.generatedImagePaths) {
      delete ex.generatedImagePaths;
      pathsRemoved++;
    }
  }
  writeFileSync(EXERCISES_PATH, JSON.stringify(exercises, null, 2), 'utf-8');

  console.log(`✅ Nettoyage terminé`);
  console.log(`   Images dimension-suffixées supprimées : ${deletedCount}`);
  console.log(`   Références generatedImagePaths retirées : ${pathsRemoved}`);
}

main();
