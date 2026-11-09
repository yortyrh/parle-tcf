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
export const audioUploadOutputSchema = z.object({
  url: z.string().url(),
  contentType: z.string(),
});
export const audioDownloadOutputSchema = z.object({
  url: z.string().url().nullable(),
});

export type AudioStatus = z.infer<typeof audioStatusSchema>;
export type AudioUploadInput = z.infer<typeof audioUploadInputSchema>;
export type AudioUploadOutput = z.infer<typeof audioUploadOutputSchema>;
