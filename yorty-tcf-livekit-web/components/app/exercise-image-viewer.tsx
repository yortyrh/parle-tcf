'use client';

import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import remarkGfm from 'remark-gfm';
import { useExerciseAnnonceMarkdown } from '@/hooks/useExerciseAnnonceMarkdown';
import type { ExerciseImageData } from '@/hooks/useExerciseImage';

interface ExerciseImageViewerProps {
  exerciseImage: ExerciseImageData | null;
  /** Badges shown as overlay on the image (section + type) */
  badges?: { section: string; type: string };
}

export function ExerciseImageViewer({ exerciseImage, badges }: ExerciseImageViewerProps) {
  const { markdown, loading } = useExerciseAnnonceMarkdown(exerciseImage?.id ?? null);

  if (!exerciseImage) return null;

  const { filename, section, annonce, title, consigne, generatedImagePath } = exerciseImage;

  const folder = section === 'A' ? 'TEF-A' : 'TEF-B';
  const imageSrc =
    generatedImagePath != null
      ? `/tef-exercices/${generatedImagePath}`
      : `/tef-exercices/${folder}/${filename}`;

  const hasBadges = badges && (badges.section || badges.type);

  const overlayContent =
    markdown && !loading ? (
      <div className="prose prose-sm prose-foreground prose-headings:font-bold prose-headings:text-foreground prose-p:my-0.5 prose-p:text-muted-foreground prose-ul:my-1 prose-li:leading-snug max-w-none [&_h1]:mb-1 [&_h1]:text-base">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    ) : title || annonce ? (
      <>
        {title && <p className="text-foreground font-bold">{title}</p>}
        {annonce && (
          <p className="text-muted-foreground mt-0.5 leading-snug whitespace-pre-wrap">{annonce}</p>
        )}
      </>
    ) : null;

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
      {/* 1. Présentation — consigne, en premier */}
      {consigne && (
        <div className="bg-card text-foreground shrink-0 rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {consigne}
        </div>
      )}

      {/* 2. Image carrée 1024×1024 (mobile + desktop) */}
      <div className="border-border bg-card relative flex min-h-[200px] min-w-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        <div className="relative size-full">
          <Image
            src={imageSrc}
            alt={title ? `Annonce: ${title}` : 'Annonce TEF'}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 1024px"
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
          {overlayContent && (
            <div className="border-border/80 absolute right-2 bottom-2 left-2 z-10 max-h-full w-[calc(100%-1rem)] overflow-y-auto rounded-md border bg-white/85 px-3 py-2.5 text-sm shadow-md backdrop-blur-sm sm:right-2 sm:left-auto sm:w-auto sm:max-w-[60%]">
              {overlayContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
