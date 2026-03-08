/**
 * Script pour générer des images d'annonces TEF authentiques via OpenAI.
 *
 * Pipeline en 3 étapes :
 *   1. Vision  : GPT-4o analyse l'image scannée originale → description visuelle complète
 *   2. Génération : gpt-image-1 crée une nouvelle publicité propre et authentique
 *   3. Validation : GPT-4o compare original vs généré → score 1-10
 *                   Si score < QUALITY_THRESHOLD → retry automatique (max MAX_RETRIES fois)
 *
 * Modèles configurables : mettre à jour VISION_MODEL / GENERATION_MODEL dès que
 * des versions plus récentes (gpt-5.4, gpt-image-1.5, etc.) sont vérifiées disponibles
 * via ton compte OpenAI (https://platform.openai.com/docs/models).
 *
 * Usage: pnpm generate-tef-images
 *
 * Prérequis: OPENAI_API_KEY dans .env.local
 * Résultat:
 *   - Images dans yorty-tcf-livekit-web/public/tef-exercices/generated/
 *   - config/tef-exercises.json mis à jour avec generatedImagePath, visualDescription, qualityScore
 *
 * Reprise automatique : les exercices avec generatedImagePath + qualityScore ≥ QUALITY_THRESHOLD
 * sont ignorés. Supprimer le .jpg + retirer generatedImagePath du JSON pour forcer la régénération.
 */
import dotenv from 'dotenv';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

dotenv.config({ path: '.env.local' });

// ─────────────────────────────────────────────
// CONFIGURATION — mettre à jour ici si besoin
// ─────────────────────────────────────────────

/** Modèle vision pour l'analyse et la validation. Mettre à jour vers gpt-5.4 si disponible. */
const VISION_MODEL = 'gpt-5.4';

/** Modèle de génération d'image. Mettre à jour vers gpt-image-1.5 si disponible. */
const GENERATION_MODEL = 'gpt-image-1.5';

/** Score minimum (sur 10) pour accepter une image générée. En dessous → retry. */
const QUALITY_THRESHOLD = 7;

/** Nombre maximum de tentatives de génération par exercice. */
const MAX_RETRIES = 3;

// ─────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_DIR = join(__dirname, '../config');
const EXERCISES_PATH = join(CONFIG_DIR, 'tef-exercises.json');
const TEF_IMAGES_DIR = join(CONFIG_DIR, 'tef-exercices');
const WEB_PUBLIC_DIR = join(
  __dirname,
  '../../yorty-tcf-livekit-web/public/tef-exercices/generated',
);

interface TEFExercise {
  id: string;
  section: 'A' | 'B';
  filename: string;
  title: string;
  annonce: string;
  consigne: string;
  generatedImagePath?: string;
  visualDescription?: string;
  qualityScore?: number;
}

interface ValidationResult {
  score: number;
  reason: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function readImageAsBase64(imagePath: string): { data: string; mimeType: string } | null {
  if (!existsSync(imagePath)) return null;
  const data = readFileSync(imagePath).toString('base64');
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return { data, mimeType };
}

function saveExercises(exercises: TEFExercise[]): void {
  writeFileSync(EXERCISES_PATH, JSON.stringify(exercises, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────
// Étape 1 : Analyse vision de l'image scannée
// ─────────────────────────────────────────────

async function analyzeOriginalImage(client: OpenAI, exercise: TEFExercise): Promise<string | null> {
  const imagePath = join(TEF_IMAGES_DIR, `TEF-${exercise.section}`, exercise.filename);
  const image = readImageAsBase64(imagePath);

  if (!image) {
    console.warn(`    ⚠ Image originale introuvable : ${imagePath}`);
    return null;
  }

  try {
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      max_completion_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.data}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: `Tu analyses une annonce publicitaire ou un avis officiel extrait d'un manuel d'examen de français (TEF Canada).

Texte déjà extrait de cette annonce :
Titre : ${exercise.title}
Contenu : ${exercise.annonce}

Fournis une description visuelle complète et détaillée pour qu'un graphiste puisse recréer une publicité similaire sans voir l'original. Décris précisément :

1. Le type d'annonce (offre d'emploi, activité de loisir, service, produit, événement, documentation officielle, etc.)
2. La palette de couleurs dominante (fond, titres, texte, accents, éléments graphiques)
3. La mise en page et la structure (disposition des blocs, hiérarchie visuelle, colonnes, encadrés)
4. Les éléments visuels (photos, illustrations, icônes, formes graphiques — décrire leur contenu et position)
5. La typographie (style des titres, taille relative, graisse)
6. Le logo ou identité visuelle (si présent : forme, couleurs, nom, position)
7. Toutes les informations clés à faire apparaître (prix, contacts, adresses, dates, horaires, numéros de téléphone, sites web, caractéristiques)
8. L'ambiance générale et le ton visuel (dynamique, sérieux, ludique, officiel, élégant, etc.)

Réponds en français avec une description fluide et précise, suffisamment détaillée pour guider la création d'une vraie publicité.`,
            },
          ],
        },
      ],
    });

    return response.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error(`    ✗ Analyse vision échouée :`, error);
    return null;
  }
}

