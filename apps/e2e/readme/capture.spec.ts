import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Page, expect, test } from '@playwright/test';
import { saveProviderKey, signUpAndVerify } from '../tests/flows';
import { withDemoEvaluation, withDemoLevel } from './demo-attempt';

/**
 * Not a test: regenerates the README images (`pnpm readme:images`). The subject is a
 * sample-bank one (packages/db/seed) whose topic matches the fake examiner's script; the
 * result page shows the illustrative evaluation of ./demo-attempt.ts instead of the fake
 * corrector's placeholder.
 */
const ROOT = resolve(import.meta.dirname, '../../..');
const IMAGES = resolve(ROOT, 'docs/images');
const SAMPLE_TACHE2 = '2026-09-t2-p001-s003';

async function shoot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(IMAGES, `${name}.png`), animations: 'disabled' });
}

test('social preview', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto(pathToFileURL(resolve(ROOT, '.github/social-preview.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(ROOT, '.github/social-preview.png') });
});

test('app screenshots', async ({ page }) => {
  await page.goto('/');
  await shoot(page, 'landing');

  await signUpAndVerify(page, 'readme');
  await saveProviderKey(page);

  await page.route('**/attempts/get', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: withDemoEvaluation(body) });
  });
  await page.route('**/attempts/list', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { items: Record<string, unknown>[] };
    await route.fulfill({ response, json: { ...body, items: body.items.map(withDemoLevel) } });
  });

  await page.goto(`/tcf/tache2/${SAMPLE_TACHE2}`);
  await expect(page.getByRole('heading', { name: 'Préparation' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('blockquote')).not.toBeEmpty();
  await shoot(page, 'preparation');

  await page.getByRole('button', { name: 'Je suis prêt(e)' }).click();
  await expect(page).toHaveURL(/\/resultats\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Niveau global' })).toBeVisible({
    timeout: 30_000,
  });
  await shoot(page, 'result');

  // Taller shot so every error type of the demo transcript shows.
  await page.setViewportSize({ width: 1280, height: 1180 });
  await page
    .getByRole('heading', { name: 'Vos phrases corrigées' })
    .evaluate((heading) =>
      window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 96)
    );
  await shoot(page, 'corrections');
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/tableau-de-bord');
  await expect(
    page.getByRole('region', { name: 'Derniers passages' }).getByRole('link', { name: /Tâche 2/ })
  ).toBeVisible();
  await shoot(page, 'dashboard');
});
