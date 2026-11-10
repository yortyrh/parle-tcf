import { expect, test } from '@playwright/test';
import { expectAccessible, expectB1Result, saveProviderKey, signUpAndVerify } from './flows';

test.describe('practice', () => {
  test('Tâche 2 from the practice page: preparation, scripted session, B1 result', async ({
    page,
  }) => {
    await signUpAndVerify(page, 'practice');
    await saveProviderKey(page);

    // Entry point: the "S’entraîner" page of the main navigation.
    await page.goto('/tableau-de-bord');
    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'S’entraîner' })
      .click();
    await expect(page).toHaveURL(/\/tcf$/);
    await expect(page.getByRole('heading', { level: 1, name: 'S’entraîner' })).toBeVisible();
    const start = page.getByRole('button', { name: 'Commencer', exact: true });
    await expect(start).toBeDisabled();
    await expectAccessible(page);

    await page.getByRole('radio', { name: /Tâche 2/ }).click();
    await expect(page.getByRole('radio', { name: /Tâche 2/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await start.click();

    // Tâche 2 opens with the preparation time and the situation to read.
    await expect(page).toHaveURL(/\/tcf\/tache2\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Préparation' })).toBeVisible();
    await expect(page.getByRole('timer', { name: 'Temps de préparation restant' })).toHaveText(
      /^0[12]:\d\d$/
    );
    await expect(page.locator('blockquote')).not.toBeEmpty();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Je suis prêt(e)' }).click();

    // The fake examiner plays its script, then ends the task itself.
    await expect(page.getByRole('tab', { name: 'Conversation' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'Conversation' }).click();
    await expect(
      page.getByText('Bonjour, je voudrais des informations sur les horaires du club.')
    ).toBeVisible();
    await expect(page.getByText('Merci, la tâche est terminée. Au revoir.')).toBeVisible();
    await expectAccessible(page);

    await expect(page).toHaveURL(/\/resultats\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: /Tâche 2/ })).toBeVisible();
    await expectB1Result(page);
    for (const meter of await page.getByRole('meter').all()) {
      await expect(meter).toHaveAttribute('aria-valuetext', 'B1');
    }
    await expect(page.getByRole('heading', { name: 'Vos phrases corrigées' })).toBeVisible();
    await expect(
      page.getByText('Bonjour, je voudrais des informations sur les horaires du club.').first()
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Refaire ce sujet' })).toBeVisible();
    await expectAccessible(page);

    // The attempt now shows on the dashboard with its level.
    await page.goto('/tableau-de-bord');
    await expect(page.getByText('Aucun passage pour l’instant')).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Derniers passages' }).getByRole('link', { name: /Tâche 2/ })
    ).toBeVisible();
  });

  test('without a key, starting a session sends the user to the settings', async ({ page }) => {
    await signUpAndVerify(page, 'practice-nokey');
    await page.goto('/tcf/tache2');
    await expect(page).toHaveURL(/\/parametres$/, { timeout: 20_000 });
    await expect(page.getByTestId('key-status')).toHaveText('Aucune clé enregistrée.');
  });
});
