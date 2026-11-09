'use client';

import React from 'react';

interface ConsigneTabContentProps {
  announcementText: string;
  showExerciseSkeleton: boolean;
  showMicHint: boolean;
}

export const ConsigneTabContent = React.memo(function ConsigneTabContent({
  announcementText,
  showExerciseSkeleton,
  showMicHint,
}: ConsigneTabContentProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      {showExerciseSkeleton && (
        <div className="flex min-h-[88px] animate-pulse items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-50/70 px-4 py-3 shadow-sm">
          <div className="flex w-full flex-col items-center gap-2.5">
            <div className="h-4 w-4/5 rounded-md bg-cyan-200/70" />
            <div className="h-4 w-full rounded-md bg-cyan-200/70" />
            <div className="h-4 w-3/5 rounded-md bg-cyan-200/70" />
          </div>
        </div>
      )}

      {!showExerciseSkeleton && (
        <div className="flex min-h-[88px] items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-50/70 px-4 py-3 shadow-sm">
          <p className="text-center text-base leading-relaxed font-semibold text-cyan-700">
            {announcementText}
          </p>
        </div>
      )}

      {showMicHint &&
        (showExerciseSkeleton ? (
          <div className="mt-auto rounded-xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 shadow-sm">
            <div className="flex animate-pulse flex-col gap-2.5">
              <div className="h-4 w-1/3 rounded-md bg-amber-200/80" />
              <div className="h-4 w-full rounded-md bg-amber-200/80" />
              <div className="h-4 w-5/6 rounded-md bg-amber-200/80" />
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="mt-auto rounded-xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-center text-amber-950 shadow-sm"
          >
            <p className="text-sm font-semibold">Micro désactivé</p>
            <p className="mt-1 text-sm text-amber-900/90">
              L&apos;examinateur parle en premier pour expliquer l&apos;exercice ; le micro sert
              uniquement à ce qu&apos;il vous entende quand vous répondez. Activez-le dans la barre
              du bas lorsque vous êtes prêt·e à prendre la parole.
            </p>
          </div>
        ))}
    </div>
  );
});
