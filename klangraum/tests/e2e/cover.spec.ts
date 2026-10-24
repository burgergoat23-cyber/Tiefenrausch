import { expect, test } from '@playwright/test';
import { mockMusicApis } from './mocks';

test('YouTube-Songs bekommen das originale Cover (MusicBrainz + Cover Art Archive)', async ({
  page,
}) => {
  await mockMusicApis(page);
  await page.goto('/#/suche?q=hit&quelle=youtube');
  const first = page
    .getByTestId('results-youtube')
    .getByRole('button', { name: /„Sommerhit 2026 \(Official Video\)“ abspielen/ });
  await expect(first.locator('img')).toHaveAttribute(
    'src',
    'https://coverartarchive.org/release-group/0f0f0f0f-1111-2222-3333-444444444444/front-500',
  );
  // Songs mit eigenem Bild (z. B. Audius) behalten ihr Bild
  await page.goto('/#/suche?q=hit&quelle=audius');
  await expect(
    page
      .getByTestId('results-audius')
      .getByRole('button', { name: /abspielen/ })
      .first()
      .locator('img'),
  ).toHaveAttribute('src', /img\.test/);
});

test('Ohne Bild: ruhiger Platzhalter statt leerer Fläche', async ({ page }) => {
  await mockMusicApis(page);
  await page.route(/^https:\/\/img\.test\//, (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/#/suche?q=nacht&quelle=audius');
  const art = page
    .getByTestId('results-audius')
    .getByRole('button', { name: /abspielen/ })
    .first()
    .locator('[data-placeholder]');
  await expect(art).toBeVisible();
});
