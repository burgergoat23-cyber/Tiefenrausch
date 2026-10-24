import { expect, test, type Page } from '@playwright/test';
import LZString from 'lz-string';
import { expectAudioPlaying, mockMusicApis } from './mocks';

async function playFromSearch(page: Page, query = 'lofi') {
  await page.goto('/#/suche');
  await page.getByRole('searchbox').fill(query);
  await page.getByRole('searchbox').press('Enter');
  const audius = page.getByTestId('results-audius');
  await audius.getByRole('button', { name: /„lofi Neonlicht“ abspielen/ }).click();
  await expectAudioPlaying(page);
  return audius;
}

test.describe('Bibliothek, Songtexte, Teilen', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockMusicApis(page);
  });

  test('Lieblingssong, eigene Playlist anlegen, umbenennen, sortieren', async ({ page }) => {
    const audius = await playFromSearch(page);

    // Herz im großen Player
    await page
      .getByTestId('mini-player')
      .getByRole('link', { name: /Player öffnen/ })
      .click();
    const heart = page.getByRole('button', { name: '„lofi Neonlicht“ als Lieblingssong' });
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Player schließen' }).click();

    // Zwei Songs in eine neue Playlist
    await audius.getByRole('button', { name: /Mehr zu „lofi Neonlicht“/ }).click();
    await page.getByRole('menuitem', { name: 'Zu Playlist hinzufügen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Zu Playlist hinzufügen' });
    await dialog.getByLabel('Name der Playlist').fill('Nachtfahrt');
    await dialog.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByText('Zu „Nachtfahrt“ hinzugefügt.')).toBeVisible();
    await audius.getByRole('button', { name: /Mehr zu „lofi Sommerregen“/ }).click();
    await page.getByRole('menuitem', { name: 'Zu Playlist hinzufügen' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Nachtfahrt/ })
      .click();

    // Bibliothek
    await page.goto('/#/bibliothek');
    await expect(
      page.getByRole('main').getByRole('link', { name: /Lieblingssongs/ }),
    ).toContainText('1');
    await page.getByRole('link', { name: /Nachtfahrt/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nachtfahrt' })).toBeVisible();
    await expect(page.getByText('2 Songs')).toBeVisible();

    await page.getByRole('button', { name: 'Umbenennen' }).click();
    await page.getByLabel('Name der Playlist').fill('Nachtfahrt 2');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nachtfahrt 2' })).toBeVisible();

    // Sortieren per Tastatur
    await page.getByRole('button', { name: 'Sortieren' }).click();
    const rows = page.getByTestId('sortable-track');
    await expect(rows.first()).toContainText('lofi Neonlicht');
    const live = page.locator('[id^="DndLiveRegion"]');
    await page.getByRole('button', { name: '„lofi Neonlicht“ verschieben' }).focus();
    await page.keyboard.press('Space');
    await expect(live).toHaveText(/„lofi Neonlicht“ (aufgenommen|ist jetzt an Position 1)/);
    // Unter Last misst dnd-kit manchmal noch – dann wirkt der erste Pfeil nicht (nur 2 Songs: mehr als
    // Position 2 geht nicht, nochmal drücken ist also sicher)
    await expect(async () => {
      await page.keyboard.press('ArrowDown');
      await expect(live).toHaveText('„lofi Neonlicht“ ist jetzt an Position 2.', { timeout: 1000 });
    }).toPass();
    await page.keyboard.press('Space');
    await expect(rows.first()).toContainText('lofi Sommerregen');

    // Bleibt nach dem Neuladen erhalten (IndexedDB, wird kurz gesammelt gespeichert)
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Nachtfahrt 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Fertig' }).waitFor({ state: 'detached' });
    await expect(page.getByRole('main').getByRole('listitem').first()).toContainText(
      'lofi Sommerregen',
    );
    await page.goto('/#/bibliothek/lieblingssongs');
    await expect(page.getByRole('button', { name: /„lofi Neonlicht“ abspielen/ })).toBeVisible();
  });

  test('Songtext läuft mit, Zeile antippen springt dorthin', async ({ page }) => {
    await playFromSearch(page);
    await page
      .getByTestId('mini-player')
      .getByRole('link', { name: /Player öffnen/ })
      .click();
    await page.getByRole('button', { name: 'Songtext' }).click();
    const lyrics = page.getByTestId('lyrics-synced');
    await expect(lyrics.getByText('Zeile 1 von lofi Neonlicht')).toBeVisible();
    await expect(lyrics.locator('[aria-current="true"]')).toHaveText(/Zeile [2-9]/, {
      timeout: 10_000,
    });
    await lyrics.getByText('Zeile 15 von lofi Neonlicht').dispatchEvent('click');
    await expect(lyrics.locator('[aria-current="true"]')).toHaveText(/Zeile 1[5-9]/);
    await expect(page.getByRole('link', { name: 'LRCLIB' })).toBeVisible();
  });

  test('Teilen-Link öffnen und in die Bibliothek übernehmen', async ({ page }) => {
    const d = LZString.compressToEncodedURIComponent(
      JSON.stringify({
        v: 1,
        n: 'Freundes-Mix',
        t: [
          { s: 'audius', i: 'au1', t: 'Geteilter Song', a: ['Kiko'], d: 187000 },
          { s: 'audius', i: 'au2', t: 'Zweiter Song', a: ['Lumen'], d: 194000 },
        ],
      }),
    );
    await page.goto(`/#/geteilt?d=${d}`);
    await expect(page.getByText('Mit dir geteilt')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Freundes-Mix' })).toBeVisible();
    await page.getByRole('button', { name: 'In meine Bibliothek' }).click();
    await page.getByRole('button', { name: 'Alle abspielen' }).click();
    await expectAudioPlaying(page);
    await page.goto('/#/bibliothek');
    await expect(page.getByRole('link', { name: /Freundes-Mix/ })).toBeVisible();

    await page.goto('/#/geteilt?d=kaputt');
    await expect(page.getByText('Dieser Link ist kaputt oder unvollständig.')).toBeVisible();
  });

  test('Song teilen kopiert einen Klangraum-Link', async ({ page }) => {
    await playFromSearch(page);
    await page
      .getByTestId('mini-player')
      .getByRole('link', { name: /Player öffnen/ })
      .click();
    await page.getByTestId('now-playing').getByRole('button', { name: 'Teilen' }).click();
    await expect(page.getByText('Link kopiert')).toBeVisible();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain('/#/geteilt?d=');
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1, name: 'lofi Neonlicht' })).toBeVisible();
  });

  test('Schlaf-Timer zeigt die Restzeit', async ({ page }) => {
    await playFromSearch(page);
    await page
      .getByTestId('mini-player')
      .getByRole('link', { name: /Player öffnen/ })
      .click();
    await page.getByRole('button', { name: 'Schlaf-Timer' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '15 Minuten' }).click();
    await expect(page.getByRole('button', { name: /14:5\d/ })).toBeVisible();
  });

  test('Sicherung laden → Rückblick zeigt Zahlen', async ({ page }) => {
    const now = Date.now();
    const tr = (id: string, artist: string) => ({
      id,
      sourceId: 'audius',
      title: `Song ${id}`,
      artists: [artist],
      durationMs: 180000,
    });
    const known = { 'audius:a': tr('a', 'King Von'), 'audius:b': tr('b', 'Lil Durk') };
    const plays = [
      { k: 'audius:a', at: now - 3600_000, ms: 180000 },
      { k: 'audius:a', at: now - 7200_000, ms: 180000 },
      { k: 'audius:b', at: now - 1000, ms: 60000 },
    ];
    const backup = {
      app: 'klangraum',
      kind: 'backup',
      version: 1,
      library: {
        version: 1,
        likes: [{ track: known['audius:b'], at: now }],
        playlists: [],
        plays,
        known,
      },
    };
    await page.goto('/#/einstellungen');
    await page.getByTestId('backup-file').setInputFiles({
      name: 'sicherung.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(page.getByText('Geladen: 1 Lieblingssongs, 0 Playlists.')).toBeVisible();
    await page.goto('/#/rueckblick');
    await expect(page.getByRole('heading', { level: 1, name: 'Rückblick' })).toBeVisible();
    await expect(page.getByText('Minuten')).toBeVisible();
    await expect(page.getByRole('definition').first()).toHaveText('7');
    await expect(page.getByText('King Von').first()).toBeVisible();

    await page.goto('/#/einstellungen');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Sicherung speichern' }).click();
    expect((await download).suggestedFilename()).toMatch(/^klangraum-sicherung-.*\.json$/);
  });
});

