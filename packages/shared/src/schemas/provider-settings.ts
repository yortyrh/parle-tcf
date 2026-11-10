import { z } from 'zod';

export const providerIdSchema = z.enum(['openai', 'gemini']);

export const providerSettingsSchema = z.object({
  configured: z.boolean(),
  provider: providerIdSchema,
  /** Last four characters of the stored key; the key itself is never returned. */
  last4: z.string().nullable(),
  realtimeModel: z.string().nullable(),
  voice: z.string().nullable(),
  textModel: z.string().nullable(),
  verifiedAt: z.string().nullable(),
});

export const upsertProviderSettingsInputSchema = z
  .object({
    provider: providerIdSchema.default('openai'),
    /** Omit to keep the stored key and only change models/voice. */
    apiKey: z.string().trim().min(20, 'Clé API trop courte').max(300).optional(),
    realtimeModel: z.string().trim().min(1).max(100).nullish(),
    voice: z.string().trim().min(1).max(50).nullish(),
    textModel: z.string().trim().min(1).max(100).nullish(),
  })
  .superRefine((input, ctx) => {
    if (!input.apiKey) return;
    const ok =
      input.provider === 'gemini'
        ? input.apiKey.startsWith('AIza')
        : input.apiKey.startsWith('sk-');
    if (!ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['apiKey'],
        message:
          input.provider === 'gemini'
            ? 'Une clé Gemini commence par « AIza »'
            : 'Une clé OpenAI commence par « sk- »',
      });
    }
  });

export const testProviderSettingsOutputSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export type UpsertProviderSettingsInput = z.input<typeof upsertProviderSettingsInputSchema>;
export type TestProviderSettingsOutput = z.infer<typeof testProviderSettingsOutputSchema>;
