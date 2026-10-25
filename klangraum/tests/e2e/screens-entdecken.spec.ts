import { test } from '@playwright/test';
import { mockMusicApis } from './mocks';

test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshot Entdecken', async ({ page }, info) => {
  await mockMusicApis(page);
  await page.goto('/#/entdecken');
  await page.getByTestId('discover-count').getByText(/^[1-9]/).waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `docs/screenshots/features/${info.project.name}-8-entdecken.png` });
});
