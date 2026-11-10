import { expect, test } from '@playwright/test';
import {
  alertWith,
  expectAccessible,
  keyInput,
  saveProviderKey,
  signUpAndVerify,
  statusWith,
} from './flows';

test.describe('provider key settings', () => {
  test('a valid key is saved, never shown back, and passes the connection test', async ({
    page,
  }) => {
    await signUpAndVerify(page, 'settings-ok');

    await page.goto('/parametres');
    await expect(page.getByRole('heading', { level: 1, name: 'Paramètres' })).toBeVisible();
    await expect(page.getByTestId('key-status')).toHaveText('Aucune clé enregistrée.');
    // No key yet: nothing to test or delete.
    await expect(page.getByRole('button', { name: 'Tester la connexion' })).toHaveCount(0);
    await expectAccessible(page);

    const key = 'sk-e2e-valid-key-00004321';
    await saveProviderKey(page, key);
    await expect(page.getByTestId('key-status')).toContainText('pas encore vérifiée');
    // The form is reset and the key is only shown by its last four characters.
    await expect(keyInput(page)).toHaveValue('');
    await expect(page.getByText(key)).toHaveCount(0);

    await page.getByRole('button', { name: 'Tester la connexion' }).click();
    await expect(statusWith(page, 'Connexion réussie : la clé fonctionne.')).toBeVisible();
    await expect(page.getByTestId('key-status')).toContainText('vérifiée le');
    await expectAccessible(page);

    // Still there after a reload.
    await page.reload();
    await expect(page.getByTestId('key-status')).toContainText('…4321');
    await expect(page.getByTestId('key-status')).toContainText('vérifiée le');
  });

  test('a key the provider refuses fails the connection test', async ({ page }) => {
    await signUpAndVerify(page, 'settings-bad');

    await saveProviderKey(page, 'sk-invalid-e2e-key-99999');
    await page.getByRole('button', { name: 'Tester la connexion' }).click();
    await expect(alertWith(page, 'Clé API refusée (mode test)')).toBeVisible();
    await expect(page.getByTestId('key-status')).toContainText('pas encore vérifiée');
    await expectAccessible(page);

    // Replacing it with a working key fixes it.
    await saveProviderKey(page, 'sk-e2e-good-key-00000000');
    await page.getByRole('button', { name: 'Tester la connexion' }).click();
    await expect(statusWith(page, 'Connexion réussie')).toBeVisible();
  });

  test('the dashboard stops asking for a key once one is saved', async ({ page }) => {
    await signUpAndVerify(page, 'settings-dash');
    await expect(page.getByRole('link', { name: 'Ajouter ma clé' })).toBeVisible();

    await saveProviderKey(page);
    await page.goto('/tableau-de-bord');
    await expect(page.getByText('Prochaine étape conseillée')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ajouter ma clé' })).toHaveCount(0);
  });
});
