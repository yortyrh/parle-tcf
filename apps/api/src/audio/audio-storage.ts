export const AUDIO_STORAGE = Symbol("AUDIO_STORAGE");

/** Object storage for attempt recordings (S3-compatible: R2, MinIO, S3). */
export interface AudioStorage {
  presignUpload(key: string, contentType: string): Promise<string>;
  presignDownload(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

/** Key layout: everything of a user lives under `audio/<userId>/`. */
export const userPrefix = (userId: string) => `audio/${userId}/`;
export const attemptKey = (userId: string, attemptId: string) =>
  `${userPrefix(userId)}${attemptId}`;
