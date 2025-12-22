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

  // for LiveKit Cloud Sandbox
  sandboxId?: string;
  agentName?: string;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'TCF Examinator',
  pageTitle: 'TCF Tâche 1 - Expression Orale',
  pageDescription: 'Test de Connaissance du Français - Tâche 1',

  supportsChatInput: false,
  supportsVideoInput: true,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,

  logo: '/lk-logo.svg',
  accent: '#0066cc',
  logoDark: '/lk-logo-dark.svg',
  accentDark: '#4da6ff',
  startButtonText: 'Commencer',

  // for LiveKit Cloud Sandbox
  sandboxId: undefined,
  agentName: undefined,
};
