import { expect, test } from '@playwright/test';
import { mockMusicApis } from './mocks';

/** Screenshots YouTube (nur mit SCREENS=1). Das rote Feld ist der nachgebaute Test-Player. */
test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshots YouTube', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `docs/screenshots/youtube/${info.project.name}-${name}.png` });
  await mockMusicApis(page);
  await page.goto('/#/suche?q=sommer&quelle=youtube');
  await page
    .getByTestId('results-youtube')
    .getByRole('button', { name: /abspielen/ })
    .first()
    .click();
  await expect(page.getByTestId('fake-youtube')).toHaveAttribute('data-state', '1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await shot('1-suche-video-klein');
  await page.getByRole('link', { name: 'Video groß anzeigen' }).click();
  await page.waitForTimeout(500);
  await shot('2-player-video');
  await page.goto('/#/einstellungen');
  await page.getByLabel('YouTube-API-Schlüssel').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot('3-einstellungen');
});
