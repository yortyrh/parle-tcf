'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { ExerciseImageData } from '@/hooks/useExerciseImage';

/**
 * Sélectionne la variante d'image adaptée à la largeur de la fenêtre.
 * Breakpoints alignés avec Tailwind : sm 640px, md 768px, lg 1024px.
 * - < 640px : portrait (1024x1536) pour mobile
 * - 640–1024px : carré (1024x1024) pour tablette
 * - >= 1024px : paysage (1536x1024) pour desktop
 */
function selectImageSizeForViewport(width: number, paths: Record<string, string>): string | null {
  if (width < 640 && paths['1024x1536']) return '1024x1536';
  if (width < 1024 && paths['1024x1024']) return '1024x1024';
  if (paths['1536x1024']) return '1536x1024';
  return paths['1024x1536'] ? '1024x1536' : (Object.keys(paths)[0] ?? null);
}

interface ExerciseImageViewerProps {
  exerciseImage: ExerciseImageData | null;
  /** Badges shown as overlay on the image (section + type) */
  badges?: { section: string; type: string };
}

export function ExerciseImageViewer({ exerciseImage, badges }: ExerciseImageViewerProps) {
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const update = () => setViewportWidth(typeof window !== 'undefined' ? window.innerWidth : 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!exerciseImage) return null;

  const { filename, section, annonce, title, consigne, generatedImagePath, generatedImagePaths } =
    exerciseImage;

  const folder = section === 'A' ? 'TEF-A' : 'TEF-B';
  const hasMultipleSizes = generatedImagePaths && Object.keys(generatedImagePaths).length > 1;

  let imageSrc: string;
  if (hasMultipleSizes && generatedImagePaths) {
    const sizeKey = selectImageSizeForViewport(viewportWidth, generatedImagePaths);
    const path = sizeKey ? generatedImagePaths[sizeKey] : null;
    imageSrc = path
      ? `/tef-exercices/${path}`
      : generatedImagePath != null
        ? `/tef-exercices/${generatedImagePath}`
        : `/tef-exercices/${folder}/${filename}`;
  } else if (generatedImagePath != null) {
    imageSrc = `/tef-exercices/${generatedImagePath}`;
  } else {
    imageSrc = `/tef-exercices/${folder}/${filename}`;
  }

  const hasAnnonce = title || annonce;
  const hasBadges = badges && (badges.section || badges.type);

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
      {/* 1. Présentation — consigne, en premier */}
      {consigne && (
        <div className="bg-card text-foreground shrink-0 rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {consigne}
        </div>
      )}

      {/* 2. Image + cadre annonce — variante auto-sélectionnée selon la largeur d'écran */}
      <div className="border-border bg-card relative flex min-h-[200px] min-w-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        <div className="relative size-full">
          <Image
            src={imageSrc}
            alt={title ? `Annonce: ${title}` : 'Annonce TEF'}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 860px"
            unoptimized
          />
          {/* Badges overlay — top-left, ~80% opacity */}
          {hasBadges && (
            <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-2">
              {badges.section && (
                <span className="inline-flex items-center rounded bg-cyan-700/50 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-cyan-600/20 backdrop-blur-sm ring-inset sm:px-2 sm:py-1 sm:text-xs">
                  {badges.section}
                </span>
              )}
              {badges.type && (
                <span className="inline-flex items-center rounded bg-cyan-600/50 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-cyan-500/20 backdrop-blur-sm ring-inset sm:px-2 sm:py-1 sm:text-xs">
                  {badges.type}
                </span>
              )}
            </div>
          )}
          {hasAnnonce && (
            <div className="border-border/80 absolute right-2 bottom-2 left-2 z-10 w-[calc(100%-1rem)] rounded-md border bg-white/85 px-3 py-2.5 text-sm shadow-md backdrop-blur-sm sm:right-2 sm:left-auto sm:w-auto sm:max-w-[60%]">
              {title && <p className="text-foreground font-bold">{title}</p>}
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
