import { expect, test, type Page } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

test.beforeEach(async ({ page }) => {
  await mockMusicApis(page);
});

/** Liegt das Video-Fenster genau über dem Platzhalter und ist es groß genug (YouTube: mind. 200 × 200)? */
async function videoBox(page: Page) {
  const host = await page.getByTestId('video-host').boundingBox();
  if (!host) throw new Error('kein Video-Fenster');
  return host;
}

test('YouTube: erst nach „Suchen“ fragen, offizieller Player bleibt sichtbar', async ({ page }) => {
  await page.goto('/#/suche');
  await page.getByRole('searchbox').fill('hit');
  // Beim Tippen fragen wir YouTube noch nicht (spart Kontingent)
  const yt = page.getByTestId('results-youtube');
  await expect(yt.getByRole('button', { name: 'Jetzt bei YouTube suchen' })).toBeVisible();
  await yt.getByRole('button', { name: 'Jetzt bei YouTube suchen' }).click();
  await yt.getByRole('button', { name: /„Sommerhit 2026 \(Official Video\)“ abspielen/ }).click();

  // Kleines Video-Fenster über dem Mini-Player
  const fake = page.getByTestId('fake-youtube');
  await expect(fake).toHaveAttribute('data-state', '1');
  await expect(fake).toHaveAttribute('data-video', 'ytvideo0001');
  await expect(page.getByTestId('video-float')).toBeVisible();
  const small = await videoBox(page);
  expect(small.width).toBeGreaterThanOrEqual(199);
  expect(small.height).toBeGreaterThanOrEqual(199);
  await expect(page.getByTestId('mini-player')).toContainText('Sommerhit 2026');
  await expect(
    page.getByTestId('mini-player').getByRole('img', { name: 'Quelle: YouTube' }),
  ).toBeVisible();

  // Groß im Vollbild-Player – das Video läuft dabei weiter (kein Neuladen)
  await page.getByRole('link', { name: 'Video groß anzeigen' }).click();
  const slot = await page.getByTestId('video-slot').boundingBox();
  await expect.poll(async () => (await videoBox(page)).width).toBeGreaterThan(small.width);
  const big = await videoBox(page);
  expect(Math.abs(big.x - (slot?.x ?? 0))).toBeLessThan(2);
  expect(Math.abs(big.y - (slot?.y ?? 0))).toBeLessThan(2);
  await expect(fake).toHaveAttribute('data-state', '1');
  await expect(page.getByTestId('fake-youtube')).toHaveCount(1);

  // Steuerung über unsere Knöpfe
  const player = page.getByTestId('full-player');
  await player.getByRole('button', { name: 'Pause' }).click();
  await expect(fake).toHaveAttribute('data-state', '2');
  await player.getByRole('button', { name: 'Abspielen' }).click();
  await expect(fake).toHaveAttribute('data-state', '1');
  await player.getByRole('button', { name: 'Nächster Song' }).click();
  await expect(fake).toHaveAttribute('data-video', 'ytvideo0002');
  await expect(player.getByRole('heading', { name: 'Ballade & Klavier' })).toBeVisible();

  // Schließen: Video hält an und verschwindet
  await player.getByRole('button', { name: 'Player schließen' }).click();
  await page.getByRole('button', { name: 'Video anhalten und ausblenden' }).click();
  await expect(fake).toHaveAttribute('data-state', '2');
  await expect(page.getByTestId('video-float')).toHaveCount(0);
  await expect(page.getByTestId('video-host')).toBeHidden();
});

test('Wechsel von YouTube zu Audius: Video stoppt, eigenes Audio läuft', async ({ page }) => {
  await page.goto('/#/suche?q=mix');
  await page
    .getByTestId('results-youtube')
    .getByRole('button', { name: /„Club Remix“ abspielen/ })
    .click();
  const fake = page.getByTestId('fake-youtube');
  await expect(fake).toHaveAttribute('data-state', '1');
  await page
    .getByTestId('results-audius')
    .getByRole('button', { name: /„mix Neonlicht“ abspielen/ })
    .click();
  await expectAudioPlaying(page);
  await expect(fake).toHaveAttribute('data-state', '-1');
  await expect(page.getByTestId('video-float')).toHaveCount(0);
  await expect(page.getByTestId('video-host')).toBeHidden();
});

test('YouTube-Schlüssel in den Einstellungen, Hinweise und Links zu den Bedingungen', async ({
  page,
}) => {
  await page.goto('/#/einstellungen');
  await page.getByLabel('YouTube-API-Schlüssel').fill('Mein_Schlüssel!');
  await page.getByLabel('YouTube-API-Schlüssel').press('Enter');
  await expect(
    page.getByText('Der Schlüssel darf nur Buchstaben, Zahlen, - und _ enthalten.'),
  ).toBeVisible();
  await page.getByLabel('YouTube-API-Schlüssel').fill('AIza-test_123');
  await page.getByLabel('YouTube-API-Schlüssel').press('Enter');
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'YouTube-Nutzungsbedingungen' })).toHaveAttribute(
    'href',
    'https://www.youtube.com/t/terms',
  );
});
