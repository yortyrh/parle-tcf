'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ExerciseImageViewerProps {
  filename: string | null;
  section: 'A' | 'B' | null;
}

export function ExerciseImageViewer({ filename, section }: ExerciseImageViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!filename || !section) return null;

  const folder = section === 'A' ? 'TEF-A' : 'TEF-B';
  const src = `/tef-exercices/${folder}/${filename}`;

  return (
    <>
      {/* Thumbnail + expand button */}
      <div className="mt-3 flex flex-col items-start gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Annonce
        </span>
        <button
          onClick={() => setIsExpanded(true)}
          className="group relative overflow-hidden rounded-lg border border-gray-200 shadow-sm transition-all hover:border-cyan-400 hover:shadow-md"
          title="Voir l'annonce en grand"
        >
          <Image
            src={src}
            alt="Annonce TEF"
            width={320}
            height={220}
            className="h-auto max-h-48 w-auto max-w-xs object-contain"
            unoptimized
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
            <span className="rounded bg-white/80 px-2 py-1 text-xs font-medium opacity-0 shadow transition-opacity group-hover:opacity-100">
              Agrandir
            </span>
          </div>
        </button>
      </div>

      {/* Full-screen overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg hover:bg-gray-100"
              aria-label="Fermer"
            >
              ✕
            </button>
            <Image
              src={src}
              alt="Annonce TEF"
              width={900}
              height={700}
              className="max-h-[85vh] w-auto rounded-lg object-contain shadow-2xl"
              unoptimized
            />
          </div>
        </div>
      )}
    </>
  );
}
