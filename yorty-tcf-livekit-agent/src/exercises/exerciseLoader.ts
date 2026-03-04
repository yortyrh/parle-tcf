import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TCFExercise {
  id: string;
  taskType: 'Tâche 2' | 'Tâche 3';
  content: string;
  url?: string;
  imageUrl?: string;
  imagePath?: string;
  isImageBased: boolean;
}

// Cache séparé pour chaque type de tâche
const exercisesCache: {
  all: TCFExercise[] | null;
  tache2: TCFExercise[] | null;
  tache3: TCFExercise[] | null;
} = {
  all: null,
  tache2: null,
  tache3: null,
};

/**
 * Parse une ligne CSV en tenant compte des guillemets
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Guillemets échappés
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim()); // Push last field
  return result;
}

/**
 * Charge et parse le fichier CSV des exercices
 * @returns Tous les exercices chargés depuis le CSV
 */
function loadAllExercises(): TCFExercise[] {
  if (exercisesCache.all) {
    return exercisesCache.all;
  }

  try {
    const csvPath = join(__dirname, '../../config/tcf-exercises.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    // Parse header
    const firstLine = lines[0];
    if (!firstLine) {
      throw new Error('CSV file has no header');
    }
    const headers = parseCSVLine(firstLine);
    const idIndex = headers.indexOf('id');
    const taskTypeIndex = headers.indexOf('taskType');
    const contentIndex = headers.indexOf('content');
    const urlIndex = headers.indexOf('url');
    const imageUrlIndex = headers.indexOf('imageUrl');
    const imagePathIndex = headers.indexOf('imagePath');
    const isImageBasedIndex = headers.indexOf('isImageBased');

    if (idIndex === -1 || taskTypeIndex === -1 || contentIndex === -1) {
      throw new Error('CSV file is missing required columns');
    }

    // Parse data rows
    const exercises: TCFExercise[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const fields = parseCSVLine(line);
      if (fields.length < 3) continue;

      // Vérifier que les indices sont valides
      if (idIndex < 0 || taskTypeIndex < 0 || contentIndex < 0) {
        continue;
      }

      const id = fields[idIndex];
      const taskTypeValue = fields[taskTypeIndex];
      const content = fields[contentIndex];

      if (!id || !taskTypeValue || !content) {
        continue; // Skip invalid rows
      }

      const taskType = taskTypeValue as 'Tâche 2' | 'Tâche 3';
      if (taskType !== 'Tâche 2' && taskType !== 'Tâche 3') {
        continue; // Skip invalid task types
      }

      const exercise: TCFExercise = {
        id,
        taskType,
        content,
        isImageBased: isImageBasedIndex >= 0 ? fields[isImageBasedIndex] === 'TRUE' : false,
      };

      // Ajouter les champs optionnels seulement s'ils existent et ne sont pas vides
      if (urlIndex >= 0 && fields[urlIndex] && fields[urlIndex].trim()) {
        exercise.url = fields[urlIndex].trim();
      }
      if (imageUrlIndex >= 0 && fields[imageUrlIndex] && fields[imageUrlIndex].trim()) {
        exercise.imageUrl = fields[imageUrlIndex].trim();
      }
      if (imagePathIndex >= 0 && fields[imagePathIndex] && fields[imagePathIndex].trim()) {
        exercise.imagePath = fields[imagePathIndex].trim();
      }

      exercises.push(exercise);
    }

    exercisesCache.all = exercises;

    // Remplir les caches spécifiques à chaque tâche
    exercisesCache.tache2 = exercises.filter((ex) => ex.taskType === 'Tâche 2');
    exercisesCache.tache3 = exercises.filter((ex) => ex.taskType === 'Tâche 3');

    return exercises;
  } catch (error) {
    console.error('Error loading exercises CSV:', error);
    return [];
  }
}

/**
 * Charge les exercices pour une tâche spécifique (avec cache séparé)
 * @param taskType 'tache2' ou 'tache3'
 * @returns Liste des exercices pour cette tâche
 */
function loadExercisesForTask(taskType: 'tache2' | 'tache3'): TCFExercise[] {
  const cacheKey = taskType === 'tache2' ? 'tache2' : 'tache3';

  // Vérifier le cache spécifique
  if (exercisesCache[cacheKey]) {
    return exercisesCache[cacheKey]!;
  }

  // Charger tous les exercices si pas encore fait
  if (!exercisesCache.all) {
    loadAllExercises();
  }

  // Retourner le cache spécifique (doit être rempli par loadAllExercises)
  return exercisesCache[cacheKey] || [];
}

/**
 * Obtient un exercice aléatoire pour une tâche donnée
 * @param taskType 'tache2' ou 'tache3'
 * @returns Un exercice aléatoire ou null si aucun exercice n'est trouvé
 */
export function getRandomExercise(taskType: 'tache2' | 'tache3'): TCFExercise | null {
  const exercises = loadExercisesForTask(taskType);

  if (exercises.length === 0) {
    console.warn(`No exercises found for ${taskType}`);
    return null;
  }

  const randomIndex = Math.floor(Math.random() * exercises.length);
  const exercise = exercises[randomIndex];
  return exercise ?? null;
}

/**
 * Obtient tous les exercices pour une tâche donnée
 * @param taskType 'tache2' ou 'tache3'
 * @returns Tous les exercices pour cette tâche
 */
export function getAllExercises(taskType: 'tache2' | 'tache3'): TCFExercise[] {
  return loadExercisesForTask(taskType);
}
