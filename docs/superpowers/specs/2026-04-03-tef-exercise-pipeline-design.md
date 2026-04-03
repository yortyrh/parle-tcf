# TEF Exercise Pipeline Redesign

## Summary

Replace the current TEF exercise pipeline (Vision extraction to JSON + generated images) with a simpler architecture:
- Rename source images to a standardized naming scheme (`TEF-{section}-{num}.png`)
- Generate per-exercise `.md` instruction files using a reasoning model (editable by devs)
- Serve original images directly (full-width, scrollable) instead of generated images
- Load exercise data from `.md` files instead of `tef-exercises.json`

## Architecture

```mermaid
graph TD
  subgraph pipeline ["Scripts Pipeline (one-time / on-demand)"]
    rename["rename-tef-images"]
    generate["generate-tef-instructions"]
    sync["sync-tef-to-web"]
    rename --> generate
    generate --> sync
  end

  subgraph api ["API Runtime"]
    exerciseSvc["ExerciseService"]
    sessionSvc["ExamSessionService"]
    yaml["tef-section-a.yml / tef-section-b.yml"]
    mdFiles["TEF-A-01.md, TEF-A-02.md, ..."]
    exerciseSvc -->|"reads .md files"| mdFiles
    sessionSvc -->|"loads YAML"| yaml
    sessionSvc -->|"concatenates"| exerciseSvc
  end

  subgraph web ["Web App"]
    consigne["ConsigneTabContent"]
    viewer["ExerciseImageViewer"]
    publicImg["public/tef-exercices/TEF-A/*.png"]
    consigne --> viewer
    viewer -->|"img src"| publicImg
  end

  sync -->|"copies PNG"| publicImg
  generate -->|"writes .md"| mdFiles
  rename -->|"renames PNG in"| generate
```

## Script 1: `rename-tef-images`

- **Location**: `apps/api/scripts/rename-tef-images.ts`
- **npm script**: `"rename-tef": "tsx scripts/rename-tef-images.ts"`
- **Behavior**:
  - Reads `apps/api/config/tef-exercices/TEF-A/` and `TEF-B/`
  - Filters for `.png` files, sorts lexicographically
  - Renames by position: 1st file -> `TEF-A-01.png`, 2nd -> `TEF-A-02.png`, etc.
  - Dry-run by default; pass `--apply` to execute
  - Skips files already matching `TEF-{section}-\d{2}.png`
  - Old `.jpg` files are already deleted from disk (visible as "D" in git status); no action needed

## Script 2: `generate-tef-instructions`

- **Location**: `apps/api/scripts/generate-tef-instructions.ts`
- **npm script**: `"generate-tef-instructions": "tsx scripts/generate-tef-instructions.ts"`
- **Behavior**:
  - Scans `TEF-A/` and `TEF-B/` for `TEF-{section}-{num}.png` files
  - For each image without a corresponding `.md` file (or with `--force`):
    - Sends the image to GPT-4o (default; configurable via `--model` flag)
    - System prompt instructs it to analyze the TEF exercise image and generate:
      - Role description (who the Realtime agent plays)
      - Announcement context (what the exercise is about)
      - Known information (details the character should know)
      - Candidate instructions (what the student is supposed to do)
    - Section A: telephone conversation context
    - Section B: friend conversation context
    - Writes result as `TEF-{section}-{num}.md`
  - Resume-friendly: skips existing `.md` files unless `--force`
  - Saves after each generation to avoid losing work

### Generated `.md` structure

```markdown
# TEF-A-01 - [Title derived from the image]

## Role
[Description of who the agent plays - e.g., receptionist, seller, employer]

## Contexte de l'annonce
[Full description of the announcement content visible in the image]

## Informations connues
[Bullet list of facts the character knows and can share when asked]

## Consigne du candidat
[What the candidate is supposed to do during this exercise]
```

## Script 3: `sync-tef-to-web`

- **Location**: `apps/api/scripts/sync-tef-to-web.ts`
- **npm script**: `"sync-tef": "tsx scripts/sync-tef-to-web.ts"`
- **Behavior**:
  - Copies `TEF-{section}-{num}.png` files from `apps/api/config/tef-exercices/` to `apps/web/public/tef-exercices/`
  - Creates destination directories if needed
  - Does NOT copy `.md` files (those stay API-side)
  - Idempotent (overwrites existing files)

