import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { call } from '@orpc/server';
import type { ProviderSettings } from '@parle-tcf/shared';
import { type AuthenticatedRequest, SessionAuthGuard } from '../auth/session-auth.guard.js';
import type { ProviderSettingsService } from './provider-settings.service.js';
import { SettingsController } from './settings.controller.js';

const USER = '11111111-1111-4111-8111-111111111111';
const req = { user: { id: USER, email: 'a@test.local', name: 'A' } } as AuthenticatedRequest;

const SETTINGS: ProviderSettings = {
  configured: true,
  provider: 'openai',
  last4: 'abcd',
  realtimeModel: 'gpt-realtime-mini',
  voice: 'alloy',
  textModel: null,
  verifiedAt: null,
};

describe('SettingsController', () => {
  let settings: {
    get: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    test: ReturnType<typeof vi.fn>;
  };
  let controller: SettingsController;

  beforeEach(() => {
    settings = {
      get: vi.fn(async () => SETTINGS),
      upsert: vi.fn(async () => SETTINGS),
      delete: vi.fn(async () => undefined),
      test: vi.fn(async () => ({ ok: true })),
    };
    controller = new SettingsController(settings as unknown as ProviderSettingsService);
  });

  it('is behind SessionAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SettingsController)).toContain(SessionAuthGuard);
  });

  it("returns the current user's settings", async () => {
    expect(await call(controller.get(req), undefined)).toEqual(SETTINGS);
    expect(settings.get).toHaveBeenCalledWith(USER);
  });

  it('never returns the stored key, even if the service leaked it', async () => {
    settings.get.mockResolvedValue({ ...SETTINGS, apiKey: 'sk-secret-should-not-leak' });
    const out = await call(controller.get(req), undefined);
    expect(out).not.toHaveProperty('apiKey');
  });

  describe('upsert', () => {
    it('saves the parsed input (trimmed, default provider) for the current user', async () => {
      const apiKey = `sk-${'x'.repeat(30)}`;
      expect(
        await call(controller.upsert(req), { apiKey: `  ${apiKey}  `, voice: 'verse' })
      ).toEqual(SETTINGS);
      expect(settings.upsert).toHaveBeenCalledWith(USER, {
        provider: 'openai',
        apiKey,
        voice: 'verse',
      });
    });

    it('rejects a key that does not match the provider before reaching the service', async () => {
      await expect(
        call(controller.upsert(req), { provider: 'gemini', apiKey: `sk-${'x'.repeat(30)}` })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(settings.upsert).not.toHaveBeenCalled();
    });
  });

  it('deletes the settings of the current user and answers ok', async () => {
    expect(await call(controller.delete(req), undefined)).toEqual({ ok: true });
    expect(settings.delete).toHaveBeenCalledWith(USER);
  });

  it('does not answer ok when the deletion fails', async () => {
    settings.delete.mockRejectedValue(new Error('db down'));
    await expect(call(controller.delete(req), undefined)).rejects.toThrow();
  });

  it('tests the stored key of the current user', async () => {
    settings.test.mockResolvedValue({ ok: false, message: 'Clé refusée par OpenAI (401).' });
    expect(await call(controller.test(req), undefined)).toEqual({
      ok: false,
      message: 'Clé refusée par OpenAI (401).',
    });
    expect(settings.test).toHaveBeenCalledWith(USER);
  });

  it('refuses every procedure without an authenticated user', () => {
    const anonymous = {} as AuthenticatedRequest;
    const procedures: (() => unknown)[] = [
      () => controller.get(anonymous),
      () => controller.upsert(anonymous),
      () => controller.delete(anonymous),
      () => controller.test(anonymous),
    ];
    for (const make of procedures) expect(make).toThrow(UnauthorizedException);
  });
});
