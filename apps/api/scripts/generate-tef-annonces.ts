/**
 * Script pour générer les fichiers markdown d'annonces TEF à partir de tef-exercises.json.
 *
 * Les fichiers sont écrits dans un dossier éditable (texts/) — pas dans generated/ —
 * afin que le développeur puisse les améliorer manuellement après la génération initiale.
 *
 * Usage:
 *   pnpm generate-tef-annonces      — génère uniquement les fichiers manquants
 *   pnpm generate-tef-annonces --force  — régénère tous les fichiers
 *   pnpm generate-tef-annonces TEF-A-01 TEF-B-12  — régénère des exercices spécifiques
 *
 * Prérequis: tef-exercises.json (pnpm extract-tef)
 * Résultat: apps/web/content/tef-annonces/{id}.md
 * (hors public — non téléchargeable directement, servi via API)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_DIR = join(__dirname, '../config');
const EXERCISES_PATH = join(CONFIG_DIR, 'tef-exercises.json');
const WEB_TEXTS_DIR = join(__dirname, '../../web/content/tef-annonces');

interface TEFExercise {
  id: string;
  section: 'A' | 'B';
  filename: string;
  title: string;
  annonce: string;
  consigne: string;
}

/**
 * Convertit title + annonce en markdown lisible.
 * Les lignes commençant par "- " deviennent des listes, le titre est en heading.
 */
function toMarkdown(exercise: TEFExercise): string {
  const lines = exercise.annonce.split('\n');
  const result: string[] = [];

  result.push(`# ${exercise.title}`);
  result.push('');

  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        inList = false;
        result.push('');
      }
      result.push('');
      continue;
    }
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        inList = true;
      }
      result.push(`- ${trimmed.slice(2)}`);
    } else {
      if (inList) {
        inList = false;
        result.push('');
      }
      result.push(trimmed);
    }
  }

  return result
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function main() {
  if (!existsSync(EXERCISES_PATH)) {
    console.error("tef-exercises.json introuvable. Exécutez pnpm extract-tef d'abord.");
    process.exit(1);
  }

  const exercises: TEFExercise[] = JSON.parse(readFileSync(EXERCISES_PATH, 'utf-8'));
  const forceIds = process.argv.filter((a) => a.startsWith('TEF-'));
  const forceAll = process.argv.includes('--force');
  const forceRegenerate = forceIds.length > 0 || forceAll;

  const filtered =
    forceIds.length > 0 ? exercises.filter((e) => forceIds.includes(e.id)) : exercises;

  if (!existsSync(WEB_TEXTS_DIR)) {
    mkdirSync(WEB_TEXTS_DIR, { recursive: true });
  }

  console.log("\n📝 Génération des textes d'annonces TEF (markdown)");
  console.log(`   Dossier éditable : content/tef-annonces/ (hors public)`);
  if (forceRegenerate) {
    console.log(
      `   Mode --force : régénération forcée${forceIds.length > 0 ? ` pour ${forceIds.join(', ')}` : ' (tous)'}`,
    );
  } else {
    console.log('   Fichiers existants conservés (éditables manuellement)');
  }
  console.log(`   ${filtered.length} exercice(s) à traiter\n`);

  let generated = 0;
  let skipped = 0;

  for (const exercise of filtered) {
    const outputPath = join(WEB_TEXTS_DIR, `${exercise.id}.md`);

    if (!forceRegenerate && existsSync(outputPath)) {
      console.log(`  ✓ ${exercise.id} — texte existant, ignoré`);
      skipped++;
      continue;
    }

    const markdown = toMarkdown(exercise);
    writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`  ✓ ${exercise.id} — ${exercise.title}`);
    generated++;
  }

  console.log(`\n✅ Terminé : ${generated} généré(s), ${skipped} ignoré(s)`);
  console.log(`   Les fichiers sont éditable dans : ${WEB_TEXTS_DIR}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
