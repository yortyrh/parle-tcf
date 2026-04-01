const AGENT_WAKE_URL = process.env.AGENT_WAKE_URL;

/**
 * Fire-and-forget: wake the agent container on Railway.
 * Silently swallows errors so it never blocks page rendering.
 */
export function wakeAgentAsync(): void {
  if (!AGENT_WAKE_URL) return;
  fetch(`${AGENT_WAKE_URL}/wake`, { method: 'POST', signal: AbortSignal.timeout(30_000) }).catch(
    () => {}
  );
}

/**
 * Blocking wake: awaits the agent's /wake endpoint.
 * Used as a safety net before creating a LiveKit session to guarantee the
 * agent worker is available. Generous 60 s timeout covers cold starts.
 */
export async function ensureAgentAwake(): Promise<void> {
  if (!AGENT_WAKE_URL) return;
  const res = await fetch(`${AGENT_WAKE_URL}/wake`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.warn(`[wake-agent] agent responded with ${res.status}`);
  }
}
