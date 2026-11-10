import { expect, test } from '@playwright/test';
import {
  alertWith,
  expectAccessible,
  fillSignIn,
  signIn,
  signOut,
  signUpAndVerify,
  statusWith,
} from './flows';
import { emailLink } from './support';

test.describe('authentication', () => {
  test('sign out from the account menu, then sign in again in the same tab', async ({ page }) => {
    const account = await signUpAndVerify(page, 'auth');

    await signOut(page, account);
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
    await expectAccessible(page);

    await fillSignIn(page, account.email, account.password);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(
      page.getByRole('heading', { level: 1, name: `Bonjour ${account.name}` })
    ).toBeVisible();
    // Signed in for good: the app does not bounce back to the sign-in page.
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
  });

  test('the app area sends a signed-out visitor to sign-in, then back', async ({ page }) => {
    const account = await signUpAndVerify(page, 'auth-gate');
    await signOut(page, account);

    await page.goto('/historique');
    await expect(page).toHaveURL(/\/connexion\?next=%2Fhistorique$/);

    await page.reload();
    await fillSignIn(page, account.email, account.password);
    await expect(page).toHaveURL(/\/historique$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Historique' })).toBeVisible();
  });

  test('a wrong password shows an error and keeps the user signed out', async ({ page }) => {
    const account = await signUpAndVerify(page, 'auth-wrong');
    await signOut(page, account);

    await fillSignIn(page, account.email, 'pas-le-bon-mot-de-passe');
    await expect(alertWith(page, 'E-mail ou mot de passe incorrect.')).toBeVisible();
    await expect(page).toHaveURL(/\/connexion$/);
    await expectAccessible(page);

    // An unknown address gets the same message.
    await fillSignIn(page, `inconnu-${account.email}`, account.password);
    await expect(alertWith(page, 'E-mail ou mot de passe incorrect.')).toBeVisible();
  });

  test('forgot password → email link → new password → sign in', async ({ page }) => {
    const account = await signUpAndVerify(page, 'auth-reset');
    await signOut(page, account);

    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
    await expect(page).toHaveURL(/\/mot-de-passe-oublie$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mot de passe oublié' })
    ).toBeVisible();
    await expectAccessible(page);

    await page.getByLabel('Adresse e-mail').fill(account.email);
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(
      statusWith(page, /Si un compte existe avec cette adresse, un e-mail vient d.être envoyé\./)
    ).toBeVisible();

    await page.goto(await emailLink(account.email, '/reinitialiser'));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nouveau mot de passe' })
    ).toBeVisible();
    await expectAccessible(page);

    const newPassword = 'nouveau-mot-de-passe-2';
    await page.getByLabel(/Nouveau mot de passe/).fill(newPassword);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    // The old password no longer works; the new one does.
    await fillSignIn(page, account.email, account.password);
    await expect(alertWith(page, 'E-mail ou mot de passe incorrect.')).toBeVisible();
    await signIn(page, { ...account, password: newPassword });
  });

  test('a reset link cannot be used twice', async ({ page }) => {
    const account = await signUpAndVerify(page, 'auth-reuse');
    await signOut(page, account);

    await page.goto('/mot-de-passe-oublie');
    await page.getByLabel('Adresse e-mail').fill(account.email);
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(statusWith(page, 'Si un compte existe')).toBeVisible();
    const link = await emailLink(account.email, '/reinitialiser');

    await page.goto(link);
    await page.getByLabel(/Nouveau mot de passe/).fill('premier-nouveau-1');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    await page.goto(link);
    await page.getByLabel(/Nouveau mot de passe/).fill('second-nouveau-2');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      alertWith(page, 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.')
    ).toBeVisible();
  });
});
