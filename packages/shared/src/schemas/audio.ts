import { z } from "zod";

export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
export const AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
] as const;

export const audioStatusSchema = z.object({
  /** The server has object storage configured. */
  available: z.boolean(),
  consent: z.boolean(),
});
export const setAudioConsentInputSchema = z.object({ consent: z.boolean() });

export const audioUploadInputSchema = z.object({
  attemptId: z.string().uuid(),
  contentType: z.enum(AUDIO_MIME_TYPES),
});
/** Presigned POST: send `fields` plus the file as multipart form data to `url`. */
export const audioUploadOutputSchema = z.object({
  url: z.string().url(),
  fields: z.record(z.string(), z.string()),
  contentType: z.string(),
  maxBytes: z.number().int().positive(),
});
/** Marks the recording as stored once the upload succeeded (checked server side). */
export const audioConfirmInputSchema = z.object({
  attemptId: z.string().uuid(),
});
export const audioDownloadOutputSchema = z.object({
  url: z.string().url().nullable(),
});

export type AudioStatus = z.infer<typeof audioStatusSchema>;
export type AudioUploadInput = z.infer<typeof audioUploadInputSchema>;
export type AudioUploadOutput = z.infer<typeof audioUploadOutputSchema>;
export type AudioConfirmInput = z.infer<typeof audioConfirmInputSchema>;
