'use client';

import React from 'react';

interface ConsigneTabContentProps {
  announcementText: string;
  /** Picture some subjects rely on; shown under the instructions. */
  imageUrl?: string;
  showExerciseSkeleton: boolean;
  showMicHint: boolean;
}

export const ConsigneTabContent = React.memo(function ConsigneTabContent({
  announcementText,
  imageUrl,
  showExerciseSkeleton,
  showMicHint,
}: ConsigneTabContentProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      {showExerciseSkeleton && (
        <div className="border-primary/20 bg-primary/5 flex min-h-[88px] animate-pulse items-center justify-center rounded-xl border px-4 py-3 shadow-sm">
          <div className="flex w-full flex-col items-center gap-2.5">
            <div className="bg-primary/15 h-4 w-4/5 rounded-md" />
            <div className="bg-primary/15 h-4 w-full rounded-md" />
            <div className="bg-primary/15 h-4 w-3/5 rounded-md" />
          </div>
        </div>
      )}

      {!showExerciseSkeleton && (
        <div className="border-primary/20 bg-primary/5 flex min-h-[88px] items-center justify-center rounded-xl border px-4 py-3 shadow-sm">
          <p className="text-primary text-center text-base font-semibold leading-relaxed">
            {announcementText}
          </p>
        </div>
      )}

      {!showExerciseSkeleton && imageUrl && (
        // Remote image from the subject's source page; plain <img> avoids a Next image domain allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Document du sujet"
          loading="lazy"
          referrerPolicy="no-referrer"
          className="mx-auto max-h-80 w-auto rounded-lg border object-contain"
        />
      )}

      {showMicHint &&
        (showExerciseSkeleton ? (
          <div className="border-highlight/30 bg-highlight-soft mt-auto rounded-xl border px-4 py-3 shadow-sm">
            <div className="flex animate-pulse flex-col gap-2.5">
              <div className="bg-highlight/20 h-4 w-1/3 rounded-md" />
              <div className="bg-highlight/20 h-4 w-full rounded-md" />
              <div className="bg-highlight/20 h-4 w-5/6 rounded-md" />
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="border-highlight/30 bg-highlight-soft text-foreground mt-auto rounded-xl border px-4 py-3 text-center shadow-sm"
          >
            <p className="text-sm font-semibold">Micro désactivé</p>
            <p className="text-muted-foreground mt-1 text-sm">
              L&apos;examinateur parle en premier pour expliquer l&apos;exercice ; le micro sert
              uniquement à ce qu&apos;il vous entende quand vous répondez. Activez-le dans la barre
              du bas lorsque vous êtes prêt·e à prendre la parole.
            </p>
          </div>
        ))}
    </div>
  );
});
