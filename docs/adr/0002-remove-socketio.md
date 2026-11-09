# 2. Remove Socket.io

Status: accepted

## Context
Socket.io only carried the examiner's report, and the API had no handler for it: nothing was stored.

## Decision
Drop Socket.io. Voice stays browser ↔ OpenAI over WebRTC; the API is plain HTTP (oRPC). Evaluation status is read by polling `attempts.get` every 2 s.

## Consequences
- Fewer moving parts and no sticky-session concern when scaling the API.
- Polling adds up to 2 s of latency before the result appears.