// ─────────────────────────────────────────────
// Étape 2 : Génération de la nouvelle image
// ─────────────────────────────────────────────

function buildGenerationPrompt(exercise: TEFExercise, visualDescription: string): string {
  return `Crée une image visuelle d'affiche publicitaire, format portrait, professionnelle et réaliste.

RÈGLE ABSOLUE : N'inclus AUCUN TEXTE sur l'image. Pas de titre, pas de liste, pas de numéro, pas de mot écrit. Uniquement des éléments visuels. La raison : l'annonce sera affichée au-dessus de l'image dans l'interface, donc le texte ne doit pas figurer sur l'image elle-même.

Thème de l'annonce : "${exercise.title}". Contenu évoqué (pour l'ambiance uniquement, NE PAS l'écrire) : ${exercise.annonce}

Description visuelle de référence : ${visualDescription}

L'image doit :
- Reproduire l'ambiance et le style graphique (monuments, illustrations, couleurs, textures)
- Pouvoir inclure des pictogrammes ou icônes minimalistes (calendrier, valise, bâtiment...) pour évoquer le thème
- Rester purement visuelle : aucun mot, aucun chiffre
- Être propre, sans bordure de page, sans artefact de numérisation
- Ressembler à une publicité stylée dont le texte sera affiché séparément en HTML

Style : graphisme français ou québécois, moderne, professionnel.`;
}

async function generateImage(
  client: OpenAI,
  exercise: TEFExercise,
  visualDescription: string,
  outputPath: string,
): Promise<boolean> {
  const prompt = buildGenerationPrompt(exercise, visualDescription);

  try {
    // gpt-image-1 retourne b64_json sans response_format explicite
    // dall-e-3 nécessite response_format: 'b64_json'
    const isDalle3 = GENERATION_MODEL === 'dall-e-3';

    const params: Parameters<typeof client.images.generate>[0] = {
      model: GENERATION_MODEL,
      prompt,
      n: 1,
      size: isDalle3 ? '1024x1792' : '1024x1536',
      quality: isDalle3 ? 'standard' : 'medium',
      ...(isDalle3 ? { response_format: 'b64_json' } : {}),
    };

    const response = await client.images.generate(params);

    const b64 = response.data[0]?.b64_json;
    if (!b64) {
      console.error(`    ✗ Aucune donnée image retournée`);
      return false;
    }

    writeFileSync(outputPath, Buffer.from(b64, 'base64'));
    return true;
  } catch (error) {
    console.error(`    ✗ Génération échouée :`, error);
    return false;
  }
}

// ─────────────────────────────────────────────
// Étape 3 : Validation auto par GPT vision
// ─────────────────────────────────────────────

