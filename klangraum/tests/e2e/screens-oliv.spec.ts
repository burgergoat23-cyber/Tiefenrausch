import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

/** Screenshots im Oliv-/Khaki-Look (nur mit SCREENS=1). Cover und Songs sind Testdaten. */
test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshots Oliv', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `docs/screenshots/oliv/${info.project.name}-${name}.png` });
  await mockMusicApis(page);
  await page.goto('/');
  await page
    .getByRole('button', { name: /„Neonlicht“ abspielen/ })
    .first()
    .click();
  await expectAudioPlaying(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('1-start');
  await page.goto('/#/player');
  await page.waitForTimeout(800);
  await shot('2-player');
  await page.goto('/#/suche?q=nacht&quelle=audius');
  await page
    .getByTestId('results-audius')
    .getByRole('button', { name: /abspielen/ })
    .first()
    .waitFor();
  await page.waitForLoadState('networkidle');
  await shot('3-suche');
  await page.goto('/#/radio');
  await expect(page.getByTestId('radio-genre')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await shot('4-radio');
  await page.goto('/#/anpassen');
  await page.getByRole('button', { name: 'Theme „Khaki“ wählen' }).click();
  await page.goto('/#/player');
  await page.waitForTimeout(800);
  await shot('5-player-khaki');
});
