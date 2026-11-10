import { expect, test } from '@playwright/test';
import {
  alertWith,
  expectAccessible,
  fillSignIn,
  newAccount,
  submitSignUp,
  verifyEmail,
} from './flows';

test.describe('sign-up', () => {
  test('landing → sign-up → email verification → dashboard', async ({ page }) => {
    const account = newAccount('signup');

    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /expression orale du TCF/ })
    ).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('link', { name: 'Commencer gratuitement' }).click();
    await expect(page).toHaveURL(/\/inscription$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Créer un compte' })).toBeVisible();
    await expectAccessible(page);

    await submitSignUp(page, account);
    await expect(
      page.getByText(`Nous avons envoyé un lien de confirmation à ${account.email}.`)
    ).toBeVisible();
    await expectAccessible(page);

    await verifyEmail(page, account);
    // A new account has no key and no attempt yet.
    await expect(page.getByRole('link', { name: 'Ajouter ma clé' })).toBeVisible();
    await expect(page.getByText('Aucun passage pour l’instant')).toBeVisible();
    await expectAccessible(page);
  });

  test('an unverified account cannot sign in', async ({ page }) => {
    const account = newAccount('unverified');
    await page.goto('/inscription');
    await submitSignUp(page, account);

    await page.goto('/connexion');
    await fillSignIn(page, account.email, account.password);
    await expect(
      alertWith(page, /Confirmez votre adresse e-mail avant de vous connecter/)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test('signing up again with a used address does not reveal the account', async ({ page }) => {
    const account = newAccount('dup');
    await page.goto('/inscription');
    await submitSignUp(page, account);

    // Same answer as a fresh sign-up: no account enumeration.
    await page.goto('/inscription');
    await submitSignUp(page, { ...account, name: 'Autre' });
    await expect(alertWith(page, /compte existe/)).toHaveCount(0);
  });
});