async function validateGeneratedImage(
  client: OpenAI,
  exercise: TEFExercise,
  originalImagePath: string,
  generatedImagePath: string,
): Promise<ValidationResult> {
  const original = readImageAsBase64(originalImagePath);
  const generated = readImageAsBase64(generatedImagePath);

  if (!original || !generated) {
    return { score: 0, reason: 'Image introuvable pour la validation' };
  }

  try {
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      max_completion_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Tu compares une annonce publicitaire originale (image 1) avec une version régénérée par IA (image 2).
L'annonce concerne : "${exercise.title}"

Évalue la qualité de l'image générée selon ces critères :
- L'image est purement visuelle : AUCUN texte écrit (titres, listes, numéros) — les infos seront en HTML
- Le style visuel correspond au thème de l'annonce (monuments, ambiance, pictogrammes éventuels)
- Aucun artefact parasite (numéro d'examen, bordure, artefact de scan)
- Mise en page propre et professionnelle

Réponds UNIQUEMENT avec un objet JSON valide : {"score": <entier entre 1 et 10>, "reason": "<explication courte en français>"}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${original.mimeType};base64,${original.data}`,
                detail: 'low',
              },
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${generated.mimeType};base64,${generated.data}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(cleaned) as ValidationResult;
    return { score: parsed.score ?? 0, reason: parsed.reason ?? '' };
  } catch {
    return { score: 0, reason: 'Erreur lors de la validation' };
  }
}

// ─────────────────────────────────────────────
// Traitement principal d'un exercice
// ─────────────────────────────────────────────

async function processExercise(
  client: OpenAI,
  exercise: TEFExercise,
  exercises: TEFExercise[],
  forceRegenerate: boolean,
): Promise<'skipped' | 'success' | 'failed'> {
  const outputFilename = `${exercise.id}.jpg`;
  const outputPath = join(WEB_PUBLIC_DIR, outputFilename);
  const generatedImageRelPath = `generated/${outputFilename}`;
  const originalImagePath = join(TEF_IMAGES_DIR, `TEF-${exercise.section}`, exercise.filename);

  // Ignorer si déjà validé (sauf si --force)
  if (
    !forceRegenerate &&
    existsSync(outputPath) &&
    exercise.generatedImagePath &&
    (exercise.qualityScore ?? 0) >= QUALITY_THRESHOLD
  ) {
    console.log(`  ✓ ${exercise.id} déjà validé (score ${exercise.qualityScore}/10), ignoré`);
    return 'skipped';
  }

  console.log(`  ${exercise.id}: ${exercise.title}`);

  // ── Étape 1 : description visuelle ──────────────────
  if (!exercise.visualDescription) {
    console.log(`    → Analyse vision (${VISION_MODEL})...`);
    const desc = await analyzeOriginalImage(client, exercise);

    if (desc) {
      exercise.visualDescription = desc;
      saveExercises(exercises);
      console.log(`    ✓ Description visuelle extraite`);
    } else {
      console.warn(`    ⚠ Vision échouée, utilisation du texte extrait`);
      exercise.visualDescription = `Annonce "${exercise.title}". Contenu : ${exercise.annonce}`;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  // ── Étapes 2+3 : génération + validation avec retries ──
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`    → Génération (${GENERATION_MODEL}) — tentative ${attempt}/${MAX_RETRIES}...`);

    // Supprimer l'ancienne image si elle existe
    if (existsSync(outputPath)) unlinkSync(outputPath);

    const generated = await generateImage(client, exercise, exercise.visualDescription, outputPath);

    if (!generated) {
      console.error(`    ✗ Génération échouée (tentative ${attempt})`);
      continue;
    }

    // Validation
    console.log(`    → Validation (${VISION_MODEL})...`);
    const validation = await validateGeneratedImage(
      client,
      exercise,
      originalImagePath,
      outputPath,
    );

    console.log(`    → Score : ${validation.score}/10 — ${validation.reason}`);

    if (validation.score >= QUALITY_THRESHOLD) {
      exercise.generatedImagePath = generatedImageRelPath;
      exercise.qualityScore = validation.score;
      saveExercises(exercises);
      console.log(`    ✓ Acceptée (score ${validation.score}/10)`);
      return 'success';
    }

    console.warn(
      `    ⚠ Score insuffisant (${validation.score}/${QUALITY_THRESHOLD}) — ${attempt < MAX_RETRIES ? 'retry...' : 'abandon'}`,
    );
    await new Promise((r) => setTimeout(r, 500));
  }

  // Toutes les tentatives ont échoué → garder la dernière image si elle existe
  if (existsSync(outputPath)) {
    exercise.generatedImagePath = generatedImageRelPath;
    exercise.qualityScore = 0; // marqué comme "à vérifier"
    saveExercises(exercises);
    console.error(
      `    ✗ Score insuffisant après ${MAX_RETRIES} tentatives — image gardée mais marquée qualityScore=0`,
    );
  }

  return 'failed';
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY introuvable dans .env.local');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  if (!existsSync(EXERCISES_PATH)) {
    console.error(`tef-exercises.json introuvable. Exécutez pnpm extract-tef d'abord.`);
    process.exit(1);
  }

  const exercises: TEFExercise[] = JSON.parse(readFileSync(EXERCISES_PATH, 'utf-8'));

  const forceIds = process.argv.filter((a) => a.startsWith('TEF-'));
  const forceRegenerate = forceIds.length > 0;
  const filtered =
    forceIds.length > 0 ? exercises.filter((e) => forceIds.includes(e.id)) : exercises;

  console.log(`\n🎨 Génération d'images TEF`);
  if (forceRegenerate) {
    console.log(`   Mode --force pour : ${forceIds.join(', ')}`);
  }
  console.log(`   Vision     : ${VISION_MODEL}`);
  console.log(`   Génération : ${GENERATION_MODEL}`);
  console.log(`   Seuil qualité : ${QUALITY_THRESHOLD}/10 (max ${MAX_RETRIES} tentatives)`);
  console.log(`   ${filtered.length} exercice(s) à traiter\n`);

  if (!existsSync(WEB_PUBLIC_DIR)) {
    mkdirSync(WEB_PUBLIC_DIR, { recursive: true });
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const exercise of filtered) {
    const result = await processExercise(client, exercise, exercises, forceRegenerate);
    if (result === 'skipped') skipped++;
    else if (result === 'success') generated++;
    else failed++;

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n✅ Terminé !`);
  console.log(`   Générées  : ${generated}`);
  console.log(`   Ignorées  : ${skipped}`);
  console.log(`   Échouées  : ${failed}`);

  const lowScore = exercises.filter(
    (e) => e.generatedImagePath && (e.qualityScore ?? 0) < QUALITY_THRESHOLD,
  );
  if (lowScore.length > 0) {
    console.log(`\n⚠  ${lowScore.length} image(s) avec score insuffisant :`);
    lowScore.forEach((e) => console.log(`   - ${e.id} (score ${e.qualityScore ?? '?'}/10)`));
  }

  console.log(`\nImages : ${WEB_PUBLIC_DIR}`);
  console.log(`JSON   : ${EXERCISES_PATH}`);
}

main().catch(console.error);
