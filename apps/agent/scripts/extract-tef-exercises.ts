/**
 * Script one-time pour extraire le contenu des exercices TEF Canada
 * depuis les images scannées via GPT-4o Vision.
 *
 * Usage: pnpm extract-tef
 *
 * Prérequis: OPENAI_API_KEY dans .env.local
 * Résultat: config/tef-exercises.json
 */
import dotenv from 'dotenv';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_DIR = join(__dirname, '../config');
const TEF_DIR = join(CONFIG_DIR, 'tef-exercices');
const OUTPUT_PATH = join(CONFIG_DIR, 'tef-exercises.json');

interface TEFExercise {
  id: string;
  section: 'A' | 'B';
  filename: string;
  title: string;
  annonce: string;
  consigne: string;
}

function getImageFiles(section: 'A' | 'B'): string[] {
  const dir = join(TEF_DIR, `TEF-${section}`);
  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return [];
  }
  return readdirSync(dir)
    .filter(
      (f) =>
        f.toLowerCase().endsWith('.jpg') ||
        f.toLowerCase().endsWith('.jpeg') ||
        f.toLowerCase().endsWith('.png'),
    )
    .sort();
}

async function extractExercise(
  client: OpenAI,
  section: 'A' | 'B',
  filename: string,
): Promise<TEFExercise | null> {
  const imagePath = join(TEF_DIR, `TEF-${section}`, filename);
  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const sectionInstructions =
    section === 'A'
      ? 'Le candidat va téléphoner pour obtenir des informations sur cette annonce.'
      : "Le candidat va présenter cette annonce à un(e) ami(e) et essayer de le/la convaincre d'y participer.";

  const prompt = `Cette image est un exercice du TEF Canada (Test d'Évaluation de Français) - Expression Orale, Section ${section}.

${sectionInstructions}

Analyse l'image et extrais:
1. Le titre de l'annonce (nom de l'entreprise, activité, ou offre)
2. Le texte complet de l'annonce (tout le contenu textuel visible)
3. La consigne donnée au candidat (ce qu'il doit faire)

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans bloc de code) avec cette structure exacte:
{
  "title": "titre de l'annonce",
  "annonce": "texte complet de l'annonce",
  "consigne": "consigne du candidat"
}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error(`No content for ${filename}`);
      return null;
    }

    // Nettoyer la réponse (enlever éventuels blocs markdown)
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned) as { title: string; annonce: string; consigne: string };

    // Générer l'ID depuis le nom de fichier
    const numMatch = filename.match(/(\d+)/);
    const num = numMatch ? numMatch[1]!.padStart(2, '0') : '00';
    const id = `TEF-${section}-${num}`;

    return {
      id,
      section,
      filename,
      title: parsed.title || 'Exercice TEF',
      annonce: parsed.annonce || '',
      consigne: parsed.consigne || '',
    };
  } catch (error) {
    console.error(`Error processing ${filename}:`, error);
    return null;
  }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment. Check .env.local');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });
  const exercises: TEFExercise[] = [];

  // Charger les exercices existants si le fichier existe (pour reprendre)
  if (existsSync(OUTPUT_PATH)) {
    const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8')) as TEFExercise[];
    exercises.push(...existing);
    console.log(`Resuming from ${existing.length} existing exercises`);
  }

  const existingIds = new Set(exercises.map((e) => e.id));

  for (const section of ['A', 'B'] as const) {
    const files = getImageFiles(section);
    console.log(`\nSection ${section}: ${files.length} images found`);

    for (const filename of files) {
      const numMatch = filename.match(/(\d+)/);
      const num = numMatch ? numMatch[1]!.padStart(2, '0') : '00';
      const id = `TEF-${section}-${num}`;

      if (existingIds.has(id)) {
        console.log(`  ✓ ${id} already extracted, skipping`);
        continue;
      }

      console.log(`  Processing ${filename}...`);
      const exercise = await extractExercise(client, section, filename);

      if (exercise) {
        exercises.push(exercise);
        existingIds.add(id);
        console.log(`  ✓ ${id}: ${exercise.title}`);

        // Sauvegarder après chaque extraction pour ne pas perdre le travail
        writeFileSync(OUTPUT_PATH, JSON.stringify(exercises, null, 2), 'utf-8');
      } else {
        console.error(`  ✗ Failed to extract ${filename}`);
      }

      // Petite pause pour éviter de surcharger l'API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Trier par section et numéro
  exercises.sort((a, b) => {
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    return a.id.localeCompare(b.id);
  });

  writeFileSync(OUTPUT_PATH, JSON.stringify(exercises, null, 2), 'utf-8');
  console.log(`\n✅ Done! ${exercises.length} exercises saved to config/tef-exercises.json`);
}

main().catch(console.error);
