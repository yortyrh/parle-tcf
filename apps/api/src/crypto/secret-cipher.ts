import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedSecret {
  /** base64 */
  ciphertext: string;
  /** base64, 12 random bytes, unique per encryption */
  iv: string;
  /** base64, GCM authentication tag */
  authTag: string;
  /** Name of the master key used (`v1`, `v2`, ...) */
  keyVersion: string;
}

/**
 * AES-256-GCM envelope for secrets at rest (users' provider API keys).
 *
 * Master keys are 32 raw bytes, supplied as `v1:<base64>,v2:<base64>`. New
 * writes use `currentVersion`; reads pick the key matching the stored
 * `keyVersion`, so a key can be rotated without downtime: add `v2`, switch
 * `currentVersion`, re-encrypt rows, then retire `v1`.
 */
export class SecretCipher {
  private readonly keys = new Map<string, Buffer>();

  constructor(
    keysSpec: string,
    readonly currentVersion: string
  ) {
    for (const entry of keysSpec.split(',')) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const separator = trimmed.indexOf(':');
      if (separator <= 0) {
        throw new Error('Invalid ENCRYPTION_KEYS entry: expected "<version>:<base64>"');
      }
      const version = trimmed.slice(0, separator);
      const key = Buffer.from(trimmed.slice(separator + 1), 'base64');
      if (key.length !== KEY_BYTES) {
        throw new Error(`Encryption key "${version}" must be ${KEY_BYTES} bytes (base64-encoded)`);
      }
      this.keys.set(version, key);
    }
    if (!this.keys.has(currentVersion)) {
      throw new Error(
        `ENCRYPTION_KEY_CURRENT "${currentVersion}" is not present in ENCRYPTION_KEYS`
      );
    }
  }

  encrypt(plaintext: string): EncryptedSecret {
    const key = this.keys.get(this.currentVersion)!;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyVersion: this.currentVersion,
    };
  }

  decrypt(secret: EncryptedSecret): string {
    const key = this.keys.get(secret.keyVersion);
    if (!key) {
      throw new Error(`Unknown encryption key version "${secret.keyVersion}"`);
    }
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(secret.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** True when the secret is not encrypted with the current master key. */
  needsRotation(secret: Pick<EncryptedSecret, 'keyVersion'>): boolean {
    return secret.keyVersion !== this.currentVersion;
  }

  /** Decrypts with the stored key version and encrypts with the current one. */
  rotate(secret: EncryptedSecret): EncryptedSecret {
    return this.encrypt(this.decrypt(secret));
  }
}
