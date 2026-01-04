'use client';

import React from 'react';
import { X } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReportViewerProps {
  report: string | null;
  onClose?: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

/**
 * Composant pour afficher le rapport de l'examinateur
 */
export function ReportViewer({ report, onClose, isMinimized, onToggleMinimize }: ReportViewerProps) {
  if (!report || isMinimized) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📋</div>
            <h2 className="text-xl font-bold text-gray-900">
              Rapport d'évaluation
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMinimize}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Minimiser"
            >
              <span className="text-xl">−</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <p className="text-sm text-gray-600 text-center">
            Vous pouvez continuer à discuter avec l'examinateur pendant la lecture du rapport
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Bouton pour afficher le rapport minimisé
 */
export function ReportButton({ 
  report, 
  onExpand 
}: { 
  report: string | null; 
  onExpand: () => void;
}) {
  if (!report) {
    return null;
  }

  return (
    <button
      onClick={onExpand}
      className="bg-cyan-600 text-white px-3 py-1.5 rounded-lg shadow-md hover:bg-cyan-700 transition-colors flex items-center gap-2 text-sm"
    >
      <span>📋</span>
      <span className="font-medium">Rapport</span>
    </button>
  );
}