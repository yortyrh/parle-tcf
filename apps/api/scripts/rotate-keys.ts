/**
 * Re-encrypts stored provider API keys with ENCRYPTION_KEY_CURRENT.
 * Usage: pnpm --filter @parle-tcf/api rotate-keys
 */
import dotenv from 'dotenv';
import { createDb } from '@parle-tcf/db';
import { getEnv } from '../src/config/env.js';
import { rotateProviderKeys } from '../src/crypto/rotate-keys.js';
import { SecretCipher } from '../src/crypto/secret-cipher.js';

dotenv.config();
const env = getEnv();
const cipher = new SecretCipher(env.ENCRYPTION_KEYS, env.ENCRYPTION_KEY_CURRENT);
const handle = createDb({ url: env.DATABASE_URL, max: 1 });

rotateProviderKeys(handle.db, cipher)
  .then(({ scanned, rotated }) => {
    console.log(
      `[rotate-keys] ${rotated}/${scanned} keys re-encrypted with ${env.ENCRYPTION_KEY_CURRENT}`
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => handle.close());
