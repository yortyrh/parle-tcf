/**
 * Descriptions of the client-side exam tools, shared by both voice providers so the
 * examiner gets the same "when to call / when not to" rules (provider prompting guides).
 */
export const EXAM_TOOL_DESCRIPTIONS = {
  finSession:
    "Clôt l'épreuve. À appeler une seule fois, juste après avoir dit « Merci, l'épreuve est terminée. », quand le temps est écoulé ou que le candidat demande d'arrêter. Ne jamais appeler pendant l'épreuve.",
  recommencerTest:
    "Recommence l'épreuve depuis le début. À appeler uniquement si le candidat demande explicitement de recommencer l'épreuve, jamais pour une hésitation ou une reformulation.",
} as const;
