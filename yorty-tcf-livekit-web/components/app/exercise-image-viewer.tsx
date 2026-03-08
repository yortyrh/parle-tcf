'use client';

import Image from 'next/image';
import type { ExerciseImageData } from '@/hooks/useExerciseImage';

interface ExerciseImageViewerProps {
  exerciseImage: ExerciseImageData | null;
}

export function ExerciseImageViewer({ exerciseImage }: ExerciseImageViewerProps) {
  if (!exerciseImage) return null;

  const { filename, section, annonce, title, consigne, generatedImagePath } = exerciseImage;

  const folder = section === 'A' ? 'TEF-A' : 'TEF-B';
  const imageSrc =
    generatedImagePath != null
      ? `/tef-exercices/${generatedImagePath}`
      : `/tef-exercices/${folder}/${filename}`;

  const hasAnnonce = title || annonce;

  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* 1. Présentation — consigne, en premier */}
      {consigne && (
        <div className="border-border bg-card text-foreground rounded-lg border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {consigne}
        </div>
      )}

      {/* 2. Image + cadre annonce (toujours visible) — occupe l'espace disponible */}
      <div className="border-border bg-card relative min-w-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        <div className="relative aspect-[4/3] w-full max-w-[480px]">
          <Image
            src={imageSrc}
            alt={title ? `Annonce: ${title}` : 'Annonce TEF'}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 500px"
            unoptimized
          />
          {hasAnnonce && (
            <div className="border-border/80 bg-card absolute right-2 bottom-2 max-w-[60%] rounded-md border px-3 py-2.5 text-xs shadow-md">
              {title && <p className="text-card-foreground font-bold">{title}</p>}
              {annonce && (
                <p className="text-muted-foreground mt-0.5 leading-snug whitespace-pre-wrap">
                  {annonce}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
