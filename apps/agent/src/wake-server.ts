import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;

/**
 * Resets the inactivity timer. Called whenever the agent receives meaningful
 * activity (job start, /wake request). When the timer fires without being
 * reset, the process exits cleanly so Railway can put the container to sleep.
 */
export function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);

  if (idleTimeoutMs <= 0) return;

  idleTimer = setTimeout(() => {
    console.log(
      `[wake-server] No activity for ${idleTimeoutMs / 1000}s — shutting down for scale-to-zero`,
    );
    process.exit(0);
  }, idleTimeoutMs);

  idleTimer.unref();
}

/**
 * Lightweight HTTP server that enables scale-to-zero on Railway.
 * Railway routes incoming HTTP requests to the container, waking it from zero
 * if needed. The /health endpoint doubles as Railway's healthcheck target.
 *
 * An inactivity timer shuts down the process after `idleTimeoutMs` without
 * any /wake request or job activity, allowing Railway to sleep the container.
 *
 * In dev, if the requested port is busy (EADDRINUSE), the server falls back
 * to an OS-assigned port so it never crashes the agent process.
 */
export function startWakeServer(port = 8080, configuredIdleTimeoutMs?: number): void {
  if (configuredIdleTimeoutMs !== undefined) {
    idleTimeoutMs = configuredIdleTimeoutMs;
  }

  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
      return;
    }
    if (req.url === '/wake') {
      resetIdleTimer();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[wake-server] port ${port} in use, retrying on random port`);
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        console.log(`[wake-server] listening on :${addr.port}`);
      });
      return;
    }
    throw err;
  });

  server.listen(port, () => {
    console.log(`[wake-server] listening on :${port} (idle timeout: ${idleTimeoutMs / 1000}s)`);
    resetIdleTimer();
  });
}
