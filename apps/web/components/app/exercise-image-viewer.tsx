'use client';

import type { ExerciseImageData } from '@/types/exercise-image';

interface ExerciseImageViewerProps {
  exerciseImage: ExerciseImageData | null;
}

/**
 * Shows the TEF exercise scan at full width; vertical scroll when taller than the viewport.
 */
export function ExerciseImageViewer({ exerciseImage }: ExerciseImageViewerProps) {
  if (!exerciseImage) return null;

  const { filename, section, id } = exerciseImage;
  const folder = section === 'A' ? 'TEF-A' : 'TEF-B';
  const src = `/tef-exercices/${folder}/${filename}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-0 bg-card min-h-0 min-w-0 flex-1 overflow-y-auto rounded-none pt-4 shadow-md ring-1 ring-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element -- natural dimensions, full-width scroll */}
        <img
          src={src}
          alt={`Exercice ${id}`}
          className="block h-auto w-full max-w-full"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
