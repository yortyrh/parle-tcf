import { afterEach, describe, expect, it, vi } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports ok with the current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));
    expect(new AppController().health()).toEqual({
      status: 'ok',
      timestamp: '2026-03-10T10:00:00.000Z',
    });
  });

  it('is public so health checks work without a session', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AppController) ?? []).toEqual([]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AppController.prototype.health) ?? []).toEqual([]);
  });
});
