# 4. User-supplied API keys, encrypted at rest

Status: accepted

## Context

Each user pays for their own OpenAI usage. Keys must never reach the browser (except as short-lived `client_secret`s), logs, or backups in clear.

## Decision

- AES-256-GCM, random 12-byte IV per record; ciphertext, IV and auth tag in separate columns.
- Master keys are 32 raw bytes in `ENCRYPTION_KEYS="v1:<b64>,v2:<b64>"`; `ENCRYPTION_KEY_CURRENT` picks the one used to encrypt. Each row stores its `key_version`.
- Rotation: `pnpm --filter @parle-tcf/api rotate-keys` re-encrypts rows with the current key.
- No endpoint returns the key; the UI only gets the last four characters.
- Logger redacts `sk-…`, `Authorization`, `apiKey` fields; a web test scans the bundle for secrets.

## Consequences

- Losing every master key makes stored keys unrecoverable (users re-enter them).
- Rotation is an operational step, not automatic.
