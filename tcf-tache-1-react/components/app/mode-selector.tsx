'use client';

import { useState } from 'react';

interface ModeSelectorProps {
  onModeSelect: (mode: 'preparation' | 'exam') => void;
  className?: string;
}

export const ModeSelector = ({ onModeSelect, className }: ModeSelectorProps) => {
  const [selectedMode, setSelectedMode] = useState<'preparation' | 'exam'>('preparation');

  const handleModeChange = (mode: 'preparation' | 'exam') => {
    setSelectedMode(mode);
    onModeSelect(mode);
  };

  return (
    <div className={className}>
      <p className="text-foreground mb-4 text-sm font-medium">Choisissez le mode :</p>
      <div className="flex justify-center gap-4">
        <button
          onClick={() => handleModeChange('preparation')}
          className={`rounded-lg px-6 py-3 font-medium transition-all ${
            selectedMode === 'preparation'
              ? 'scale-105 bg-blue-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <div className="text-left">
            <div className="font-bold">Mode Préparation</div>
            <div className="text-xs opacity-90">Sans limite de temps</div>
          </div>
        </button>
        <button
          onClick={() => handleModeChange('exam')}
          className={`rounded-lg px-6 py-3 font-medium transition-all ${
            selectedMode === 'exam'
              ? 'scale-105 bg-blue-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <div className="text-left">
            <div className="font-bold">Mode Examen</div>
            <div className="text-xs opacity-90">Durée : 2 minutes</div>
          </div>
        </button>
      </div>
    </div>
  );
};
