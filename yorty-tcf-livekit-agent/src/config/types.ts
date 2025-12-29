// Types pour la configuration des agents TCF

export type TaskType = 'tache1' | 'tache2' | 'tache3';

// Types pour la configuration du service
export interface ServiceConfig {
  llm: {
    provider: string;
    model: string;
    voice: string;
    modalities: string[];
  };
  session: {
    metricsEnabled: boolean;
    inputOptions: {
      noiseCancellation: string;
    };
  };
  connection: {
    participantWaitTime: number;
    disconnectDelay: number;
  };
  endExamMessage: {
    instructions: string;
  };
}

export interface AgentSettings {
  allowInterruptions: boolean;
  voice: string;
}

export interface Durations {
  preparation: number;
  exam: number;
}

export interface AgentConfig {
  name: string;
  description: string;
  settings: AgentSettings;
  durations: Durations;
  baseInstructions: string;
  instructions: string;
  greeting: string;
}

