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
  taskTitle?: string;
  taskDescription?: string;
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
  taskTitle: 'Tâche 1',
  taskDescription: 'Exercice de compréhension orale',
};
