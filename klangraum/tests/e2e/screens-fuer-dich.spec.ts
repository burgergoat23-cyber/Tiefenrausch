import { test } from '@playwright/test';
import { mockMusicApis } from './mocks';

/** Screenshot „Für dich“ (nur mit SCREENS=1). Songs und Cover sind Testdaten. */
test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshot Für dich', async ({ page }, info) => {
  await mockMusicApis(page);
  await page.goto('/');
  await page.getByTestId('for-you').getByRole('button', { name: 'Mix abspielen' }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `docs/screenshots/fuer-dich/${info.project.name}-start.png` });
  await page.getByRole('heading', { name: 'Playlists: Drill' }).scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `docs/screenshots/fuer-dich/${info.project.name}-playlists.png` });
  await page.goto('/#/einstellungen');
  await page.getByRole('heading', { name: 'Deine Musik' }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `docs/screenshots/fuer-dich/${info.project.name}-deine-musik.png`,
  });
});
