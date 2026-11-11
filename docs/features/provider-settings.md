# Provider keys and settings

## Summary

Bring your own key: each user stores their own OpenAI or Gemini API key, which pays for their sessions and evaluations. The key is encrypted at rest, never sent back to the browser (only its last 4 characters), and decrypted only on the server to mint session credentials and to call the corrector. See [ADR 0004](../adr/0004-encrypted-user-keys.md).

## User flow

**Paramètres** (`/parametres`):

1. Pick the provider (OpenAI or Gemini, the latter marked experimental).
2. Paste the API key; optionally set the realtime model, the voice and the text model used for grading (placeholders show the defaults).
3. **Tester la connexion** validates the key with a minimal provider call.
4. Delete the settings to forget the key.

The same page holds the audio recording consent ([audio recording](./audio-recording.md)) and links to account deletion.

## How it works

- `SecretCipher` (`apps/api/src/crypto/secret-cipher.ts`): AES-256-GCM, 12-byte random IV per write, auth tag, and the master key version stored with each row.
- Master keys come from `ENCRYPTION_KEYS` (`v1:<base64 32 bytes>,v2:…`); new writes use `ENCRYPTION_KEY_CURRENT`. Rotation without downtime: add `v2`, switch the current version, run `pnpm --filter @parle-tcf/api rotate-keys`, retire `v1`.
- `ProviderSettingsService.get` returns a safe view (no key). `getConfigForUser` returns the decrypted config for server-side use only.
- Key check: OpenAI `GET /v1/models`; Gemini `GET /v1beta/models` (a 400/401/403 means a rejected key).
- Logs redact secrets; the web bundle test forbids server-only imports in the browser.

## API

`/settings/get`, `/settings/upsert`, `/settings/delete`, `/settings/test`. Missing settings make `/exam/session/create` fail with `PROVIDER_NOT_CONFIGURED`.

## Data

`provider_settings` (one row per user): provider, ciphertext, IV, auth tag, key version, last 4, realtime model, voice, text model, verification date.

## Code map

`apps/api/src/settings/`, `apps/api/src/crypto/`, `apps/api/scripts/rotate-keys.ts`, `apps/web/app/(app)/parametres/`.

## Tests

`secret-cipher.spec.ts` (round trip, unique IV, tampered tag, rotation), `rotate-keys.spec.ts`, `provider-settings.service.spec.ts` (including cross-user isolation), `apps/api/test/integration/settings.spec.ts`, `apps/e2e/tests/settings.spec.ts`, `apps/web/lib/web-bundle-security.test.ts`.
