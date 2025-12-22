// Types pour la configuration des agents TCF

export type TaskType = 'tache1' | 'tache2' | 'tache3';
export type Mode = 'exam';

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
  disconnectDelay?: number; // Délai avant de déconnecter le participant après la fin de l'examen
  exam: number;
}

export interface ModeConfig {
  instructions: string;
  greeting: string;
  endExamMessage?: string;
  feedbackTechniques?: string[];
}

export interface AgentConfig {
  name: string;
  description: string;
  settings: AgentSettings;
  durations: Durations;
  baseInstructions: string;
  examMode: ModeConfig;
  sampleQuestions?: Record<string, string[]>;
  scenarios?: Record<string, unknown>;
  topics?: Record<string, string[]>;
  argumentStructure?: Record<string, string[]>;
  argumentationVocabulary?: Record<string, string[]>;
  usefulPhrases?: Record<string, string[]>;
  followUpQuestions?: string[];
}

