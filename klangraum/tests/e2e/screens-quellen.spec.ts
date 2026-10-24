import { test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

/** Screenshots der neuen Quellen (nur mit SCREENS=1) */
test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshots neue Quellen', async ({ page }, info) => {
  const shot = (name: string, fullPage = false) =>
    page.screenshot({
      path: `docs/screenshots/quellen/${info.project.name}-${name}.png`,
      fullPage,
    });
  await mockMusicApis(page);
  await page.goto('/#/suche?q=rock');
  await page
    .getByTestId('results-radio')
    .getByRole('button', { name: /abspielen/ })
    .nth(1)
    .click();
  await expectAudioPlaying(page);
  await page.getByTestId('results-radio').scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  await shot('1-suche-radio');
  await page.goto('/#/player');
  await page.waitForTimeout(400);
  await shot('2-player-live');
  await page.goto('/#/suche?q=park&typ=album');
  await page.getByTestId('results-archive').getByRole('link').first().waitFor();
  await page.waitForLoadState('networkidle');
  await shot('3-alben-archive');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await shot('4-start', true);
});
