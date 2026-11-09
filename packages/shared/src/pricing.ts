/** USD per million tokens. Estimates: check the provider's price list. */
export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "gpt-realtime-mini": { inputPerM: 10, outputPerM: 20 },
  "gpt-realtime": { inputPerM: 32, outputPerM: 64 },
  "gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "gpt-4o": { inputPerM: 2.5, outputPerM: 10 },
  "gpt-4.1-mini": { inputPerM: 0.4, outputPerM: 1.6 },
  "gpt-4.1": { inputPerM: 2, outputPerM: 8 },
};

/** Estimated cost in USD, or `null` when the model has no known price. */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  return (
    (inputTokens * price.inputPerM + outputTokens * price.outputPerM) /
    1_000_000
  );
}
