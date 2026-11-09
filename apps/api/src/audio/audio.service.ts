import { Inject, Injectable, Optional } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import {
  and,
  eq,
  examAttempts,
  userPreferences,
  type Database,
} from "@parle-tcf/db";
import type { AudioStatus, AudioUploadInput } from "@parle-tcf/shared";
import { DATABASE } from "../database/database.tokens.js";
import {
  AUDIO_STORAGE,
  attemptKey,
  userPrefix,
  type AudioStorage,
} from "./audio-storage.js";

@Injectable()
export class AudioService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Optional()
    @Inject(AUDIO_STORAGE)
    private readonly storage: AudioStorage | null = null,
  ) {}

  private requireStorage(): AudioStorage {
    if (!this.storage) {
      throw new ORPCError("BAD_REQUEST", {
        message: "L'enregistrement audio n'est pas disponible sur ce serveur.",
      });
    }
    return this.storage;
  }

  private async hasConsent(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ at: userPreferences.audioConsentAt })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    return Boolean(row?.at);
  }

  async status(userId: string): Promise<AudioStatus> {
    return {
      available: this.storage !== null,
      consent: await this.hasConsent(userId),
    };
  }

  /** Withdrawing consent also deletes every stored recording of the user. */
  async setConsent(userId: string, consent: boolean): Promise<AudioStatus> {
    const at = consent ? new Date() : null;
    await this.db
      .insert(userPreferences)
      .values({ userId, audioConsentAt: at })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { audioConsentAt: at },
      });
    if (!consent) await this.purgeUser(userId);
    return this.status(userId);
  }

  private async ownedAttempt(userId: string, attemptId: string) {
    const [row] = await this.db
      .select({ id: examAttempts.id, audioKey: examAttempts.audioKey })
      .from(examAttempts)
      .where(
        and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)),
      )
      .limit(1);
    if (!row) {
      throw new ORPCError("NOT_FOUND", { message: "Tentative introuvable." });
    }
    return row;
  }

  async uploadUrl(userId: string, input: AudioUploadInput) {
    const storage = this.requireStorage();
    await this.ownedAttempt(userId, input.attemptId);
    if (!(await this.hasConsent(userId))) {
      throw new ORPCError("FORBIDDEN", {
        message: "Consentement à l'enregistrement audio requis.",
      });
    }
    const key = attemptKey(userId, input.attemptId);
    await this.db
      .update(examAttempts)
      .set({ audioKey: key })
      .where(
        and(
          eq(examAttempts.id, input.attemptId),
          eq(examAttempts.userId, userId),
        ),
      );
    return {
      url: await storage.presignUpload(key, input.contentType),
      contentType: input.contentType,
    };
  }

  async downloadUrl(userId: string, attemptId: string) {
    const row = await this.ownedAttempt(userId, attemptId);
    if (!row.audioKey || !this.storage) return { url: null };
    return { url: await this.storage.presignDownload(row.audioKey) };
  }

  /** Called before an attempt row is deleted. */
  async deleteForAttempt(userId: string, attemptId: string): Promise<void> {
    if (!this.storage) return;
    const row = await this.ownedAttempt(userId, attemptId);
    if (row.audioKey) await this.storage.delete(row.audioKey);
  }

  /** Removes every recording of a user (consent withdrawn or account deleted). */
  async purgeUser(userId: string): Promise<void> {
    if (this.storage) await this.storage.deletePrefix(userPrefix(userId));
    await this.db
      .update(examAttempts)
      .set({ audioKey: null })
      .where(eq(examAttempts.userId, userId));
  }
}
