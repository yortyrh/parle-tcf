import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Lightweight HTTP server that enables scale-to-zero on Railway.
 * Railway routes incoming HTTP requests to the container, waking it from zero
 * if needed. The /health endpoint doubles as Railway's healthcheck target.
 *
 * In dev, if the requested port is busy (EADDRINUSE), the server falls back
 * to an OS-assigned port so it never crashes the agent process.
 */
export function startWakeServer(port = 8080): void {
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/wake') {
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
    console.log(`[wake-server] listening on :${port}`);
  });
}
