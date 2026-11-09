import { Inject, Injectable } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import { eq, providerSettings, type Database } from "@parle-tcf/db";
import type {
  ProviderSettings,
  TestProviderSettingsOutput,
  UpsertProviderSettingsInput,
} from "@parle-tcf/shared";
import { SecretCipher } from "../crypto/secret-cipher.js";
import { DATABASE } from "../database/database.tokens.js";
import { VoiceProviderRegistry } from "../providers/voice-provider.js";

export interface UserProviderConfig {
  apiKey: string;
  provider: "openai" | "gemini";
  realtimeModel: string | null;
  voice: string | null;
  textModel: string | null;
}

type Row = typeof providerSettings.$inferSelect;

function toDto(row: Row | undefined): ProviderSettings {
  return {
    configured: Boolean(row),
    provider: row?.provider ?? "openai",
    last4: row?.last4 ?? null,
    realtimeModel: row?.realtimeModel ?? null,
    voice: row?.voice ?? null,
    textModel: row?.textModel ?? null,
    verifiedAt: row?.verifiedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class ProviderSettingsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly cipher: SecretCipher,
    private readonly voices: VoiceProviderRegistry,
  ) {}

  private async findRow(userId: string): Promise<Row | undefined> {
    const [row] = await this.db
      .select()
      .from(providerSettings)
      .where(eq(providerSettings.userId, userId))
      .limit(1);
    return row;
  }

  /** Safe view for the UI: never includes the key. */
  async get(userId: string): Promise<ProviderSettings> {
    return toDto(await this.findRow(userId));
  }

  async upsert(
    userId: string,
    input: UpsertProviderSettingsInput,
  ): Promise<ProviderSettings> {
    const existing = await this.findRow(userId);
    if (!existing && !input.apiKey) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Une clé API est requise pour la première configuration.",
      });
    }

    if (
      existing &&
      !input.apiKey &&
      existing.provider !== (input.provider ?? "openai")
    ) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Changer de fournisseur nécessite une nouvelle clé API.",
      });
    }

    const models = {
      realtimeModel: input.realtimeModel ?? null,
      voice: input.voice ?? null,
      textModel: input.textModel ?? null,
    };

    if (input.apiKey) {
      const encrypted = this.cipher.encrypt(input.apiKey);
      const values = {
        provider: input.provider ?? "openai",
        apiKeyCiphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
        last4: input.apiKey.slice(-4),
        ...models,
        // A new key has not been checked yet.
        verifiedAt: null,
      };
      await this.db
        .insert(providerSettings)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: providerSettings.userId, set: values });
    } else {
      await this.db
        .update(providerSettings)
        .set(models)
        .where(eq(providerSettings.userId, userId));
    }
    return this.get(userId);
  }

  async delete(userId: string): Promise<void> {
    await this.db
      .delete(providerSettings)
      .where(eq(providerSettings.userId, userId));
  }

  /** Decrypted config for server-side use only (minting secrets, evaluation). */
  async getConfigForUser(userId: string): Promise<UserProviderConfig> {
    const row = await this.findRow(userId);
    if (!row) {
      throw new ORPCError("PROVIDER_NOT_CONFIGURED", {
        status: 412,
        message: "Aucune clé API configurée. Ajoutez-la dans les paramètres.",
      });
    }
    const apiKey = this.cipher.decrypt({
      ciphertext: row.apiKeyCiphertext,
      iv: row.iv,
      authTag: row.authTag,
      keyVersion: row.keyVersion,
    });
    return {
      apiKey,
      provider: row.provider,
      realtimeModel: row.realtimeModel,
      voice: row.voice,
      textModel: row.textModel,
    };
  }

  async test(userId: string): Promise<TestProviderSettingsOutput> {
    const config = await this.getConfigForUser(userId);
    const result = await this.voices
      .get(config.provider)
      .verifyKey(config.apiKey);
    if (result.ok) {
      await this.db
        .update(providerSettings)
        .set({ verifiedAt: new Date() })
        .where(eq(providerSettings.userId, userId));
    }
    return result;
  }
}
