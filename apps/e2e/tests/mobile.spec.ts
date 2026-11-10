import { type Page, expect, test } from '@playwright/test';
import { expectAccessible, fillSignIn, signOut, signUpAndVerify } from './flows';

/** The page is not wider than the viewport (no horizontal scrolling). */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe('phone layout @mobile', () => {
  test.beforeEach(({ isMobile }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile' || !isMobile, 'Runs in the mobile project only');
  });

  test('landing, sign-in and the dashboard fit a phone; the menu navigates @mobile', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /expression orale du TCF/ })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Commencer gratuitement' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);

    // Sign up (in the same phone context) to get an account, then sign in from the landing.
    const account = await signUpAndVerify(page, 'mobile');
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);

    // The desktop navigation is hidden; the menu button opens it in a sheet.
    const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    const sheet = page.getByRole('dialog', { name: 'Menu' });
    await expect(sheet).toBeVisible();
    const nav = sheet.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link')).toHaveCount(6);
    await expect(nav.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expectAccessible(page);

    await nav.getByRole('link', { name: 'Historique' }).click();
    await expect(page).toHaveURL(/\/historique$/);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Historique' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await menuButton.click();
    await expect(
      page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Historique' })
    ).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();

    // Sign-in screen at phone width.
    await signOut(page, account);
    await page.goto('/');
    await page.getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);

    await fillSignIn(page, account.email, account.password);
    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    await expect(
      page.getByRole('heading', { level: 1, name: `Bonjour ${account.name}` })
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
