import {
  API_ROUTES,
  type AttemptDetail,
  type CheckpointAttemptInput,
  type CompleteAttemptInput,
  type CreateExamSessionOutput,
  type CreateExamSessionRequest,
  type ListAttemptsInput,
  type ListAttemptsOutput,
  type ProviderSettings,
  type TestProviderSettingsOutput,
  type UpsertProviderSettingsInput,
  type Usage,
} from '@parle-tcf/shared';

/** Base URL of the NestJS API (also hosts Better Auth under /api/auth). */
export function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_EXAM_API_URL;
  return (base || 'http://localhost:3001').replace(/\/$/, '');
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface CallOptions {
  /** Keeps the request alive while the page unloads (pagehide). */
  keepalive?: boolean;
}

/** POST a JSON procedure with the Better Auth session cookie. */
async function call<TOut>(route: string, input: unknown, options: CallOptions = {}): Promise<TOut> {
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${route}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input ?? {}),
      keepalive: options.keepalive,
    });
  } catch {
    throw new ApiError('NETWORK', 0, 'Impossible de joindre le serveur. Vérifiez votre connexion.');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ApiError(
      body?.code ?? (res.status === 401 ? 'UNAUTHORIZED' : 'ERROR'),
      res.status,
      body?.message ?? `Erreur ${res.status}`
    );
  }
  return (await res.json()) as TOut;
}

export const api = {
  createExamSession: (input: CreateExamSessionRequest) =>
    call<CreateExamSessionOutput>(API_ROUTES.sessionCreate, input),

  getSettings: () => call<ProviderSettings>(API_ROUTES.settingsGet, {}),
  saveSettings: (input: UpsertProviderSettingsInput) =>
    call<ProviderSettings>(API_ROUTES.settingsUpsert, input),
  deleteSettings: () => call<{ ok: true }>(API_ROUTES.settingsDelete, {}),
  testSettings: () => call<TestProviderSettingsOutput>(API_ROUTES.settingsTest, {}),

  checkpointAttempt: (input: CheckpointAttemptInput, options?: CallOptions) =>
    call<{ ok: true }>(API_ROUTES.attemptsCheckpoint, input, options),
  completeAttempt: (input: CompleteAttemptInput, options?: CallOptions) =>
    call<{ ok: true }>(API_ROUTES.attemptsComplete, input, options),
  listAttempts: (input: ListAttemptsInput = {}) =>
    call<ListAttemptsOutput>(API_ROUTES.attemptsList, input),
  getAttempt: (attemptId: string) => call<AttemptDetail>(API_ROUTES.attemptsGet, { attemptId }),
  reevaluateAttempt: (attemptId: string) =>
    call<{ ok: true }>(API_ROUTES.attemptsReevaluate, { attemptId }),
  getUsage: () => call<Usage>(API_ROUTES.usageGet, {}),
  deleteAttempt: (attemptId: string) =>
    call<{ ok: true }>(API_ROUTES.attemptsDelete, { attemptId }),
};
