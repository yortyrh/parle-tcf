/** USD per million tokens. Estimates: check the provider's price list. */
export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Realtime: audio token prices. Older ids stay for attempts and settings that still use them.
  'gpt-realtime-2.1-mini': { inputPerM: 10, outputPerM: 20 },
  'gpt-realtime-2.1': { inputPerM: 32, outputPerM: 64 },
  'gpt-realtime-mini': { inputPerM: 10, outputPerM: 20 },
  'gpt-realtime': { inputPerM: 32, outputPerM: 64 },
  'gemini-3.8-live': { inputPerM: 3, outputPerM: 12 },
  'gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
  'gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
  'gpt-4.1-mini': { inputPerM: 0.4, outputPerM: 1.6 },
  'gpt-4.1': { inputPerM: 2, outputPerM: 8 },
  'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
  'gemini-2.5-flash-lite': { inputPerM: 0.1, outputPerM: 0.4 },
};

/** Estimated cost in USD, or `null` when the model has no known price. */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  return (inputTokens * price.inputPerM + outputTokens * price.outputPerM) / 1_000_000;
}

/**
 * Rough USD per minute of a Realtime conversation (audio in + out, context
 * re-reads included), used only for the "before you start" estimate. The real
 * cost is computed from token usage once the task is over.
 */
const REALTIME_USD_PER_MIN: Record<string, number> = {
  'gpt-realtime-2.1-mini': 0.06,
  'gpt-realtime-2.1': 0.3,
  'gpt-realtime-mini': 0.06,
  'gpt-realtime': 0.3,
};

export function estimateSessionCost(model: string, speakingSeconds: number): number | null {
  const perMin = REALTIME_USD_PER_MIN[model];
  return perMin === undefined ? null : (perMin * speakingSeconds) / 60;
}