test('Autoplay: nach dem letzten Song geht es mit ähnlichen Songs weiter', async ({ page }) => {
  await mockMusicApis(page, { audioSeconds: 2 });
  await page.goto('/#/suche');
  await page.getByRole('searchbox').fill('lofi');
  await page.getByRole('searchbox').press('Enter');
  const audius = page.getByTestId('results-audius');
  // letzter Song der Liste → danach ist die Warteschlange leer
  const buttons = audius
    .getByRole('list')
    .first()
    .getByRole('button', { name: /abspielen/ });
  const last = buttons.last();
  const lastTitle = (await last.getAttribute('aria-label'))?.match(/„(.+?)“/)?.[1] ?? '';
  await last.click();
  await expect(page.getByTestId('mini-player')).toContainText(lastTitle);
  await expect(page.getByText('Autoplay: Es geht mit ähnlichen Songs weiter.')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId('mini-player')).not.toContainText(lastTitle);
});

test('Tastenkürzel am PC', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tastatur nur am PC');
  await mockMusicApis(page);
  await playFromSearch(page);
  await page.locator('body').click({ position: { x: 5, y: 400 } });
  await page.keyboard.press('k');
  await expect(
    page.getByTestId('mini-player').getByRole('button', { name: 'Abspielen' }),
  ).toBeVisible();
  await page.keyboard.press('Shift+?');
  await expect(page.getByRole('dialog', { name: 'Tastenkürzel' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('l');
  await expect(page.getByText('„lofi Neonlicht“ ist jetzt ein Lieblingssong.')).toBeVisible();
  await page.keyboard.press('t');
  await expect(page.getByTestId('lyrics')).toBeVisible();
});
