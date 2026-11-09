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
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  agentName?: string;

  // Task information
  tasks: Task[];
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'TCF Agent',
  pageTitle: 'TCF Voice Agent',
  pageDescription: 'A voice agent for TCF exercises',

  supportsChatInput: true,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,

  logo: '/logo.png',
  accent: '#06b6d4', // Cyan turquoise from logo
  logoDark: '/logo.png',
  accentDark: '#3dd6d0', // Lighter cyan for dark mode
  startButtonText: 'Commencer',

  agentName: undefined,

  // Task information
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
