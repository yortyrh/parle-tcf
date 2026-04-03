export interface ExerciseImageData {
  id: string | null;
  filename: string;
  section: 'A' | 'B';
  annonce: string | null;
  title: string | null;
  consigne: string | null;
  generatedImagePath: string | null;
  /** Map taille → chemin (ex: {"1024x1536": "generated/TEF-A-01.jpg"}) */
  generatedImagePaths: Record<string, string> | null;
}
