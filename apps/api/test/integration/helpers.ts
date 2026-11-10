import { randomUUID } from 'node:crypto';
import type { Response } from 'supertest';
import { expect } from 'vitest';
import { eq, user } from '@parle-tcf/db';
import { TEST_WEB_URL, type TestApp } from './create-test-app.js';
import { latestEmailTo, linksIn } from './mailpit.js';

export const PASSWORD = 'integration-password-1';

/** A valid-looking OpenAI key (the fake provider accepts it). */
export const OPENAI_KEY = `sk-integration-${'k'.repeat(24)}`;
/** A Gemini key the fake provider accepts. */
export const GEMINI_KEY = `AIza-integration-${'g'.repeat(24)}`;

/** A fresh address per call, so tests never share a user or a mailbox. */
export function uniqueEmail(label = 'user'): string {
  return `${label}-${randomUUID().slice(0, 8)}@integration.test`;
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/** Signs up through Better Auth (sends the verification email to Mailpit). */
export function signUp(t: TestApp, email: string, password = PASSWORD): Promise<Response> {
  return t
    .http()
    .post('/api/auth/sign-up/email')
    .send({ email, password, name: 'Integration User' });
}

/** Signs in and returns the bearer token from `set-auth-token`. */
export async function signIn(t: TestApp, email: string, password = PASSWORD): Promise<string> {
  const res = await t.http().post('/api/auth/sign-in/email').send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const token = res.headers['set-auth-token'] as string | undefined;
  expect(token).toBeTruthy();
  return token as string;
}

/**
 * A signed-in user with a verified email. The verification itself is pinned by
 * auth.spec.ts; here it is set in the database to keep the other specs fast.
 */
export async function signUpVerifiedUser(t: TestApp, label = 'user'): Promise<TestUser> {
  const email = uniqueEmail(label);
  const res = await signUp(t, email);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const [row] = await t.db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.email, email))
    .returning({ id: user.id });
  return { id: row.id, email, token: await signIn(t, email) };
}

/** POSTs an oRPC procedure as the web app does (JSON body, optional bearer token). */
export function rpc(t: TestApp, route: string, token: string | null, input: unknown = {}) {
  const req = t.http().post(route).set('Content-Type', 'application/json');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(JSON.stringify(input ?? {}));
}

/** Expects an oRPC error with this HTTP status and code. */
export function expectError(res: Response, status: number, code: string): void {
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  expect((res.body as { code?: string }).code).toBe(code);
}

/** Expects a 200 and returns the typed body. */
export function ok<T = Record<string, unknown>>(res: Response): T {
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as T;
}

/** Stores a provider key for the user (required before starting a session). */
export async function configureProvider(
  t: TestApp,
  token: string,
  provider: 'openai' | 'gemini' = 'openai'
): Promise<void> {
  ok(
    await rpc(t, '/settings/upsert', token, {
      provider,
      apiKey: provider === 'gemini' ? GEMINI_KEY : OPENAI_KEY,
    })
  );
}

export interface StartedSession {
  attemptId: string;
  runId: string | null;
  clientSecret: string;
}

/** Creates a session (and its in-progress attempt). */
export async function startSession(
  t: TestApp,
  token: string,
  input: Record<string, unknown> = { taskType: 'tache1' }
): Promise<StartedSession> {
  return ok<StartedSession>(await rpc(t, '/exam/session/create', token, input));
}

export const CANDIDATE_LINES = [
  { seq: 0, speaker: 'examiner', text: 'Bonjour, présentez-vous.' },
  { seq: 1, speaker: 'candidate', text: "Je m'appelle Alex et j'habite à Lyon." },
  { seq: 2, speaker: 'examiner', text: 'Que faites-vous dans la vie ?' },
  { seq: 3, speaker: 'candidate', text: 'Je travaille dans une école primaire.' },
] as const;

/** A user with a provider key and a completed attempt (evaluation started). */
export async function completedAttempt(t: TestApp, token: string): Promise<string> {
  const { attemptId } = await startSession(t, token);
  ok(await rpc(t, '/attempts/complete', token, { attemptId, lines: CANDIDATE_LINES }));
  return attemptId;
}

/**
 * Waits for the newest email to `address` to carry a link to `path` on the web
 * app and returns that link (emails link to web pages, which call the API).
 */
export async function webLinkInEmail(
  address: string,
  path: string,
  timeoutMs = 10_000
): Promise<URL> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = Math.max(500, deadline - Date.now());
    const body = await latestEmailTo(address, remaining);
    const link = linksIn(body).find((l) => l.startsWith(`${TEST_WEB_URL}${path}`));
    if (link) return new URL(link);
    if (Date.now() > deadline) throw new Error(`No ${path} link emailed to ${address}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** Polls the attempt until its evaluation leaves pending/running. */
export async function waitForEvaluation(
  t: TestApp,
  token: string,
  attemptId: string,
  timeoutMs = 10_000
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const detail = ok(await rpc(t, '/attempts/get', token, { attemptId }));
    if (detail.evaluationStatus !== 'pending' && detail.evaluationStatus !== 'running') {
      return detail;
    }
    if (Date.now() > deadline) throw new Error(`Evaluation of ${attemptId} still running`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
