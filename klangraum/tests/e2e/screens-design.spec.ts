import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

/** Screenshots vom Design (nur mit SCREENS=1). Cover und Songs sind Testdaten. */
test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshots Design', async ({ page }, info) => {
  const shot = (name: string, fullPage = false) =>
    page.screenshot({ path: `docs/screenshots/design/${info.project.name}-${name}.png`, fullPage });
  await mockMusicApis(page);
  await page.goto('/');
  await page.getByTestId('for-you').getByRole('button', { name: 'Mix abspielen' }).click();
  await expect(page.getByTestId('fake-youtube')).toHaveAttribute('data-state', '1');
  await page.getByTestId('mini-player').getByRole('button', { name: 'Nächster Song' }).click();
  await expectAudioPlaying(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // Cover nachladen
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('1-start');
  await shot('1-start-ganz', true);
  await page.goto('/#/suche?q=nacht');
  await page
    .getByTestId('results-audius')
    .getByRole('button', { name: /abspielen/ })
    .first()
    .waitFor();
  await page.waitForLoadState('networkidle');
  await shot('2-suche');
  await page.goto('/#/player');
  await page.waitForTimeout(600);
  await shot('3-player');
  await page.goto('/#/anpassen');
  await page.getByRole('button', { name: 'Theme „Hell“ wählen' }).click();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await shot('4-start-hell');
});
