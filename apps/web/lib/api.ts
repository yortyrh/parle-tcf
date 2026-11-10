import {
  API_ROUTES,
  type AttemptDetail,
  type AudioStatus,
  type AudioUploadInput,
  type AudioUploadOutput,
  type CheckpointAttemptInput,
  type CheckpointAttemptOutput,
  type CompleteAttemptInput,
  type CreateExamSessionOutput,
  type CreateExamSessionRequest,
  type ExamRun,
  type ExerciseSession,
  type ListAttemptsInput,
  type ListAttemptsOutput,
  type ListExercisesInput,
  type ListExercisesOutput,
  type ProviderSettings,
  type RefreshSessionTokenOutput,
  type TestProviderSettingsOutput,
  type UpsertProviderSettingsInput,
  type Usage,
} from '@parle-tcf/shared';
import { authHeaders } from '@/lib/session-token';

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

/** POST a JSON procedure with the bearer session token. */
async function call<TOut>(route: string, input: unknown, options: CallOptions = {}): Promise<TOut> {
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${route}`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
  /** Fresh client secret right before connecting (after the preparation time). */
  refreshSessionToken: (attemptId: string) =>
    call<RefreshSessionTokenOutput>(API_ROUTES.sessionToken, { attemptId }),

  getSettings: () => call<ProviderSettings>(API_ROUTES.settingsGet, {}),
  saveSettings: (input: UpsertProviderSettingsInput) =>
    call<ProviderSettings>(API_ROUTES.settingsUpsert, input),
  deleteSettings: () => call<{ ok: true }>(API_ROUTES.settingsDelete, {}),
  testSettings: () => call<TestProviderSettingsOutput>(API_ROUTES.settingsTest, {}),

  checkpointAttempt: (input: CheckpointAttemptInput, options?: CallOptions) =>
    call<CheckpointAttemptOutput>(API_ROUTES.attemptsCheckpoint, input, options),
  completeAttempt: (input: CompleteAttemptInput, options?: CallOptions) =>
    call<{ ok: true }>(API_ROUTES.attemptsComplete, input, options),
  listAttempts: (input: ListAttemptsInput = {}) =>
    call<ListAttemptsOutput>(API_ROUTES.attemptsList, input),
  getAttempt: (attemptId: string) => call<AttemptDetail>(API_ROUTES.attemptsGet, { attemptId }),
  reevaluateAttempt: (attemptId: string) =>
    call<{ ok: true }>(API_ROUTES.attemptsReevaluate, { attemptId }),
  getRun: (runId: string) => call<ExamRun>(API_ROUTES.runsGet, { runId }),
  getAudioStatus: () => call<AudioStatus>(API_ROUTES.audioStatus, {}),
  setAudioConsent: (consent: boolean) => call<AudioStatus>(API_ROUTES.audioSetConsent, { consent }),
  getAudioUploadUrl: (input: AudioUploadInput) =>
    call<AudioUploadOutput>(API_ROUTES.audioUploadUrl, input),
  confirmAudioUpload: (attemptId: string) =>
    call<{ ok: true }>(API_ROUTES.audioConfirm, { attemptId }),
  getAudioDownloadUrl: (attemptId: string) =>
    call<{ url: string | null }>(API_ROUTES.audioDownloadUrl, { attemptId }),
  getUsage: () => call<Usage>(API_ROUTES.usageGet, {}),
  deleteAttempt: (attemptId: string) =>
    call<{ ok: true }>(API_ROUTES.attemptsDelete, { attemptId }),
  listExercises: (input: ListExercisesInput) =>
    call<ListExercisesOutput>(API_ROUTES.exercisesList, input),
  listExerciseSessions: () =>
    call<{ sessions: ExerciseSession[] }>(API_ROUTES.exercisesSessions, {}),
};
