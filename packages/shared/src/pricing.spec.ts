import { describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_LIVE_MODEL, DEFAULT_OPENAI_REALTIME_MODEL } from './models';
import { MODEL_PRICES, estimateCost, estimateSessionCost } from './pricing';

describe('estimateCost', () => {
  it('weights input and output tokens by their own price per million', () => {
    // gpt-realtime-mini: 10 $ in, 20 $ out per million.
    expect(estimateCost('gpt-realtime-mini', 1_000_000, 0)).toBeCloseTo(10);
    expect(estimateCost('gpt-realtime-mini', 0, 1_000_000)).toBeCloseTo(20);
    expect(estimateCost('gpt-realtime-mini', 500_000, 250_000)).toBeCloseTo(10);
  });

  it('prices the current realtime and live models per million tokens', () => {
    expect(estimateCost('gpt-realtime-2.1-mini', 1_000_000, 0)).toBeCloseTo(10);
    expect(estimateCost('gpt-realtime-2.1-mini', 0, 1_000_000)).toBeCloseTo(20);
    expect(estimateCost('gpt-realtime-2.1', 1_000_000, 0)).toBeCloseTo(32);
    expect(estimateCost('gpt-realtime-2.1', 0, 1_000_000)).toBeCloseTo(64);
    expect(estimateCost('gemini-3.8-live', 1_000_000, 0)).toBeCloseTo(3);
    expect(estimateCost('gemini-3.8-live', 0, 1_000_000)).toBeCloseTo(12);
    expect(MODEL_PRICES['gpt-realtime-2.1-mini']).toEqual({ inputPerM: 10, outputPerM: 20 });
    expect(MODEL_PRICES['gpt-realtime-2.1']).toEqual({ inputPerM: 32, outputPerM: 64 });
    expect(MODEL_PRICES['gemini-3.8-live']).toEqual({ inputPerM: 3, outputPerM: 12 });
  });

  it('has a price for both default voice models', () => {
    expect(estimateCost(DEFAULT_OPENAI_REALTIME_MODEL, 1_000_000, 1_000_000)).toBeCloseTo(30);
    expect(estimateCost(DEFAULT_GEMINI_LIVE_MODEL, 1_000_000, 1_000_000)).toBeCloseTo(15);
  });

  it('keeps pricing the retired model ids users may still have saved', () => {
    expect(MODEL_PRICES['gpt-realtime-mini']).toEqual({ inputPerM: 10, outputPerM: 20 });
    expect(MODEL_PRICES['gpt-realtime']).toEqual({ inputPerM: 32, outputPerM: 64 });
    expect(estimateCost('gemini-2.5-flash', 1_000_000, 0)).toBeCloseTo(0.3);
  });

  it('is null for a model id close to a known one but not listed', () => {
    expect(estimateCost('gpt-realtime-2.1-nano', 1000, 1000)).toBeNull();
    expect(estimateCost('gemini-3.8-live-preview', 1000, 1000)).toBeNull();
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

  it('knows the per-minute rate of the gpt-realtime-2.1 models', () => {
    expect(estimateSessionCost('gpt-realtime-2.1-mini', 60)).toBeCloseTo(0.06);
    expect(estimateSessionCost('gpt-realtime-2.1-mini', 120)).toBeCloseTo(0.12);
    expect(estimateSessionCost('gpt-realtime-2.1', 60)).toBeCloseTo(0.3);
    expect(estimateSessionCost('gpt-realtime-2.1', 30)).toBeCloseTo(0.15);
  });

  it('estimates the default OpenAI model at 0.06 USD per minute', () => {
    expect(estimateSessionCost(DEFAULT_OPENAI_REALTIME_MODEL, 60)).toBeCloseTo(0.06);
  });

  it('is zero for no speaking time', () => {
    expect(estimateSessionCost('gpt-realtime', 0)).toBe(0);
  });

  it('is null for a model without a realtime rate', () => {
    expect(estimateSessionCost('gpt-4o', 60)).toBeNull();
    expect(estimateSessionCost('gemini-2.5-flash', 60)).toBeNull();
    expect(estimateSessionCost('gpt-realtime-2.1-nano', 60)).toBeNull();
  });
});
