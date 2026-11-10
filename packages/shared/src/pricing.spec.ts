import { describe, expect, it } from 'vitest';
import { MODEL_PRICES, estimateCost, estimateSessionCost } from './pricing';

describe('estimateCost', () => {
  it('weights input and output tokens by their own price per million', () => {
    // gpt-realtime-mini: 10 $ in, 20 $ out per million.
    expect(estimateCost('gpt-realtime-mini', 1_000_000, 0)).toBeCloseTo(10);
    expect(estimateCost('gpt-realtime-mini', 0, 1_000_000)).toBeCloseTo(20);
    expect(estimateCost('gpt-realtime-mini', 500_000, 250_000)).toBeCloseTo(10);
  });

  it('is zero without tokens and null for an unknown model', () => {
    expect(estimateCost('gpt-4o', 0, 0)).toBe(0);
    expect(estimateCost('unknown-model', 1000, 1000)).toBeNull();
  });

  it('has a price for every listed model', () => {
    for (const [model, price] of Object.entries(MODEL_PRICES)) {
      expect(price.inputPerM, model).toBeGreaterThan(0);
      expect(price.outputPerM, model).toBeGreaterThan(0);
    }
  });
});

describe('estimateSessionCost', () => {
  it('scales the per-minute rate by the speaking time', () => {
    expect(estimateSessionCost('gpt-realtime-mini', 60)).toBeCloseTo(0.06);
    expect(estimateSessionCost('gpt-realtime-mini', 120)).toBeCloseTo(0.12);
    expect(estimateSessionCost('gpt-realtime', 30)).toBeCloseTo(0.15);
  });

  it('is zero for no speaking time', () => {
    expect(estimateSessionCost('gpt-realtime', 0)).toBe(0);
  });

  it('is null for a model without a realtime rate', () => {
    expect(estimateSessionCost('gpt-4o', 60)).toBeNull();
    expect(estimateSessionCost('gemini-2.5-flash', 60)).toBeNull();
  });
});
