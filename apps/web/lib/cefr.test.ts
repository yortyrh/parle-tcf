import { describe, expect, it } from 'vitest';
import { CEFR_LEVELS } from '@parle-tcf/shared';
import { ERROR_STYLES, LEVEL_STYLES, TASK_LABELS, formatCost, formatDuration } from './cefr';

describe('formatCost', () => {
  it('shows a dash when the cost is unknown', () => {
    expect(formatCost(null)).toBe('—');
  });

  it('shows "< 0,01 $" below one cent, including zero', () => {
    expect(formatCost(0)).toBe('< 0,01 $');
    expect(formatCost(0.0099)).toBe('< 0,01 $');
  });

  it('uses a French decimal comma with two decimals from one cent', () => {
    expect(formatCost(0.01)).toBe('0,01 $');
    expect(formatCost(1.5)).toBe('1,50 $');
    expect(formatCost(12.345)).toBe('12,35 $');
  });
});

describe('formatDuration', () => {
  it('shows a dash when the duration is unknown', () => {
    expect(formatDuration(null)).toBe('—');
  });

  it('formats minutes and zero-padded seconds', () => {
    expect(formatDuration(0)).toBe('0 min 00 s');
    expect(formatDuration(59)).toBe('0 min 59 s');
    expect(formatDuration(60)).toBe('1 min 00 s');
    expect(formatDuration(125)).toBe('2 min 05 s');
  });
});

describe('style tables', () => {
  it('has a style for every CEFR level and every error type', () => {
    for (const level of CEFR_LEVELS) expect(LEVEL_STYLES[level]).toMatch(/^bg-/);
    expect(Object.keys(ERROR_STYLES).sort()).toEqual(
      ['grammaire', 'lexique', 'registre', 'syntaxe'].sort()
    );
  });

  it('labels the three tasks', () => {
    expect(TASK_LABELS[1]).toBe('Tâche 1 · Entretien');
    expect(TASK_LABELS[2]).toBe('Tâche 2 · Interaction');
    expect(TASK_LABELS[3]).toBe('Tâche 3 · Point de vue');
  });
});
