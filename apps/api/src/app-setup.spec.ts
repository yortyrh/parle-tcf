import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Controller, type INestApplication, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './app-setup.js';
import { BETTER_AUTH } from './auth/better-auth.js';
import type { Env } from './config/env.js';

const WEB = 'https://app.parle.test';
const PREVIEW = 'https://preview.parle.test';

/** Stands in for Better Auth: echoes the request it received. */
const handler = vi.fn(async (request: Request) => {
  const body = request.method === 'POST' ? await request.text() : null;
  return new Response(
    JSON.stringify({ method: request.method, path: new URL(request.url).pathname, body }),
    { status: 200, headers: { 'content-type': 'application/json', 'set-auth-token': 'tok' } }
  );
});

@Controller()
class EchoController {
  @Post('echo')
  echo() {
    return { ok: true };
  }
}

@Module({
  controllers: [EchoController],
  providers: [{ provide: BETTER_AUTH, useValue: { handler } }],
})
class TestModule {}

describe('configureApp', () => {
  let app: INestApplication;
  const http = () => supertest(app.getHttpServer());

  beforeAll(async () => {
    app = await NestFactory.create(TestModule, { logger: false });
    configureApp(app, { WEB_URL: WEB, CORS_ORIGINS: `${PREVIEW}/` } as Env);
    await app.init();
  });
  afterAll(() => app?.close());

  describe('security headers (helmet)', () => {
    it('sets the helmet defaults on Nest routes and on Better Auth routes', async () => {
      for (const res of [await http().post('/echo'), await http().get('/api/auth/ok')]) {
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(res.headers['content-security-policy']).toContain("default-src 'self'");
        expect(res.headers['x-powered-by']).toBeUndefined();
      }
    });
  });

  describe('CORS', () => {
    it.each([WEB, PREVIEW])('allows %s and exposes set-auth-token', async (origin) => {
      const res = await http().post('/echo').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-expose-headers']).toBe('set-auth-token');
    });

    it('answers the preflight of an allowed origin', async () => {
      const res = await http()
        .options('/echo')
        .set('Origin', WEB)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(WEB);
    });

    it('does not allow another origin', async () => {
      const res = await http().post('/echo').set('Origin', 'https://evil.test');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Better Auth mount', () => {
    it('hands every method and sub-path under /api/auth to Better Auth', async () => {
      const get = await http().get('/api/auth/get-session');
      expect(get.status).toBe(200);
      expect(get.body).toMatchObject({ method: 'GET', path: '/api/auth/get-session' });
      expect(get.headers['set-auth-token']).toBe('tok');

      const post = await http()
        .post('/api/auth/sign-in/email')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'a@test.local' }));
      // Mounted before Nest's body parser: Better Auth reads the raw body itself.
      expect(post.body).toMatchObject({
        method: 'POST',
        path: '/api/auth/sign-in/email',
        body: '{"email":"a@test.local"}',
      });
    });

    it('leaves the other routes to Nest', async () => {
      handler.mockClear();
      expect((await http().post('/echo')).body).toEqual({ ok: true });
      expect((await http().get('/api/other')).status).toBe(404);
      expect((await http().get('/auth/x')).status).toBe(404);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
