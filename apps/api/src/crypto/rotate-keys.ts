import { eq, providerSettings, type Database } from "@parle-tcf/db";
import type { SecretCipher } from "./secret-cipher.js";

export interface RotationReport {
  scanned: number;
  rotated: number;
}

/**
 * Re-encrypts every stored provider key that is not under the current master
 * key. Safe to re-run; each row is updated independently.
 */
export async function rotateProviderKeys(
  db: Database,
  cipher: SecretCipher,
): Promise<RotationReport> {
  const rows = await db.select().from(providerSettings);
  let rotated = 0;
  for (const row of rows) {
    if (!cipher.needsRotation(row)) continue;
    const next = cipher.rotate({
      ciphertext: row.apiKeyCiphertext,
      iv: row.iv,
      authTag: row.authTag,
      keyVersion: row.keyVersion,
    });
    await db
      .update(providerSettings)
      .set({
        apiKeyCiphertext: next.ciphertext,
        iv: next.iv,
        authTag: next.authTag,
        keyVersion: next.keyVersion,
      })
      .where(eq(providerSettings.userId, row.userId));
    rotated++;
  }
  return { scanned: rows.length, rotated };
}
