import { describe, expect, it } from 'vitest';
import * as shared from './index';
import { API_ROUTES } from './index';

describe('API_ROUTES', () => {
  const paths = Object.values(API_ROUTES);

  it('has one unique path per procedure', () => {
    expect(paths.length).toBeGreaterThan(0);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it.each(Object.entries(API_ROUTES))(
    '%s is an absolute path without a trailing slash',
    (_, path) => {
      expect(path).toMatch(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/);
    }
  );

  it('keeps the routes the web app and the contract rely on', () => {
    expect(API_ROUTES.sessionCreate).toBe('/exam/session/create');
    expect(API_ROUTES.sessionToken).toBe('/exam/session/token');
    expect(API_ROUTES.attemptsComplete).toBe('/attempts/complete');
    expect(API_ROUTES.exercisesFeatured).toBe('/exercises/featured');
  });
});

describe('package entry point', () => {
  it('re-exports the task types, schemas and pricing helpers', () => {
    expect(shared.TCF_TASK_TYPES).toBeDefined();
    expect(shared.TASK_DURATIONS).toBeDefined();
    expect(typeof shared.createExamSessionInputSchema.parse).toBe('function');
    expect(typeof shared.attemptSummarySchema.parse).toBe('function');
    expect(typeof shared.evaluationOutputSchema.parse).toBe('function');
    expect(typeof shared.audioUploadInputSchema.parse).toBe('function');
    expect(typeof shared.listExercisesInputSchema.parse).toBe('function');
    expect(typeof shared.estimateCost).toBe('function');
  });

  it('re-exports the default voice models', () => {
    expect(shared.DEFAULT_OPENAI_REALTIME_MODEL).toBe('gpt-realtime-2.1-mini');
    expect(shared.DEFAULT_GEMINI_LIVE_MODEL).toBe('gemini-3.8-live');
  });
});
