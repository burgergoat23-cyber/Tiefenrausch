import { test } from '@playwright/test';
import { expectAudioPlaying, mockMusicApis } from './mocks';

/** Screenshots der neuen Funktionen (nur mit SCREENS=1) */
test.skip(!process.env.SCREENS, 'nur auf Wunsch (SCREENS=1)');

test('Screenshots Funktionen', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `docs/screenshots/features/${info.project.name}-${name}.png` });
  await mockMusicApis(page);
  const now = Date.now();
  const artists = ['King Von', 'Lil Durk', 'Polo G', 'Central Cee', 'Chief Keef'];
  const tr = (i: number) => ({
    id: `au${i}`,
    sourceId: 'audius',
    title: [
      'Crazy Story',
      'All My Life',
      'RAPSTAR',
      'Doja',
      'Love Sosa',
      'Took Her To The O',
      'Sprinter',
      'Neonlicht',
    ][i % 8],
    artists: [artists[i % 5]],
    durationMs: 180000 + i * 7000,
    artworkUrl: `https://img.test/au${i}.svg`,
  });
  const known = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`audius:au${i}`, tr(i)]));
  const plays = Array.from({ length: 120 }, (_, n) => ({
    k: `audius:au${(n * 7) % 8 > 5 ? n % 3 : (n * 7) % 8}`,
    at: now - n * 3.1 * 3600_000,
    ms: 150000,
  }));
  const backup = {
    app: 'klangraum',
    kind: 'backup',
    version: 1,
    library: {
      version: 1,
      likes: [0, 1, 2, 3].map((i) => ({ track: tr(i), at: now - i })),
      playlists: [
        {
          id: 'pl-1',
          name: 'Drill Nachtfahrt',
          createdAt: now,
          updatedAt: now,
          tracks: [0, 1, 2, 3, 4, 5].map(tr),
        },
        { id: 'pl-2', name: 'Gym', createdAt: now, updatedAt: now, tracks: [6].map(tr) },
        { id: 'pl-3', name: 'Chill', createdAt: now, updatedAt: now, tracks: [] },
      ],
      plays,
      known,
    },
  };
  await page.goto('/#/einstellungen');
  await page.getByTestId('backup-file').setInputFiles({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForTimeout(800);
  await page.goto('/#/bibliothek');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await shot('1-bibliothek');
  await page.goto('/#/bibliothek/playlist/pl-1');
  await page.waitForTimeout(800);
  await shot('2-playlist');
  await page.goto('/#/rueckblick');
  await page.waitForTimeout(800);
  await shot('3-rueckblick');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Rückblick als Bild teilen' }).click();
  await (await dl).saveAs(`docs/screenshots/features/${info.project.name}-rueckblick-karte.png`);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  await shot('4-rueckblick-unten');
  await page.goto('/#/bibliothek/playlist/pl-1');
  await page.getByRole('button', { name: 'Alle abspielen' }).click();
  await expectAudioPlaying(page);
  await page
    .getByTestId('mini-player')
    .getByRole('link', { name: /Player öffnen/ })
    .click();
  await page.getByRole('button', { name: 'Songtext' }).click();
  await page.waitForTimeout(4500);
  await shot('5-songtext');
  await page.getByRole('button', { name: 'Songtext' }).click();
  await page.waitForTimeout(500);
  await shot('6-player');
  await page
    .getByTestId('now-playing')
    .getByRole('button', { name: /Mehr zu/ })
    .click();
  await page.waitForTimeout(300);
  await shot('7-menue');
});
