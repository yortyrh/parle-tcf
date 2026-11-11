import { type Page, expect, test } from '@playwright/test';
import { expectAccessible, saveProviderKey, signUpAndVerify } from './flows';

/** Accent- and case-insensitive text, as the API's topic search compares it. */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The "N sujet(s)" count line, once loaded. */
async function subjectCount(page: Page): Promise<number> {
  const status = page.getByRole('status').filter({ hasText: /^\d+ sujets?$/ });
  await expect(status).toBeVisible();
  return Number((await status.textContent())!.split(' ')[0]);
}

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Rechercher' });
const taskButton = (page: Page, task: 2 | 3) =>
  page.getByRole('group', { name: 'Tâche' }).getByRole('button', { name: `Tâche ${task}` });
const practiceLinks = (page: Page) => page.getByRole('link', { name: 'S’entraîner sur ce sujet' });

test.describe('topic picker', () => {
  test('search and task filter', async ({ page }) => {
    await signUpAndVerify(page, 'topics');

    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Sujets' })
      .click();
    await expect(page).toHaveURL(/\/sujets$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sujets' })).toBeVisible();

    // Tâche 2 by default, 20 subjects per page.
    await expect(taskButton(page, 2)).toHaveAttribute('aria-pressed', 'true');
    await expect(taskButton(page, 3)).toHaveAttribute('aria-pressed', 'false');
    const allTache2 = await subjectCount(page);
    expect(allTache2).toBeGreaterThan(20);
    await expect(practiceLinks(page)).toHaveCount(20);
    await expect(practiceLinks(page).first()).toHaveAttribute('href', /^\/tcf\/tache2\/.+/);
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
    await expectAccessible(page);

    // Search: a keyword narrows the list to matching subjects, accents and case ignored.
    await searchBox(page).fill('logement');
    await expect.poll(() => subjectCount(page)).toBeLessThan(allTache2);
    const matching = await subjectCount(page);
    expect(matching).toBeGreaterThan(0);
    const prompts = await page
      .getByRole('listitem')
      .filter({ has: practiceLinks(page) })
      .allTextContents();
    expect(prompts.length).toBe(Math.min(matching, 20));
    for (const prompt of prompts) expect(fold(prompt)).toContain('logement');

    await searchBox(page).fill('LOGEMENT');
    await expect.poll(() => subjectCount(page)).toBe(matching);

    await searchBox(page).fill('zzqx-aucun-sujet');
    await expect(page.getByText('Aucun sujet trouvé')).toBeVisible();
    await expect(practiceLinks(page)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /^0 sujet$/ })).toBeVisible();
    await expectAccessible(page);

    // Pagination moves to the next 20 (Tâche 2: the sample bank has more than 20 subjects).
    await searchBox(page).fill('');
    await expect.poll(() => subjectCount(page)).toBe(allTache2);
    const firstOnPage1 = await practiceLinks(page).first().getAttribute('href');
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('button', { name: 'Suivant' })
      .click();
    await expect(page.getByText(/^Page 2 \/ \d+$/)).toBeVisible();
    await expect(practiceLinks(page).first()).not.toHaveAttribute('href', firstOnPage1!);

    // Task filter: Tâche 3 subjects only.
    await taskButton(page, 3).click();
    await expect(taskButton(page, 3)).toHaveAttribute('aria-pressed', 'true');
    await expect(taskButton(page, 2)).toHaveAttribute('aria-pressed', 'false');
    await expect(practiceLinks(page).first()).toHaveAttribute('href', /^\/tcf\/tache3\/.+/);
    for (const href of await practiceLinks(page).evaluateAll((links) =>
      links.map((l) => l.getAttribute('href'))
    )) {
      expect(href).toMatch(/^\/tcf\/tache3\//);
    }
    expect(await subjectCount(page)).toBeGreaterThan(0);
  });

  test('starting from a chosen subject opens that subject', async ({ page }) => {
    await signUpAndVerify(page, 'topics-start');
    await saveProviderKey(page);

    await page.goto('/sujets');
    await searchBox(page).fill('logement');
    await expect(page.getByRole('status').filter({ hasText: /^\d+ sujets?$/ })).toBeVisible();
    await expect(practiceLinks(page).first()).toBeVisible();

    const item = page
      .getByRole('listitem')
      .filter({ has: practiceLinks(page) })
      .nth(0);
    const prompt = (await item.locator('p').first().textContent())!.trim();
    const href = (await item
      .getByRole('link', { name: 'S’entraîner sur ce sujet' })
      .getAttribute('href'))!;
    await item.getByRole('link', { name: 'S’entraîner sur ce sujet' }).click();

    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(page.getByRole('heading', { name: 'Préparation' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('blockquote')).toHaveText(prompt);
    await expectAccessible(page);
  });
});
