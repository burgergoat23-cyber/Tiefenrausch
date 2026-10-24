import { expect, test } from '@playwright/test';
import { mockMusicApis } from './mocks';

test.beforeEach(async ({ page }) => {
  await mockMusicApis(page);
});

const bg = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('Theme ändern → neu laden → Theme ist noch da', async ({ page }) => {
  await page.goto('/#/anpassen');
  expect(await bg(page)).toBe('rgb(11, 12, 9)'); // Oliv (Standard)
  await page.getByRole('button', { name: 'Theme „Hell“ wählen' }).click();
  await expect(page.getByRole('button', { name: 'Theme „Hell“ wählen' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await bg(page)).toBe('rgb(246, 247, 251)');
  await page.reload();
  expect(await bg(page)).toBe('rgb(246, 247, 251)');
  await page.getByRole('button', { name: 'Theme „OLED-Schwarz“ wählen' }).click();
  expect(await bg(page)).toBe('rgb(0, 0, 0)');
});

test('Sprache umstellen auf Englisch', async ({ page }) => {
  await page.goto('/#/einstellungen');
  await page.getByRole('combobox', { name: 'Sprache' }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Search' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
