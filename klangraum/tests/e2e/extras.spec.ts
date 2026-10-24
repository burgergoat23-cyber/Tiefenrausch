import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

test('Begrüßung beim ersten Start: Künstler wählen', async ({ page }) => {
  await mockMusicApis(page, { welcome: true });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Willkommen bei Klangraum' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'King Von' }).click();
  await dialog.getByRole('button', { name: 'Deutschrap' }).click();
  await dialog.getByRole('button', { name: 'Los geht’s' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/#/einstellungen');
  await expect(page.getByRole('button', { name: '„King Von“ entfernen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '„Deutschrap“ entfernen' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test.describe('mit Testdaten', () => {
  test.beforeEach(async ({ page }) => {
    await mockMusicApis(page);
  });

  test('Eigene Akzentfarbe wird überall benutzt und bleibt gespeichert', async ({ page }) => {
    await page.goto('/#/anpassen');
    await page.getByRole('button', { name: 'Akzentfarbe #6aa8ff' }).click();
    const accent = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--kr-accent'),
      );
    await expect.poll(accent).toBe('#6aa8ff');
    await page.getByRole('button', { name: 'Theme „Sand“ wählen' }).click();
    await expect.poll(accent).toBe('#6aa8ff');
    await page.reload();
    await expect.poll(accent).toBe('#6aa8ff');
    await page.getByRole('button', { name: 'Farbe des Themes' }).click();
    await expect.poll(accent).toBe('#5d6b2c');
  });

  test('Warteschlange als Playlist speichern', async ({ page }) => {
    await page.goto('/#/suche');
    await page.getByRole('searchbox').fill('lofi');
    await page.getByRole('searchbox').press('Enter');
    await page
      .getByTestId('results-audius')
      .getByRole('button', { name: /„lofi Neonlicht“ abspielen/ })
      .click();
    await expectAudioPlaying(page);
    await page.goto('/#/warteschlange');
    await page.getByRole('button', { name: 'Als Playlist speichern' }).click();
    await page.getByLabel('Name der Playlist').fill('Aus der Warteschlange');
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Aus der Warteschlange' }),
    ).toBeVisible();
    await expect(page.getByText(/^\d+ Songs/)).toBeVisible();
  });

  test('Künstler folgen → kommt in „Deine Musik“', async ({ page }) => {
    await page.goto('/#/artist/audius/u0');
    await page.getByRole('button', { name: 'Folgen' }).click();
    await expect(page.getByRole('button', { name: 'Folge ich' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.goto('/#/einstellungen');
    await expect(page.getByRole('button', { name: '„Lumen“ entfernen' })).toBeVisible();
  });
});
