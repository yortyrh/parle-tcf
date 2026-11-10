import { describe, expect, it } from 'vitest';
import {
  attemptDetailSchema,
  attemptIdInputSchema,
  attemptSummarySchema,
  checkpointAttemptInputSchema,
  checkpointAttemptOutputSchema,
  completeAttemptInputSchema,
  examRunSchema,
  getRunInputSchema,
  listAttemptsInputSchema,
  listAttemptsOutputSchema,
  okOutputSchema,
  transcriptLineSchema,
  usageSchema,
} from './attempts';

const ATTEMPT = '22222222-2222-4222-8222-222222222222';
const RUN = '33333333-3333-4333-8333-333333333333';

const line = (seq: number, text = 'Bonjour') => ({ seq, speaker: 'candidate' as const, text });

const summary = {
  id: ATTEMPT,
  runId: null,
  mode: 'practice' as const,
  task: 2,
  exerciseId: null,
  status: 'completed' as const,
  evaluationStatus: 'done' as const,
  startedAt: '2026-03-10T10:00:00.000Z',
  finishedAt: '2026-03-10T10:05:00.000Z',
  durationS: 300,
  model: 'gpt-realtime-mini',
  globalLevel: 'B1' as const,
  estimatedCostUsd: 0.12,
};

describe('transcriptLineSchema', () => {
  it('accepts both speakers', () => {
    expect(transcriptLineSchema.parse({ seq: 0, speaker: 'examiner', text: 'Bonjour' })).toEqual({
      seq: 0,
      speaker: 'examiner',
      text: 'Bonjour',
    });
    expect(transcriptLineSchema.safeParse(line(1)).success).toBe(true);
  });

  it('rejects an unknown speaker', () => {
    expect(transcriptLineSchema.safeParse({ ...line(0), speaker: 'assistant' }).success).toBe(
      false
    );
  });

  it('accepts seq 0 and rejects negative or fractional seq', () => {
    expect(transcriptLineSchema.safeParse(line(0)).success).toBe(true);
    expect(transcriptLineSchema.safeParse(line(-1)).success).toBe(false);
    expect(transcriptLineSchema.safeParse(line(1.5)).success).toBe(false);
  });

  it('requires a non-empty text of at most 20 000 characters', () => {
    expect(transcriptLineSchema.safeParse(line(0, '')).success).toBe(false);
    expect(transcriptLineSchema.safeParse(line(0, 'a'.repeat(20_000))).success).toBe(true);
    expect(transcriptLineSchema.safeParse(line(0, 'a'.repeat(20_001))).success).toBe(false);
  });
});

describe('attempt id inputs', () => {
  it('require a uuid', () => {
    expect(attemptIdInputSchema.parse({ attemptId: ATTEMPT })).toEqual({ attemptId: ATTEMPT });
    expect(attemptIdInputSchema.safeParse({ attemptId: 'not-a-uuid' }).success).toBe(false);
    expect(attemptIdInputSchema.safeParse({}).success).toBe(false);
    expect(getRunInputSchema.parse({ runId: RUN })).toEqual({ runId: RUN });
    expect(getRunInputSchema.safeParse({ runId: '42' }).success).toBe(false);
  });
});

describe('checkpointAttemptInputSchema', () => {
  it('accepts an empty batch of lines', () => {
    expect(checkpointAttemptInputSchema.parse({ attemptId: ATTEMPT, lines: [] })).toEqual({
      attemptId: ATTEMPT,
      lines: [],
    });
  });

  it('caps a batch at 1000 lines', () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => line(i));
    expect(
      checkpointAttemptInputSchema.safeParse({ attemptId: ATTEMPT, lines: lines(1000) }).success
    ).toBe(true);
    expect(
      checkpointAttemptInputSchema.safeParse({ attemptId: ATTEMPT, lines: lines(1001) }).success
    ).toBe(false);
  });

  it('rejects a non-uuid attempt id and invalid lines', () => {
    expect(checkpointAttemptInputSchema.safeParse({ attemptId: 'x', lines: [] }).success).toBe(
      false
    );
    expect(
      checkpointAttemptInputSchema.safeParse({ attemptId: ATTEMPT, lines: [line(0, '')] }).success
    ).toBe(false);
  });

  it('output requires ok: true and a limitReached flag', () => {
    expect(checkpointAttemptOutputSchema.parse({ ok: true, limitReached: false })).toEqual({
      ok: true,
      limitReached: false,
    });
    expect(
      checkpointAttemptOutputSchema.safeParse({ ok: false, limitReached: false }).success
    ).toBe(false);
    expect(checkpointAttemptOutputSchema.safeParse({ ok: true }).success).toBe(false);
  });
});

