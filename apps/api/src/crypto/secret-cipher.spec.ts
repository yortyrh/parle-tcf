import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SecretCipher } from './secret-cipher.js';

const key = () => randomBytes(32).toString('base64');

describe('SecretCipher', () => {
  const k1 = key();
  const k2 = key();

  it('round-trips a secret', () => {
    const cipher = new SecretCipher(`v1:${k1}`, 'v1');
    const encrypted = cipher.encrypt('sk-test-1234567890');
    expect(encrypted.ciphertext).not.toContain('sk-test');
    expect(cipher.decrypt(encrypted)).toBe('sk-test-1234567890');
  });

  it('uses a different IV and ciphertext on every encryption', () => {
    const cipher = new SecretCipher(`v1:${k1}`, 'v1');
    const a = cipher.encrypt('same');
    const b = cipher.encrypt('same');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects a tampered auth tag or ciphertext', () => {
    const cipher = new SecretCipher(`v1:${k1}`, 'v1');
    const encrypted = cipher.encrypt('secret');
    const badTag = {
      ...encrypted,
      authTag: randomBytes(16).toString('base64'),
    };
    expect(() => cipher.decrypt(badTag)).toThrow();
    const flipped = Buffer.from(encrypted.ciphertext, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() =>
      cipher.decrypt({ ...encrypted, ciphertext: flipped.toString('base64') })
    ).toThrow();
  });

  it('rejects decryption with a different master key', () => {
    const a = new SecretCipher(`v1:${k1}`, 'v1');
    const b = new SecretCipher(`v1:${k2}`, 'v1');
    expect(() => b.decrypt(a.encrypt('secret'))).toThrow();
  });

  it('rotates from v1 to v2 while keeping old rows readable', () => {
    const before = new SecretCipher(`v1:${k1}`, 'v1');
    const legacy = before.encrypt('sk-rotate-me');

    const after = new SecretCipher(`v1:${k1},v2:${k2}`, 'v2');
    expect(after.decrypt(legacy)).toBe('sk-rotate-me');
    expect(after.needsRotation(legacy)).toBe(true);

    const rotated = after.rotate(legacy);
    expect(rotated.keyVersion).toBe('v2');
    expect(after.needsRotation(rotated)).toBe(false);
    expect(after.decrypt(rotated)).toBe('sk-rotate-me');

    // v1 can now be retired.
    const retired = new SecretCipher(`v2:${k2}`, 'v2');
    expect(retired.decrypt(rotated)).toBe('sk-rotate-me');
    expect(() => retired.decrypt(legacy)).toThrow(/Unknown encryption key/);
  });

  it('validates key material', () => {
    expect(() => new SecretCipher('v1:c2hvcnQ=', 'v1')).toThrow(/32 bytes/);
    expect(() => new SecretCipher(`v1:${k1}`, 'v2')).toThrow(/not present/);
    expect(() => new SecretCipher('garbage', 'v1')).toThrow(/Invalid/);
  });
});
