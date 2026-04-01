'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowCounterClockwise, CaretLeft, CircleNotch, X } from '@phosphor-icons/react';

interface ReportViewerProps {
  report: string | null;
  previousReports?: string[];
  onClose?: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onRestart?: () => void;
}

export function ReportViewer({
  report,
  previousReports = [],
  onClose,
  isMinimized,
  onToggleMinimize,
  onRestart,
}: ReportViewerProps) {
  const [viewingPreviousIndex, setViewingPreviousIndex] = useState<number | null>(null);

  if (!report || isMinimized) {
    return null;
  }

  const displayedReport =
    viewingPreviousIndex !== null ? previousReports[viewingPreviousIndex] : report;
  const isViewingPrevious = viewingPreviousIndex !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            {isViewingPrevious && (
              <button
                onClick={() => setViewingPreviousIndex(null)}
                className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
                title="Retour au rapport actuel"
              >
                <CaretLeft size={20} weight="bold" className="text-gray-600" />
              </button>
            )}
            <div className="text-2xl">📋</div>
            <h2 className="text-xl font-bold text-gray-900">
              {isViewingPrevious
                ? `Rapport précédent (essai ${viewingPreviousIndex! + 1})`
                : "Rapport d'évaluation"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMinimize}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              title="Minimiser"
            >
              <span className="text-xl">−</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                title="Fermer"
              >
                <X size={20} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="prose prose-cyan prose-headings:text-cyan-800 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:text-gray-700 prose-li:leading-relaxed max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayedReport ?? ''}</ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-b-2xl border-t border-gray-200 bg-gray-50 px-6 py-4">
          <p className="mb-3 text-center text-sm text-gray-600">
            Vous pouvez continuer à discuter avec l&apos;examinateur pour éclaircir vos doutes
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {previousReports.length > 0 && !isViewingPrevious && (
              <div className="flex items-center gap-1.5">
                {previousReports.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setViewingPreviousIndex(index)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
                  >
                    Essai {index + 1}
                  </button>
                ))}
              </div>
            )}
            {onRestart && !isViewingPrevious && (
              <button
                onClick={onRestart}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-cyan-700"
              >
                <ArrowCounterClockwise size={16} weight="bold" />
                Recommencer le test
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportPreparingBanner() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-amber-200/60 bg-gradient-to-b from-amber-50 to-orange-50/60 px-6 py-8 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-100/50">
        <CircleNotch size={28} weight="bold" className="animate-spin text-amber-600" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-amber-900">Rapport en cours de préparation</p>
        <p className="mt-1 text-sm text-amber-700/80">
          Veuillez patienter, votre rapport détaillé arrive dans quelques instants.
        </p>
      </div>
    </div>
  );
}

export function ReportButton({
  report,
  isPreparing,
  onExpand,
}: {
  report: string | null;
  isPreparing?: boolean;
  onExpand: () => void;
}) {
  if (isPreparing) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-sm text-white shadow-md">
        <CircleNotch size={16} weight="bold" className="animate-spin" />
        <span className="font-medium">Rapport en préparation...</span>
      </span>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <button
      onClick={onExpand}
      className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm text-white shadow-md transition-colors hover:bg-cyan-700"
    >
      <span>📋</span>
      <span className="font-medium">Rapport</span>
    </button>
  );
}