describe('completeAttemptInputSchema', () => {
  it('makes usage optional', () => {
    expect(completeAttemptInputSchema.parse({ attemptId: ATTEMPT, lines: [] })).toEqual({
      attemptId: ATTEMPT,
      lines: [],
    });
  });

  it('accepts zero tokens and rejects negative or fractional counts', () => {
    const withUsage = (inputTokens: number, outputTokens: number) =>
      completeAttemptInputSchema.safeParse({
        attemptId: ATTEMPT,
        lines: [],
        usage: { inputTokens, outputTokens },
      }).success;
    expect(withUsage(0, 0)).toBe(true);
    expect(withUsage(-1, 0)).toBe(false);
    expect(withUsage(0, -1)).toBe(false);
    expect(withUsage(1.5, 0)).toBe(false);
  });

  it('does not accept a client-side duration', () => {
    const parsed = completeAttemptInputSchema.parse({
      attemptId: ATTEMPT,
      lines: [],
      durationS: 9999,
    });
    expect(parsed).not.toHaveProperty('durationS');
  });
});

describe('listAttemptsInputSchema', () => {
  it('defaults to the first 20 attempts', () => {
    expect(listAttemptsInputSchema.parse({})).toEqual({ limit: 20, offset: 0 });
  });

  it('bounds limit to 1..100', () => {
    expect(listAttemptsInputSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(listAttemptsInputSchema.parse({ limit: 1 }).limit).toBe(1);
    expect(listAttemptsInputSchema.parse({ limit: 100 }).limit).toBe(100);
    expect(listAttemptsInputSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('rejects a negative offset', () => {
    expect(listAttemptsInputSchema.parse({ offset: 0 }).offset).toBe(0);
    expect(listAttemptsInputSchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it('accepts tasks 1..3 and the two modes only', () => {
    expect(listAttemptsInputSchema.safeParse({ task: 0 }).success).toBe(false);
    expect(listAttemptsInputSchema.parse({ task: 1 }).task).toBe(1);
    expect(listAttemptsInputSchema.parse({ task: 3 }).task).toBe(3);
    expect(listAttemptsInputSchema.safeParse({ task: 4 }).success).toBe(false);
    expect(listAttemptsInputSchema.parse({ mode: 'full' }).mode).toBe('full');
    expect(listAttemptsInputSchema.safeParse({ mode: 'exam' }).success).toBe(false);
  });
});

describe('attempt outputs', () => {
  it('accepts a full summary and rejects unknown statuses', () => {
    expect(attemptSummarySchema.parse(summary)).toEqual(summary);
    expect(attemptSummarySchema.safeParse({ ...summary, status: 'deleted' }).success).toBe(false);
    expect(attemptSummarySchema.safeParse({ ...summary, evaluationStatus: 'queued' }).success).toBe(
      false
    );
    expect(attemptSummarySchema.safeParse({ ...summary, globalLevel: 'D1' }).success).toBe(false);
    expect(attemptSummarySchema.safeParse({ ...summary, task: 4 }).success).toBe(false);
  });

  it('accepts every attempt and evaluation status', () => {
    for (const status of ['in_progress', 'completed', 'interrupted'] as const) {
      expect(attemptSummarySchema.safeParse({ ...summary, status }).success).toBe(true);
    }
    for (const evaluationStatus of ['pending', 'running', 'done', 'failed'] as const) {
      expect(attemptSummarySchema.safeParse({ ...summary, evaluationStatus }).success).toBe(true);
    }
  });

  it('extends the summary with the transcript in the detail', () => {
    const detail = {
      ...summary,
      exercisePrompt: null,
      realtimeMinutes: 5,
      evaluation: null,
      transcript: [{ ...line(0), correctedText: null, errors: null }],
    };
    expect(attemptDetailSchema.parse(detail)).toEqual(detail);
    expect(attemptDetailSchema.safeParse({ ...detail, transcript: [line(0)] }).success).toBe(false);
  });

  it('wraps summaries in a paginated list and a run', () => {
    expect(listAttemptsOutputSchema.parse({ items: [summary], total: 1 })).toEqual({
      items: [summary],
      total: 1,
    });
    expect(listAttemptsOutputSchema.safeParse({ items: [], total: 1.5 }).success).toBe(false);
    const run = {
      id: RUN,
      mode: 'full' as const,
      startedAt: '2026-03-10T10:00:00.000Z',
      finishedAt: null,
      globalLevel: null,
      attempts: [summary],
    };
    expect(examRunSchema.parse(run)).toEqual(run);
    expect(examRunSchema.safeParse({ ...run, id: 'run-1' }).success).toBe(false);
  });

  it('validates usage and ok outputs', () => {
    const usage = {
      todayMinutes: 3,
      dailyMinutesLimit: 60,
      monthCostUsd: 1.2,
      monthlyCostLimitUsd: 10,
    };
    expect(usageSchema.parse(usage)).toEqual(usage);
    expect(usageSchema.safeParse({ ...usage, todayMinutes: '3' }).success).toBe(false);
    expect(okOutputSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(okOutputSchema.safeParse({ ok: false }).success).toBe(false);
  });
});
