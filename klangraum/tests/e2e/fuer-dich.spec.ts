import { expect, test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

test.beforeEach(async ({ page }) => {
  await mockMusicApis(page);
});

test('Startseite „Für dich: Drill“ mit Lieblingskünstlern, Mix abspielen', async ({ page }) => {
  await page.goto('/');
  const fy = page.getByTestId('for-you');
  await expect(fy.getByRole('heading', { name: 'Für dich: Drill' })).toBeVisible();
  await expect(
    fy.getByText(/^Mit King Von, Bloodhound Lil Jeff, YNW Melly, Lil Durk/),
  ).toBeVisible();
  // Drill-Playlists von YouTube als Kacheln
  await expect(fy.getByRole('heading', { name: 'Playlists: Drill' })).toBeVisible();
  await expect(fy.getByRole('link', { name: /Drill Playlist 1/ })).toBeVisible();
  // YouTube-Videos der Künstler und Drill von unabhängigen Audius-Künstlern, gemischt
  await expect(fy.getByRole('img', { name: 'Quelle: YouTube' }).first()).toBeVisible();
  await expect(
    fy.getByRole('button', { name: /„Drill Mitternachtsfahrt“ abspielen/ }),
  ).toBeVisible();
  // Passende Radiosender
  await expect(fy.getByRole('heading', { name: 'Radiosender: Drill' })).toBeVisible();

  await fy.getByRole('button', { name: 'Mix abspielen' }).click();
  await expect(page.getByTestId('fake-youtube')).toHaveAttribute('data-state', '1');
  await expect(page.getByTestId('mini-player')).toContainText('Sommerhit 2026');
  await page.getByTestId('mini-player').getByRole('button', { name: 'Nächster Song' }).click();
  await expectAudioPlaying(page); // nächster Song kommt von Audius
});

test('Deine Musik: Künstler entfernen und hinzufügen, Schnellwahl in der Suche', async ({
  page,
}) => {
  await page.goto('/#/einstellungen');
  await page.getByRole('button', { name: '„YNW Melly“ entfernen' }).click();
  await expect(page.getByRole('button', { name: '„YNW Melly“ entfernen' })).toHaveCount(0);
  await page.getByPlaceholder('Künstler hinzufügen').fill('Neuer Künstler');
  await page.getByRole('button', { name: 'Hinzufügen' }).first().click();
  await expect(page.getByRole('button', { name: '„Neuer Künstler“ entfernen' })).toBeVisible();

  await page.goto('/#/suche');
  await page.getByRole('button', { name: 'King Von', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('King Von');
  // Schnellwahl zählt als bestätigte Suche → YouTube wird gleich mit gefragt
  await expect(
    page
      .getByTestId('results-youtube')
      .getByRole('button', { name: /abspielen/ })
      .first(),
  ).toBeVisible();
});

test('Drill-Playlist öffnen und abspielen', async ({ page }) => {
  await page.goto('/');
  await page
    .getByTestId('for-you')
    .getByRole('link', { name: /Drill Playlist 1/ })
    .click();
  await expect(page.getByRole('heading', { name: /Playlist PLtest1Drill/ })).toBeVisible();
  await page.getByRole('button', { name: 'Alle abspielen' }).click();
  await expect(page.getByTestId('fake-youtube')).toHaveAttribute('data-state', '1');
});

test('Vorschläge mit einem Tipp hinzufügen, Künstler-Knopf auf der Startseite sucht', async ({
  page,
}) => {
  await page.goto('/#/einstellungen');
  await page.getByRole('button', { name: '„Kay Flock“ hinzufügen' }).click();
  await expect(page.getByRole('button', { name: '„Kay Flock“ entfernen' })).toBeVisible();
  await expect(page.getByRole('button', { name: '„Kay Flock“ hinzufügen' })).toHaveCount(0);
  await page.getByRole('button', { name: '„UK Drill“ hinzufügen' }).click();
  await expect(page.getByRole('button', { name: '„UK Drill“ entfernen' })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Für dich: Drill, UK Drill' })).toBeVisible();
  await page
    .getByTestId('for-you')
    .getByRole('group', { name: 'Deine Künstler' })
    .getByRole('button', { name: 'Kay Flock' })
    .click();
  await expect(page.getByRole('searchbox')).toHaveValue('Kay Flock');
  await expect(
    page
      .getByTestId('results-youtube')
      .getByRole('button', { name: /abspielen/ })
      .first(),
  ).toBeVisible();
});
