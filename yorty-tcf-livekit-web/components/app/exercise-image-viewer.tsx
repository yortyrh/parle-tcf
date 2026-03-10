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
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
      {/* 1. Présentation — consigne, en premier */}
      {consigne && (
        <div className="bg-card/80 text-foreground border-border/60 shrink-0 rounded-xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm backdrop-blur-sm">
          {consigne}
        </div>
      )}

      {/* 2. Image carrée 1024×1024 (mobile + desktop) */}
      <div className="border-border/70 bg-card relative flex min-h-[200px] min-w-0 flex-1 overflow-hidden rounded-2xl border shadow-md ring-1 ring-black/5">
        <div className="relative size-full">
          <Image
            src={imageSrc}
            alt={title ? `Annonce: ${title}` : 'Annonce TEF'}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 1024px"
            unoptimized
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/5" />
          {/* Badges overlay — top-left, ~80% opacity */}
          {hasBadges && (
            <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-2">
              {badges.section && (
                <span className="inline-flex items-center rounded-md bg-cyan-700/80 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-cyan-600/40 backdrop-blur-sm ring-inset sm:px-2 sm:py-1 sm:text-xs">
                  {badges.section}
                </span>
              )}
              {badges.type && (
                <span className="inline-flex items-center rounded-md bg-cyan-600/80 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-cyan-500/40 backdrop-blur-sm ring-inset sm:px-2 sm:py-1 sm:text-xs">
                  {badges.type}
                </span>
              )}
            </div>
          )}
          {overlayContent && (
            <div className="border-border/70 absolute right-2 bottom-2 left-2 z-10 max-h-full w-[calc(100%-1rem)] overflow-y-auto rounded-lg border bg-white/92 px-3 py-2.5 text-sm shadow-lg backdrop-blur sm:right-2 sm:left-auto sm:w-auto sm:max-w-[60%]">
              {overlayContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
