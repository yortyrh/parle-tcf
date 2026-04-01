export type { TaskType } from '@yorty-tcf/shared';

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
    participantJoinPollIntervalMs?: number;
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

export interface AgentConfig {
  name: string;
  description: string;
  settings: AgentSettings;
  baseInstructions: string;
  instructions: string;
  greeting: string;
}
