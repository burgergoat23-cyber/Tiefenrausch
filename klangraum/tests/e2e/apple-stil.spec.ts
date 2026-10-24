import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

test.beforeEach(async ({ page }) => {
  await mockMusicApis(page);
});

test('Radio-Seite: beliebte Sender und Sender nach Genre', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Radio' }).click();
  await expect(page.getByRole('heading', { name: 'Radio', level: 1 })).toBeVisible();
  await expect(
    page.getByTestId('radio-popular').getByRole('button', { name: /„Welle Nord“ abspielen/ }),
  ).toBeVisible();
  // Lieblingsgenre steht vorne und ist gewählt
  await expect(page.getByRole('button', { name: 'Drill', pressed: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rock', exact: true }).click();
  const genre = page.getByTestId('radio-genre');
  await expect(genre.getByRole('heading', { name: 'Sender: Rock' })).toBeVisible();
  await genre.getByRole('button', { name: /„Rockradio 24 rock“ abspielen/ }).click();
  await expectAudioPlaying(page);
});

test('Großer Player zeigt auf breiten Bildschirmen die Warteschlange daneben', async ({
  page,
}, info) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: /„Mitternachtsfahrt“ abspielen/ })
    .first()
    .click();
  await expectAudioPlaying(page);
  await page.goto('/#/player');
  const panel = page.getByTestId('player-queue');
  if (info.project.name === 'iphone') {
    await expect(panel).toHaveCount(0); // am Handy über den Knopf oben rechts
    return;
  }
  await expect(panel.getByRole('heading', { name: 'Als Nächstes' })).toBeVisible();
  await expect(panel.getByTestId('queue-item')).toHaveCount(7);
  await panel.getByRole('button', { name: '„Tiefsee“ abspielen' }).click();
  await expect(
    page.getByTestId('full-player').getByRole('heading', { name: 'Tiefsee' }),
  ).toBeVisible();
});

test('Standard-Theme ist Oliv, Khaki lässt sich wählen', async ({ page }) => {
  await page.goto('/#/einstellungen');
  await page.getByRole('link', { name: 'Aussehen anpassen (Themes)' }).click();
  await expect(page.getByRole('button', { name: 'Theme „Oliv“ wählen' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Theme „Khaki“ wählen' }).click();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgb(13, 12, 10)',
  );
});
