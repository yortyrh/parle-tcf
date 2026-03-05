'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ExerciseImageData } from '@/hooks/useExerciseImage';

interface ExerciseImageViewerProps {
  exerciseImage: ExerciseImageData | null;
}

export function ExerciseImageViewer({ exerciseImage }: ExerciseImageViewerProps) {
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  if (!exerciseImage) return null;

  const { filename, section, annonce, title, generatedImagePath } = exerciseImage;

  // Pour l'instant : image générée si disponible et validée, sinon image scannée
  // generatedImagePath sera activé une fois la génération validée
  const USE_GENERATED = true; // images générées via gpt-image-1.5, validées par GPT-5.4
  const folder = section === 'A' ? 'TEF-A' : 'TEF-B';
  const imageSrc =
    USE_GENERATED && generatedImagePath
      ? `/tef-exercices/${generatedImagePath}`
      : `/tef-exercices/${folder}/${filename}`;

  return (
    <div className="mt-3 flex flex-col gap-3">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Annonce
      </span>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Texte de l'annonce */}
        {annonce && (
          <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            {title && <p className="mb-2 text-sm leading-snug font-bold text-gray-800">{title}</p>}
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">{annonce}</p>
          </div>
        )}

        {/* Image de l'annonce */}
        <button
          onClick={() => setIsImageExpanded(true)}
          className="group relative shrink-0 overflow-hidden rounded-lg border border-gray-200 shadow-sm transition-all hover:border-cyan-400 hover:shadow-md"
          title="Voir l'annonce en grand"
        >
          <Image
            src={imageSrc}
            alt={title ? `Annonce: ${title}` : 'Annonce TEF'}
            width={200}
            height={260}
            className="h-auto max-h-56 w-auto max-w-[200px] object-contain"
            unoptimized
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
            <span className="rounded bg-white/80 px-2 py-1 text-xs font-medium opacity-0 shadow transition-opacity group-hover:opacity-100">
              Agrandir
            </span>
          </div>
        </button>
      </div>

      {/* Overlay image plein écran */}
      {isImageExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsImageExpanded(false)}
        >
          <div className="relative max-h-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsImageExpanded(false)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg hover:bg-gray-100"
              aria-label="Fermer"
            >
              ✕
            </button>
            <Image
              src={imageSrc}
              alt={title ? `Annonce: ${title}` : 'Annonce TEF'}
              width={600}
              height={780}
              className="max-h-[85vh] w-auto rounded-lg object-contain shadow-2xl"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
