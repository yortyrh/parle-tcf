'use client';

import React, { useMemo } from 'react';
import { CircleNotch } from '@phosphor-icons/react/dist/ssr';

const ReactMarkdown = React.lazy(() => import('react-markdown'));
const remarkGfm = import('remark-gfm').then((m) => m.default);
let _remarkGfm: typeof import('remark-gfm').default | null = null;
remarkGfm.then((mod) => {
  _remarkGfm = mod;
});

interface ConseilsTabContentProps {
  report: string | null;
  previousReports: string[];
  isPreparingReport: boolean;
  /** Erreur ex. outil envoiRapport — évite un chargement infini sans message */
  reportDeliveryError: string | null;
  isReviewPhase: boolean;
  viewingPreviousIndex: number | null;
  onSetViewingPreviousIndex: (index: number | null) => void;
}

function MarkdownReport({ content }: { content: string }) {
  const plugins = useMemo(() => (_remarkGfm ? [_remarkGfm] : []), []);
  return (
    <React.Suspense
      fallback={
        <div className="flex animate-pulse flex-col gap-2 py-4">
          <div className="bg-muted h-4 w-3/4 rounded" />
          <div className="bg-muted h-4 w-full rounded" />
          <div className="bg-muted h-4 w-5/6 rounded" />
        </div>
      }
    >
      <ReactMarkdown remarkPlugins={plugins}>{content}</ReactMarkdown>
    </React.Suspense>
  );
}

export const ConseilsTabContent = React.memo(function ConseilsTabContent({
  report,
  previousReports,
  isPreparingReport,
  reportDeliveryError,
  isReviewPhase,
  viewingPreviousIndex,
  onSetViewingPreviousIndex,
}: ConseilsTabContentProps) {
  const fallbackReport =
    !report && previousReports.length > 0 ? previousReports[previousReports.length - 1] : null;

  const activeReport = report ?? fallbackReport;
  const isFallback = !report && !!fallbackReport;

  const displayedReport =
    viewingPreviousIndex !== null ? previousReports[viewingPreviousIndex] : activeReport;
  const isViewingPrevious = viewingPreviousIndex !== null;

  const showPreviousButtons = !isViewingPrevious && previousReports.length > (isFallback ? 1 : 0);

  const showTopBar = isViewingPrevious || showPreviousButtons;

  const topBar = showTopBar ? (
    <div className="sticky top-0 z-10 -mx-3 flex items-center gap-1.5 border-b border-gray-100 bg-white px-3 py-2 sm:-mx-4 sm:px-4">
      {isViewingPrevious ? (
        <>
          <button
            onClick={() => onSetViewingPreviousIndex(null)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-cyan-700 ring-1 ring-cyan-300/50 transition-colors hover:bg-cyan-50"
          >
            ← Retour
          </button>
          <span className="text-muted-foreground text-xs">Essai {viewingPreviousIndex! + 1}</span>
        </>
      ) : (
        previousReports
          .slice(0, isFallback ? previousReports.length - 1 : previousReports.length)
          .map((_, index) => (
            <button
              key={index}
              onClick={() => onSetViewingPreviousIndex(index)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
            >
              Essai {index + 1}
            </button>
          ))
      )}
    </div>
  ) : null;

  if (reportDeliveryError) {
    return (
      <div className="flex flex-col gap-4">
        {topBar}
        <div
          role="alert"
          className="mx-auto flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/95 px-5 py-6 text-red-950 shadow-sm"
        >
          <p className="text-base font-semibold">Le rapport n&apos;a pas pu être reçu</p>
          <p className="text-sm text-red-900/90">{reportDeliveryError}</p>
          <p className="text-sm text-red-800/85">
            Cela arrive parfois lors de l&apos;envoi technique du rapport. Utilisez{' '}
            <strong>Recommencer</strong> en haut pour relancer une session, ou <strong>RACCROCHER</strong>{' '}
            puis démarrez une nouvelle épreuve.
          </p>
        </div>
      </div>
    );
  }

  if (isPreparingReport) {
    return (
      <div className="flex flex-col gap-4">
        {topBar}
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-100/50">
            <CircleNotch size={28} weight="bold" className="animate-spin text-amber-600" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-amber-900">
              Rapport en cours de préparation
            </p>
            <p className="mt-1 text-sm text-amber-700/80">
              Veuillez patienter, votre rapport détaillé arrive dans quelques instants.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!activeReport) {
    return (
      <div className="flex flex-col gap-4">
        {topBar}
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-muted-foreground text-sm">Aucun rapport disponible pour le moment.</p>
          <p className="text-muted-foreground/70 text-xs">
            Le rapport apparaîtra ici à la fin de la session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {topBar}

      {isReviewPhase && !isFallback && !isViewingPrevious && (
        <div
          role="status"
          className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-3 text-center text-emerald-950 shadow-sm"
        >
          <p className="text-sm font-semibold">Phase de discussion</p>
          <p className="mt-1 text-sm text-emerald-900/90">
            Votre micro est activé. Posez vos questions à l&apos;examinateur pour éclaircir vos
            doutes sur le rapport et votre évaluation.
          </p>
        </div>
      )}

      {isFallback && !isViewingPrevious && (
        <div
          role="status"
          className="rounded-xl border border-sky-200/80 bg-sky-50/95 px-3 py-2 text-sky-900 shadow-sm"
        >
          <p className="text-xs">
            Rapport de l&apos;essai précédent — un nouveau rapport sera disponible à la fin de cette
            session.
          </p>
        </div>
      )}

      <div className="prose prose-cyan prose-headings:text-cyan-800 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:font-semibold prose-strong:text-gray-900 prose-ul:text-gray-700 prose-li:leading-relaxed max-w-none text-sm">
        <MarkdownReport content={displayedReport ?? ''} />
      </div>
    </div>
  );
});
