import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

test('Entdecken lädt beim Scrollen nach, Endlos-Mix spielt weiter', async ({ page }) => {
  await mockMusicApis(page, { audioSeconds: 2 });
  await page.goto('/#/entdecken');
  await expect(page.getByRole('heading', { level: 1, name: 'Entdecken' })).toBeVisible();
  const count = page.getByTestId('discover-count');
  await expect(count).toContainText(/^\d+ Songs geladen/);
  const before = Number((await count.textContent())?.match(/\d+/)?.[0]);
  await page.getByRole('main').evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(async () => Number((await count.textContent())?.replace(/\D/g, '').slice(0, 4)))
    .toBeGreaterThan(before);

  await page.getByRole('button', { name: 'Hip-Hop' }).click();
  await expect(page.getByRole('list', { name: 'Songs: Hip-Hop' })).toBeVisible();
  await page.getByRole('button', { name: 'Endlos-Mix' }).click();
  await expectAudioPlaying(page);
});
