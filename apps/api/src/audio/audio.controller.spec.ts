import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { call } from '@orpc/server';
import { AUDIO_MAX_BYTES } from '@parle-tcf/shared';
import { type AuthenticatedRequest, SessionAuthGuard } from '../auth/session-auth.guard.js';
import { AudioController } from './audio.controller.js';
import type { AudioService } from './audio.service.js';

const USER = '11111111-1111-4111-8111-111111111111';
const ATTEMPT = '22222222-2222-4222-8222-222222222222';

const req = { user: { id: USER, email: 'a@test.local', name: 'A' } } as AuthenticatedRequest;
const anonymous = {} as AuthenticatedRequest;

describe('AudioController', () => {
  let audio: {
    status: ReturnType<typeof vi.fn>;
    setConsent: ReturnType<typeof vi.fn>;
    uploadUrl: ReturnType<typeof vi.fn>;
    confirmUpload: ReturnType<typeof vi.fn>;
    downloadUrl: ReturnType<typeof vi.fn>;
  };
  let controller: AudioController;

  beforeEach(() => {
    audio = {
      status: vi.fn(async () => ({ available: true, consent: false })),
      setConsent: vi.fn(async (_u: string, consent: boolean) => ({ available: true, consent })),
      uploadUrl: vi.fn(async () => ({
        url: 'https://bucket.test/',
        fields: { key: `audio/${USER}/${ATTEMPT}` },
        contentType: 'audio/webm',
        maxBytes: AUDIO_MAX_BYTES,
      })),
      confirmUpload: vi.fn(async () => undefined),
      downloadUrl: vi.fn(async () => ({ url: 'https://bucket.test/signed' })),
    };
    controller = new AudioController(audio as unknown as AudioService);
  });

  it('is behind SessionAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AudioController)).toContain(SessionAuthGuard);
  });

  it("returns the user's audio status", async () => {
    expect(await call(controller.status(req), undefined)).toEqual({
      available: true,
      consent: false,
    });
    expect(audio.status).toHaveBeenCalledWith(USER);
  });

  it.each([true, false])('stores consent=%s for the current user', async (consent) => {
    expect(await call(controller.setConsent(req), { consent })).toEqual({
      available: true,
      consent,
    });
    expect(audio.setConsent).toHaveBeenCalledWith(USER, consent);
  });

  it('presigns an upload for the current user and the validated input', async () => {
    const input = { attemptId: ATTEMPT, contentType: 'audio/webm' as const };
    const out = await call(controller.uploadUrl(req), input);
    expect(out.maxBytes).toBe(AUDIO_MAX_BYTES);
    expect(audio.uploadUrl).toHaveBeenCalledWith(USER, input);
  });

  it('rejects an unsupported content type before reaching the service', async () => {
    await expect(
      call(controller.uploadUrl(req), { attemptId: ATTEMPT, contentType: 'audio/wav' } as never)
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(audio.uploadUrl).not.toHaveBeenCalled();
  });

  it('confirms the upload and answers ok', async () => {
    expect(await call(controller.confirm(req), { attemptId: ATTEMPT })).toEqual({ ok: true });
    expect(audio.confirmUpload).toHaveBeenCalledWith(USER, ATTEMPT);
  });

  it('propagates a failed confirmation', async () => {
    audio.confirmUpload.mockRejectedValue(new Error('missing object'));
    await expect(call(controller.confirm(req), { attemptId: ATTEMPT })).rejects.toThrow();
  });

  it('returns a download url, or null', async () => {
    expect(await call(controller.downloadUrl(req), { attemptId: ATTEMPT })).toEqual({
      url: 'https://bucket.test/signed',
    });
    expect(audio.downloadUrl).toHaveBeenCalledWith(USER, ATTEMPT);
    audio.downloadUrl.mockResolvedValue({ url: null });
    expect(await call(controller.downloadUrl(req), { attemptId: ATTEMPT })).toEqual({ url: null });
  });

  it('refuses every procedure without an authenticated user', () => {
    const procedures: (() => unknown)[] = [
      () => controller.status(anonymous),
      () => controller.setConsent(anonymous),
      () => controller.uploadUrl(anonymous),
      () => controller.confirm(anonymous),
      () => controller.downloadUrl(anonymous),
    ];
    for (const make of procedures) expect(make).toThrow(UnauthorizedException);
    expect(Object.values(audio).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
