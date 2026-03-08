import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TEFExercise {
  id: string;
  section: 'A' | 'B';
  filename: string;
  title: string;
  annonce: string;
  consigne: string;
  generatedImagePath?: string;
  /** Map taille → chemin (ex: {"1024x1536": "generated/TEF-A-01.jpg"}) */
  generatedImagePaths?: Record<string, string>;
}

let exercisesCache: TEFExercise[] | null = null;

function loadTEFExercises(): TEFExercise[] {
  if (exercisesCache) return exercisesCache;

  const jsonPath = join(__dirname, '../../config/tef-exercises.json');

  if (!existsSync(jsonPath)) {
    console.warn('[TEF] tef-exercises.json not found. Run pnpm extract-tef to generate it.');
    exercisesCache = [];
    return exercisesCache;
  }

  try {
    const content = readFileSync(jsonPath, 'utf-8');
    exercisesCache = JSON.parse(content) as TEFExercise[];
    console.log(`[TEF] Loaded ${exercisesCache.length} exercises from tef-exercises.json`);
    return exercisesCache;
  } catch (error) {
    console.error('[TEF] Error loading tef-exercises.json:', error);
    exercisesCache = [];
    return exercisesCache;
  }
}

/** TEMPORAIRE : true = toujours retourner la même annonce (TEF-A-01) pour tests multi-tailles */
const ALWAYS_SAME_EXERCISE = false;

/** ID de l'exercice fixe utilisé quand ALWAYS_SAME_EXERCISE est true */
const FIXED_EXERCISE_ID = 'TEF-A-01';

/**
 * Returns a random TEF exercise for the given section.
 * Falls back to a placeholder if no exercises are loaded.
 * TEMPORAIRE : si ALWAYS_SAME_EXERCISE, retourne toujours la même annonce pour tester les tailles d'écran.
 */
export function getTEFExercise(section: 'A' | 'B'): TEFExercise {
  const all = loadTEFExercises();

  if (ALWAYS_SAME_EXERCISE) {
    const fixed = all.find((ex) => ex.id === FIXED_EXERCISE_ID);
    if (fixed) {
      console.log(`[TEF] Mode test : annonce fixe ${FIXED_EXERCISE_ID} (${fixed.title})`);
      return { ...fixed, section };
    }
  }

  const filtered = all.filter((ex) => ex.section === section);

  if (filtered.length === 0) {
    console.warn(`[TEF] No exercises found for section ${section}. Using placeholder.`);
    return {
      id: `TEF-${section}-00`,
      section,
      filename: `TEF-${section} 01.jpg`,
      title: 'Exercice TEF',
      annonce:
        'Annonce non disponible. Veuillez exécuter pnpm extract-tef pour générer les exercices.',
      consigne:
        section === 'A'
          ? 'Vous téléphonez pour obtenir des informations sur cette annonce.'
          : 'Vous présentez cette annonce à un(e) ami(e) et essayez de le/la convaincre.',
    };
  }

  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex]!;
}
