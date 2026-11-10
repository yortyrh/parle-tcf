import { expect, test } from '@playwright/test';
import { WEB_URL } from '../playwright.config';
import {
  expectAccessible,
  expectB1Result,
  practiseTache2,
  runTache2Session,
  saveProviderKey,
  signUpAndVerify,
  statusWith,
} from './flows';

test.describe('history and comparison', () => {
  test('two attempts on the same subject are listed and compared', async ({ page }) => {
    test.setTimeout(120_000);
    await signUpAndVerify(page, 'history');
    await saveProviderKey(page);

    const first = await practiseTache2(page);
    await expectB1Result(page);
    // Second attempt on the same subject, from the result page.
    await page.getByRole('link', { name: 'Refaire ce sujet' }).click();
    const second = await runTache2Session(page);
    await expectB1Result(page);
    expect(second.exerciseId).toBe(first.exerciseId);
    expect(second.attemptId).not.toBe(first.attemptId);

    await page.goto('/historique');
    await expect(page.getByRole('heading', { level: 1, name: 'Historique' })).toBeVisible();
    await expect(page).toHaveTitle('Historique · parle-tcf');
    const rows = page.getByRole('table').getByRole('row');
    await expect(rows).toHaveCount(3); // header + two attempts
    await expect(page.getByRole('cell', { name: 'Tâche 2 · Interaction' })).toHaveCount(2);
    await expect(page.getByRole('cell', { name: 'Pratique' })).toHaveCount(2);
    await expect(page.getByText('1–2 sur 2')).toBeVisible();
    await expectAccessible(page);

    // The task filter narrows the list.
    await page.getByLabel('Tâche').selectOption('3');
    await expect(page.getByText('Aucune tentative avec ces filtres')).toBeVisible();
    await page.getByLabel('Tâche').selectOption('');
    await expect(rows).toHaveCount(3);

    const boxes = page.getByRole('checkbox', { name: 'Sélectionner pour comparer' });
    await boxes.nth(0).check();
    await expect(page.getByRole('link', { name: 'Comparer la sélection' })).toHaveCount(0);
    await boxes.nth(1).check();
    await expect(statusWith(page, 'Seules deux tentatives')).toHaveCount(0);
    await page.getByRole('link', { name: 'Comparer la sélection' }).click();

    await expect(page).toHaveURL(/\/comparer\?a=[^&]+&b=[^&]+$/);
    const url = new URL(page.url());
    expect([url.searchParams.get('a'), url.searchParams.get('b')].sort()).toEqual(
      [first.attemptId, second.attemptId].sort()
    );
    await expect(
      page.getByRole('heading', { level: 1, name: 'Comparer deux tentatives' })
    ).toBeVisible();
    await expect(page).toHaveTitle('Comparer · parle-tcf');
    const columns = page.getByRole('region', { name: /^Tentative du / });
    await expect(columns).toHaveCount(2);
    for (const column of await columns.all()) {
      await expect(column.getByRole('heading', { name: 'Tâche 2 · Interaction' })).toBeVisible();
      await expect(column.getByText('Niveau global')).toBeVisible();
      await expect(
        column.getByText('Bonjour, je voudrais des informations sur les horaires du club.')
      ).toBeVisible();
    }
    await expectAccessible(page);
  });

  test('a new account has an empty history', async ({ page }) => {
    await signUpAndVerify(page, 'history-empty');
    await page.goto('/historique');
    await expect(page.getByText('Aucune tentative pour le moment')).toBeVisible();
    await expect(page.getByRole('link', { name: 'S’entraîner' }).last()).toBeVisible();
    await expectAccessible(page);
  });

  test('another user’s attempt cannot be opened', async ({ page, browser }) => {
    test.setTimeout(120_000);
    await signUpAndVerify(page, 'history-owner');
    await saveProviderKey(page);
    const { attemptId } = await practiseTache2(page);

    const other = await browser.newContext({ baseURL: WEB_URL, locale: 'fr-FR' });
    const otherPage = await other.newPage();
    await signUpAndVerify(otherPage, 'history-other');
    await otherPage.goto(`/resultats/${attemptId}`);
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Résultat' })).toBeVisible();
    await expect(otherPage.getByText('Bonjour, je voudrais des informations')).toHaveCount(0);
    await expect(otherPage.getByLabel('Niveau B1')).toHaveCount(0);
    await other.close();
  });
});
