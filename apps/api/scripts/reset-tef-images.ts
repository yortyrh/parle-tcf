/**
 * Remet à zéro les images générées TEF.
 * Supprime les fichiers .jpg du dossier generated/ et retire
 * generatedImagePath + qualityScore de tef-exercises.json.
 * Les visualDescription sont conservées (analyse vision déjà faite = coût évité).
 *
 * Usage: pnpm reset-tef-images
 */
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXERCISES_PATH = join(__dirname, '../config/tef-exercises.json');
const WEB_PUBLIC_DIR = join(
  __dirname,
  '../../web/public/tef-exercices/generated',
);

interface TEFExercise {
  id: string;
  generatedImagePath?: string;
  generatedImagePaths?: Record<string, string>;
  qualityScore?: number;
  visualDescription?: string;
}

function main() {
  // 1. Supprimer les images générées
  let deletedImages = 0;
  if (existsSync(WEB_PUBLIC_DIR)) {
    const files = readdirSync(WEB_PUBLIC_DIR).filter((f) => f.endsWith('.jpg'));
    for (const file of files) {
      unlinkSync(join(WEB_PUBLIC_DIR, file));
      deletedImages++;
    }
  }

  // 2. Réinitialiser le JSON (garder visualDescription)
  const exercises: TEFExercise[] = JSON.parse(readFileSync(EXERCISES_PATH, 'utf-8'));
  let resetCount = 0;
  for (const ex of exercises) {
    if (ex.generatedImagePath || ex.generatedImagePaths || ex.qualityScore !== undefined) {
      delete ex.generatedImagePath;
      delete ex.generatedImagePaths;
      delete ex.qualityScore;
      resetCount++;
    }
  }
  writeFileSync(EXERCISES_PATH, JSON.stringify(exercises, null, 2), 'utf-8');

  const withDesc = exercises.filter((e) => e.visualDescription).length;

  console.log(`✅ Reset terminé`);
  console.log(`   Images supprimées      : ${deletedImages}`);
  console.log(`   Exercices réinitialisés : ${resetCount}`);
  console.log(`   Descriptions conservées : ${withDesc} (analyse vision réutilisable)`);
  console.log(`\nPrêt pour : pnpm generate-tef-images`);
}

main();
