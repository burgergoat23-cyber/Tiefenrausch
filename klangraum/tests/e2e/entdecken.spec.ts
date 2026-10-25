import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

test('Entdecken lädt beim Scrollen nach, Endlos-Mix spielt weiter', async ({ page }) => {
  await mockMusicApis(page, { audioSeconds: 2 });
  await page.goto('/#/entdecken');
  await expect(page.getByRole('heading', { level: 1, name: 'Entdecken' })).toBeVisible();
  // Gesamtzahl: YouTube-Playlists (42.000 + 8.000) + Jamendo (41.250) + Internet Archive (8.750)
  await expect(page.getByTestId('discover-count')).toContainText('Mindestens 100.000 Songs: Drill');
  await expect(page.getByTestId('discover-count')).toContainText('Videos aus 2 großen Playlists');
  await expect(page.getByRole('img', { name: 'Quelle: YouTube' }).first()).toBeVisible();
  await expect(page.getByTestId('discover-count')).toContainText('Audius verrät keine Zahl');
  const rows = page.getByRole('list', { name: 'Songs: Drill' }).getByRole('listitem');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => rows.count()).toBeGreaterThan(before);

  await page.getByRole('button', { name: 'Hip-Hop' }).click();
  await expect(page.getByRole('list', { name: 'Songs: Hip-Hop' })).toBeVisible();
  await page.getByRole('button', { name: 'Endlos-Mix' }).click();
  await expectAudioPlaying(page);
});
