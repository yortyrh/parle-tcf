import { type Page, expect } from '@playwright/test';
import { emailLink, expectNoA11yViolations, uniqueEmail } from './support';

export interface Account {
  name: string;
  email: string;
  password: string;
}

/** A fresh account (not created yet). */
export function newAccount(prefix = 'e2e'): Account {
  return { name: 'Camille', email: uniqueEmail(prefix), password: 'motdepasse-e2e-1' };
}

/** Fills and submits the sign-up form; lands on the "check your inbox" page. */
export async function submitSignUp(page: Page, account: Account): Promise<void> {
  await page.getByLabel('Prénom').fill(account.name);
  await page.getByLabel('Adresse e-mail').fill(account.email);
  await page.getByLabel(/Mot de passe/).fill(account.password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/verifier-email\?email=/);
  await expect(
    page.getByRole('heading', { name: 'Vérifiez votre boîte de réception' })
  ).toBeVisible();
}

/** Opens the confirmation link from Mailpit: verifies and signs in, then the dashboard opens. */
export async function verifyEmail(page: Page, account: Account): Promise<void> {
  await page.goto(await emailLink(account.email, '/verifier-email'));
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await expect(
    page.getByRole('heading', { level: 1, name: `Bonjour ${account.name}` })
  ).toBeVisible();
}

/** Sign up through the UI and confirm the address: the user ends signed in on the dashboard. */
export async function signUpAndVerify(page: Page, prefix = 'e2e'): Promise<Account> {
  const account = newAccount(prefix);
  await page.goto('/inscription');
  await submitSignUp(page, account);
  await verifyEmail(page, account);
  return account;
}

/** Submits the sign-in form (from wherever the page is). */
export async function fillSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** Signs in from /connexion and waits for the dashboard. */
export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto('/connexion');
  await fillSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await expect(
    page.getByRole('heading', { level: 1, name: `Bonjour ${account.name}` })
  ).toBeVisible();
}

/** The API key field of /parametres (its label changes once a key is saved). */
export function keyInput(page: Page) {
  return page
    .getByLabel('Clé API', { exact: true })
    .or(page.getByLabel('Remplacer la clé (optionnel)', { exact: true }));
}

/** Saves a provider key in /parametres (the fake provider accepts any key without "invalid"). */
export async function saveProviderKey(
  page: Page,
  key = 'sk-e2e-valid-key-00001234'
): Promise<void> {
  await page.goto('/parametres');
  await expect(page.getByTestId('key-status')).toBeVisible();
  await keyInput(page).fill(key);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Paramètres enregistrés' })
  ).toBeVisible();
  await expect(page.getByTestId('key-status')).toContainText(`…${key.slice(-4)}`);
}

/**
 * Runs a Tâche 2 session already opening in the page (preparation, then the
 * scripted fake voice session) until the result page opens. Returns the
 * attempt id and the exercise id the session used.
 */
export async function runTache2Session(
  page: Page
): Promise<{ attemptId: string; exerciseId: string }> {
  await expect(page.getByRole('heading', { name: 'Préparation' })).toBeVisible({ timeout: 20_000 });
  // The session syncs the URL with the exercise it loaded: /tcf/tache2/<exerciseId>.
  await expect(page).toHaveURL(/\/tcf\/tache2\/[^/]+$/);
  const exerciseId = decodeURIComponent(new URL(page.url()).pathname.split('/')[3]);
  await page.getByRole('button', { name: 'Je suis prêt(e)' }).click();

  await expect(page.getByRole('tab', { name: 'Conversation' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'Conversation' }).click();
  await expect(
    page.getByText('Bonjour, je voudrais des informations sur les horaires du club.')
  ).toBeVisible();

  // finSession, then the farewell grace period (6 s), then the result page.
  await expect(page).toHaveURL(/\/resultats\/[^/]+$/, { timeout: 30_000 });
  const attemptId = new URL(page.url()).pathname.split('/')[2];
  return { attemptId, exerciseId };
}

/** Practises Tâche 2 from `path` (`/tcf/tache2` or `/tcf/tache2/<exerciseId>`). */
export async function practiseTache2(
  page: Page,
  path = '/tcf/tache2'
): Promise<{ attemptId: string; exerciseId: string }> {
  await page.goto(path);
  return runTache2Session(page);
}

/** Waits for the fake corrector's evaluation on the result page: B1 overall and on all five criteria. */
export async function expectB1Result(page: Page): Promise<void> {
  const evaluation = page.getByRole('region', { name: 'Niveau global' });
  await expect(evaluation).toBeVisible({ timeout: 30_000 });
  await expect(evaluation.getByLabel('Niveau B1')).toHaveCount(6);
  await expect(evaluation.getByRole('meter')).toHaveCount(5);
}

/** Signs out from the account menu of the app header. */
export async function signOut(page: Page, account: Account): Promise<void> {
  await page.getByRole('button', { name: `Menu du compte (${account.email})` }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
}

/**
 * The visible alert with this text. Filtering by text matters: Next.js also
 * renders an (empty) role="alert" route announcer on every page.
 */
export function alertWith(page: Page, text: string | RegExp) {
  return page.getByRole('alert').filter({ hasText: text });
}

/** The visible status message with this text. */
export function statusWith(page: Page, text: string | RegExp) {
  return page.getByRole('status').filter({ hasText: text });
}

/**
 * Axe check of a settled page. On client-side navigation Next.js streams the
 * metadata, so `document.title` is briefly empty: wait for the title first,
 * then run the WCAG check (a page that never gets a title still fails).
 */
export async function expectAccessible(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/\S/);
  await expectNoA11yViolations(page);
}
