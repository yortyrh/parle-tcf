import { expect, test } from '@playwright/test';
import {
  alertWith,
  expectAccessible,
  fillSignIn,
  saveProviderKey,
  signUpAndVerify,
  statusWith,
} from './flows';
import { emailLink } from './support';

test.describe('account deletion', () => {
  test('request → email link → confirm → the account is gone', async ({ page }) => {
    const account = await signUpAndVerify(page, 'delete');
    await saveProviderKey(page);

    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    await expect(statusWith(page, 'Un e-mail de confirmation vous a été envoyé')).toBeVisible();
    await expectAccessible(page);

    await page.goto(await emailLink(account.email, '/compte/suppression'));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Supprimer votre compte' })
    ).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Compte supprimé' })).toBeVisible();
    await expect(
      page.getByText('Votre compte et toutes vos données ont été effacés.')
    ).toBeVisible();
    await expectAccessible(page);

    // Signed out, and the credentials no longer work.
    await page.goto('/tableau-de-bord');
    await expect(page).toHaveURL(/\/connexion\?next=/);
    await fillSignIn(page, account.email, account.password);
    await expect(alertWith(page, 'E-mail ou mot de passe incorrect.')).toBeVisible();
  });

  test('the deletion link does nothing until it is confirmed', async ({ page }) => {
    const account = await signUpAndVerify(page, 'delete-cancel');

    await page.goto('/parametres');
    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    await expect(statusWith(page, 'Un e-mail de confirmation')).toBeVisible();

    await page.goto(await emailLink(account.email, '/compte/suppression'));
    await page.getByRole('link', { name: 'Annuler' }).click();
    await expect(page).toHaveURL(/\/parametres$/);

    // Still a working account.
    await page.goto('/tableau-de-bord');
    await expect(
      page.getByRole('heading', { level: 1, name: `Bonjour ${account.name}` })
    ).toBeVisible();
  });

  test('a deletion page without a token cannot delete anything', async ({ page }) => {
    await page.goto('/compte/suppression');
    await expect(alertWith(page, 'Lien incomplet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supprimer définitivement' })).toBeDisabled();
  });
});
