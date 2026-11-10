export type SessionPhase =
  | 'preparing'
  | 'connecting'
  | 'idle'
  | 'ended'
  | 'examiner-speaking'
  | 'muted'
  | 'candidate-speaking'
  | 'listening';

export const SESSION_PHASE_LABELS: Record<SessionPhase, string> = {
  preparing: 'Préparation',
  connecting: 'Connexion…',
  idle: 'Hors ligne',
  ended: 'Tâche terminée',
  'examiner-speaking': 'L’examinateur parle',
  muted: 'Micro coupé',
  'candidate-speaking': 'Vous parlez',
  listening: 'À vous',
};

export interface SessionPhaseInput {
  preparing: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  sessionEnded: boolean;
  agentSpeaking: boolean;
  userSpeaking: boolean;
  micEnabled: boolean;
}

/** One state for the session header; the first matching rule wins. */
export function sessionPhase(s: SessionPhaseInput): SessionPhase {
  if (s.preparing) return 'preparing';
  if (s.isConnecting) return 'connecting';
  if (!s.isConnected) return 'idle';
  if (s.sessionEnded) return 'ended';
  if (s.agentSpeaking) return 'examiner-speaking';
  if (!s.micEnabled) return 'muted';
  if (s.userSpeaking) return 'candidate-speaking';
  return 'listening';
}