## API Changes

### `TefExercise` interface (`exercise.service.ts`)

```typescript
export interface TefExercise {
  id: string;           // "TEF-A-01"
  section: 'A' | 'B';
  filename: string;     // "TEF-A-01.png"
  instructions: string; // Full .md content
}
```

Removed fields: `title`, `annonce`, `consigne`, `generatedImagePath`, `generatedImagePaths`.

### `ExerciseService.loadTefExercises()`

- Replaces JSON file reading with directory scanning
- Scans `TEF-A/` and `TEF-B/` for `.md` files matching `TEF-{section}-{num}.md`
- Reads each `.md` file content as `instructions`
- Derives `id`, `section`, `filename` from the file name
- Caches in memory (lazy-loaded, same pattern as today)

### `ExamSessionService.buildExerciseData()`

- For `tef-section-a` and `tef-section-b`: `content` = the `.md` instructions text
- `description` = generic string per section ("Demande d'informations par telephone" for A, "Argumentation avec un(e) ami(e)" for B)

### `ExamSessionService.buildTefImagePayload()`

- Simplified: only `type`, `id`, `filename`, `section`
- No more `annonce`, `title`, `consigne`, `generatedImagePath`, `generatedImagePaths`

### `ExamSessionService.buildFullInstructions()`

- Same concatenation pattern: `YAML.baseInstructions + YAML.instructions + "\n\nEXERCICE A UTILISER:\n" + md_content`

## Shared Package Changes

### `ExerciseImagePayload` (`packages/shared/src/schemas/exam-session.ts`)

Simplified schema:
```typescript
{
  type: 'exerciseImage',
  id: string,
  filename: string,
  section: 'A' | 'B',
}
```

Removed: `annonce`, `title`, `consigne`, `generatedImagePath`, `generatedImagePaths`.

## Web Changes

### `ExerciseImageViewer` (`apps/web/components/app/exercise-image-viewer.tsx`)

- Remove overlay logic (markdown annonce, title/annonce text)
- Remove `useExerciseAnnonceMarkdown` hook usage
- Display image full-width with natural aspect ratio and vertical scroll:
  - Use `<img>` or `next/image` with `width={0} height={0} sizes="100vw"` and `className="w-full h-auto"`
  - Container: `overflow-y-auto` for scrollability
- Remove badges overlay
- Image src: `/tef-exercices/TEF-{A|B}/{filename}`

### `ConsigneTabContent`

- Simplified TEF branch: just renders `ExerciseImageViewer` without consigne text

### `session-view.tsx`

- `mapExerciseImage()` simplified for the reduced payload shape

### `ExerciseImageData` type (`apps/web/types/exercise-image.ts`)

- Matches simplified `ExerciseImagePayload`

## Cleanup

### Files/directories to remove
- `apps/api/config/tef-exercises.json` (replaced by .md files)
- `apps/web/public/tef-exercices/generated/` (no more generated images)
- `apps/web/content/tef-annonces/` (100 .md files, no more annonce markdown)
- `apps/web/hooks/useExerciseAnnonceMarkdown.ts` (no more overlay markdown)
- `apps/web/app/api/tef-annonce/[id]/route.ts` (API route that served annonce markdown)

### Scripts to remove from `apps/api/package.json`
- `extract-tef` / `apps/api/scripts/extract-tef-exercises.ts`
- `generate-tef-images` / `apps/api/scripts/generate-tef-images.ts`
- `generate-tef-annonces` / `apps/api/scripts/generate-tef-annonces.ts`
- `clean-tef-dimension-images`
- `reset-tef-images`

### New scripts to add to `apps/api/package.json`
- `"rename-tef": "tsx scripts/rename-tef-images.ts"`
- `"generate-tef-instructions": "tsx scripts/generate-tef-instructions.ts"`
- `"sync-tef": "tsx scripts/sync-tef-to-web.ts"`

## Constraints

- YAML files (`tef-section-a.yml`, `tef-section-b.yml`) keep general behavioral rules unchanged
- The `.md` content is exercise-specific only (role, context, known info, consigne)
- Images are shown as-is without text extraction or overlay
- The conversation starts immediately (Section A = phone call, Section B = friend conversation)
- After the exam and report, the agent switches to coaching mode (unchanged from current YAML)
