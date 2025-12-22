'use client';

import { useState } from 'react';

interface TCFSelectorProps {
  initialTaskType?: 'tache1' | 'tache2' | 'tache3';
  onSelect: (taskType: 'tache1' | 'tache2' | 'tache3') => void;
  className?: string;
}

const taskInfo = {
  tache1: {
    title: 'Tâche 1',
    subtitle: 'Expression Orale',
    description: 'Conversation sur des sujets quotidiens',
    examDuration: '2 min'
  },
  tache2: {
    title: 'Tâche 2',
    subtitle: 'Interaction',
    description: 'Jeu de rôle et situations pratiques',
    examDuration: '3-4 min'
  },
  tache3: {
    title: 'Tâche 3',
    subtitle: 'Expression d\'Opinion',
    description: 'Analyse et argumentation',
    examDuration: '4-5 min'
  }
};

export const TCFSelector = ({ 
  initialTaskType = 'tache1', 
  onSelect, 
  className 
}: TCFSelectorProps) => {
  const [selectedTask, setSelectedTask] = useState<'tache1' | 'tache2' | 'tache3'>(initialTaskType);

  const handleTaskChange = (task: 'tache1' | 'tache2' | 'tache3') => {
    setSelectedTask(task);
    onSelect(task);
  };

  return (
    <div className={className}>
      {/* Task Selection */}
      <div className="mb-6">
        <p className="text-foreground mb-3 text-sm font-medium">Choisissez la tâche :</p>
        <div className="flex gap-3 justify-center flex-wrap">
          {(['tache1', 'tache2', 'tache3'] as const).map((task) => (
            <button
              key={task}
              onClick={() => handleTaskChange(task)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedTask === task
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <div className="text-center">
                <div className="font-bold text-sm">{taskInfo[task].title}</div>
                <div className="text-xs opacity-90">{taskInfo[task].subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

