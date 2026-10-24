import { test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

/**
 * Screenshots für den Phasen-Abschluss (nur mit SCREENS=1):
 *   SCREENS=1 npx playwright test screens
 * Die Bilder landen in docs/screenshots/<phase>/.
 */
const PHASE = process.env.SCREENS_PHASE ?? 'phase1';
test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshots', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `docs/screenshots/${PHASE}/${info.project.name}-${name}.png` });
  await mockMusicApis(page);

  await page.goto('/');
  await page
    .getByRole('button', { name: /„Neonlicht“ abspielen/ })
    .first()
    .click();
  await expectAudioPlaying(page);
  await page.waitForLoadState('networkidle');
  await shot('1-start');

  await page.goto('/#/suche?q=nacht');
  await page
    .getByTestId('results-jamendo')
    .getByRole('button', { name: /abspielen/ })
    .first()
    .waitFor();
  await page.waitForLoadState('networkidle');
  await shot('2-suche');

  await page.goto('/#/player');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await shot('3-player');

  await page.goto('/#/warteschlange');
  await shot('4-warteschlange');

  await page.goto('/#/anpassen');
  await page.getByRole('button', { name: 'Theme „Hell“ wählen' }).click();
  await page.waitForTimeout(400); // Farbübergang abwarten
  await shot('5-anpassen-hell');

  await page.goto('/#/suche?q=nacht&typ=album');
  await page.getByTestId('results-audius').getByRole('link').first().waitFor();
  await page.waitForLoadState('networkidle');
  await shot('6-alben-hell');

  await page.goto('/#/anpassen');
  await page.getByRole('button', { name: 'Theme „OLED-Schwarz“ wählen' }).click();
  await page.goto('/#/player');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await shot('7-player-oled');

  await page.goto('/#/einstellungen');
  await shot('8-einstellungen-oled');
});
