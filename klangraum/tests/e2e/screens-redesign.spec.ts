import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

/**
 * Screenshots vom neuen Design (nur mit SCREENS=1). Cover sind Testbilder; einige Bilder
 * schlagen absichtlich fehl, damit die gestalteten Cover zu sehen sind.
 */
test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshots Redesign', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `docs/screenshots/redesign/${info.project.name}-${name}.png` });
  await mockMusicApis(page);
  // Jedes zweite Testbild „kaputt“ → gestaltetes Cover
  await page.route(/^https:\/\/img\.test\/(au[1357]|j100[13])\./, (r) =>
    r.fulfill({ status: 404 }),
  );
  await page.goto('/');
  await page
    .getByRole('button', { name: /„Neonlicht“ abspielen/ })
    .first()
    .click();
  await expectAudioPlaying(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('1-start');
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(300);
  await shot('2-start-unten');
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
  await page.goto('/#/player');
  await page.waitForTimeout(800);
  await shot('5-player');
});
