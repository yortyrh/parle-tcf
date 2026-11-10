import type { TaskType } from '@parle-tcf/shared';

export interface Task {
  id: number | string;
  title: string;
  description: string;
  taskType: TaskType;
}

export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  startButtonText: string;
  tasks: Task[];
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  pageTitle: 'parle-tcf',
  pageDescription: "Entraînement à l'expression orale du TCF avec un examinateur IA",
  startButtonText: 'Commencer',
  tasks: [
    {
      id: 1,
      title: 'Tâche 1',
      description:
        'Présentation de soi, puis un entretien dirigé, exercice de conversation sur des sujets quotidiens',
      taskType: 'tache1',
    },
    {
      id: 2,
      title: 'Tâche 2',
      description:
        'Jeux de rôles, où on pose des questions pour obtenir des informations sur une situation quotidienne',
      taskType: 'tache2',
    },
    {
      id: 3,
      title: 'Tâche 3',
      description:
        "Présentation d'un sujet, souvent lié à la vie quotidienne ou des débats de société",
      taskType: 'tache3',
    },
  ],
};
