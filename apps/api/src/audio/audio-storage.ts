export const AUDIO_STORAGE = Symbol("AUDIO_STORAGE");

/** Object storage for attempt recordings (S3-compatible: R2, MinIO, S3). */
export interface PresignedUpload {
  url: string;
  /** Form fields to send before the file (multipart POST). */
  fields: Record<string, string>;
}

export interface AudioStorage {
  /** Presigned POST limited to `maxBytes` and this content type. */
  presignUpload(
    key: string,
    contentType: string,
    maxBytes: number,
  ): Promise<PresignedUpload>;
  /** Size of a stored object, or null when it does not exist. */
  head(key: string): Promise<{ size: number } | null>;
  presignDownload(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

/** Key layout: everything of a user lives under `audio/<userId>/`. */
export const userPrefix = (userId: string) => `audio/${userId}/`;
export const attemptKey = (userId: string, attemptId: string) =>
  `${userPrefix(userId)}${attemptId}`;
