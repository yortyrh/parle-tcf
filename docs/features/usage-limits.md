# Usage limits and costs

## Summary

Because each user pays with their own key, the app shows costs before and after sessions and caps usage per user: minutes of voice session per day and estimated cost per month.

## User flow

- The landing page and the full exam page show an indicative cost for the default model.
- The dashboard shows today's minutes and this month's estimated cost against the caps.
- Each result shows the attempt's estimated cost.
- When a cap is reached, a new session does not start (`LIMIT_REACHED`, with the reason), and a running session ends at its next checkpoint.

## How it works

- **Before a session:** `estimateSessionCost(model, seconds)` uses a rough USD per minute for known OpenAI realtime models (`packages/shared/src/pricing.ts`).
- **After a session:** the cost is computed from the provider's token usage with `MODEL_PRICES` (USD per million tokens), plus the corrector's tokens. Unknown models have no price (`null`) rather than a wrong one.
- **Caps** (`UsageService`): `DEFAULT_DAILY_MINUTES` (60) and `DEFAULT_MONTHLY_COST_USD` (10), overridable per user in `usage_limits`. Days and months are UTC. Today's minutes include sessions still in progress, up to their last checkpoint.

## API

`/usage/get`; `LIMIT_REACHED` from `/exam/session/create` and `/exam/session/token`; `limitReached` in the `/attempts/checkpoint` response.

## Data

`exam_attempts` (input/output tokens, cost, timing), `usage_limits`.

## Code map

`apps/api/src/usage/usage.service.ts`, `packages/shared/src/pricing.ts`, `packages/shared/src/models.ts`.

## Tests

`usage.service.spec.ts`, `packages/shared/src/pricing.spec.ts`, `apps/api/test/integration/attempts.spec.ts`.
