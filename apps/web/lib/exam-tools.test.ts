import { describe, expect, it } from 'vitest';
import { EXAM_TOOL_DESCRIPTIONS } from './exam-tools';

describe('EXAM_TOOL_DESCRIPTIONS', () => {
  it('describes exactly the two exam tools', () => {
    expect(Object.keys(EXAM_TOOL_DESCRIPTIONS).sort()).toEqual(['finSession', 'recommencerTest']);
  });

  it('lets finSession close the exam only once, after the closing sentence', () => {
    expect(EXAM_TOOL_DESCRIPTIONS.finSession).toBe(
      "Clôt l'épreuve. À appeler une seule fois, juste après avoir dit « Merci, l'épreuve est terminée. », quand le temps est écoulé ou que le candidat demande d'arrêter. Ne jamais appeler pendant l'épreuve."
    );
  });

  it('lets recommencerTest restart only on an explicit request', () => {
    expect(EXAM_TOOL_DESCRIPTIONS.recommencerTest).toBe(
      "Recommence l'épreuve depuis le début. À appeler uniquement si le candidat demande explicitement de recommencer l'épreuve, jamais pour une hésitation ou une reformulation."
    );
  });
});
