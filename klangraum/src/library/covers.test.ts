import { describe, expect, it, vi } from 'vitest';
import { createCache } from '../storage/cache';
import { jsonResponse, track } from '../test/fixtures';
import {
  coverUrl,
  createCoverResolver,
  needsCoverLookup,
  parseArtistTitle,
  pickReleaseGroup,
} from './covers';

const RG_SINGLE = '11111111-1111-1111-1111-111111111111';
const RG_ALBUM = '22222222-2222-2222-2222-222222222222';
const RG_COMP = '33333333-3333-3333-3333-333333333333';

const yt = (title: string, artist = 'Kanal', id = 'vid') =>
  track(id, { sourceId: 'youtube', title, artists: [artist] });

describe('Originale Cover', () => {
  it('Titel von YouTube werden bereinigt', () => {
    expect(parseArtistTitle(yt('Testkünstler - Erster Song (Official Video)'))).toEqual({
      artist: 'Testkünstler',
      title: 'Erster Song',
    });
    expect(parseArtistTitle(yt('Zweiter Song [Lyrics] ft. Gast', 'Testkünstler - Topic'))).toEqual({
      artist: 'Testkünstler',
      title: 'Zweiter Song',
    });
    expect(parseArtistTitle(yt('A x B - „Dritter Song“ (Audio)'))).toEqual({
      artist: 'A',
      title: 'Dritter Song',
    });
    expect(parseArtistTitle(yt('(Official Video)'))).toBeNull();
  });

  it('wählt die erste offizielle Single/das Album, keine Sampler', () => {
    const rg = pickReleaseGroup({
      recordings: [
        {
          score: 60,
          releases: [
            {
              status: 'Official',
              date: '2000',
              'release-group': { id: RG_COMP, 'primary-type': 'Album' },
            },
          ],
        },
        {
          score: 100,
          releases: [
            {
              status: 'Official',
              date: '2019-01-01',
              'release-group': {
                id: RG_COMP,
                'primary-type': 'Album',
                'secondary-types': ['Compilation'],
              },
            },
            {
              status: 'Official',
              date: '2020-05-01',
              'release-group': { id: RG_ALBUM, 'primary-type': 'Album' },
            },
            {
              status: 'Official',
              date: '2020-03-01',
              'release-group': { id: RG_SINGLE, 'primary-type': 'Single' },
            },
            {
              status: 'Bootleg',
              date: '2018',
              'release-group': { id: RG_COMP, 'primary-type': 'Single' },
            },
          ],
        },
      ],
    });
    expect(rg).toBe(RG_SINGLE);
    expect(pickReleaseGroup({ recordings: [] })).toBeNull();
  });

  it('nur für YouTube und Songs ohne Bild, nie für Radio', () => {
    expect(needsCoverLookup(yt('x'))).toBe(true);
    expect(needsCoverLookup(track('a', { artworkUrl: 'https://img.test/a.jpg' }))).toBe(false);
    expect(needsCoverLookup(track('a'))).toBe(true);
    expect(needsCoverLookup(track('r', { sourceId: 'radio', live: true }))).toBe(false);
  });

  it('fragt MusicBrainz, merkt sich das Ergebnis und fragt nicht doppelt', async () => {
    const fetch = vi.fn(async (_url: string) =>
      jsonResponse({
        recordings: [
          {
            score: 100,
            releases: [
              {
                status: 'Official',
                date: '2020',
                'release-group': { id: RG_SINGLE, 'primary-type': 'Single' },
              },
            ],
          },
        ],
      }),
    );
    const resolver = createCoverResolver({
      fetch,
      cache: createCache(localStorage),
      intervalMs: 0,
    });
    const t = yt('Testkünstler - Erster Song (Official Video)');
    const [a, b] = await Promise.all([resolver.resolve(t), resolver.resolve(t)]);
    expect(a).toBe(coverUrl(RG_SINGLE));
    expect(b).toBe(a);
    expect(await resolver.resolve(t)).toBe(a);
    expect(fetch).toHaveBeenCalledTimes(1);
    const q = new URL(fetch.mock.calls[0]![0]).searchParams.get('query');
    expect(q).toBe('recording:"Erster Song" AND artist:"Testkünstler"');
    expect(resolver.peek(t)).toBe(a);
    expect(coverUrl(RG_SINGLE)).toBe(
      `https://coverartarchive.org/release-group/${RG_SINGLE}/front-500`,
    );
  });

  it('kein Treffer wird auch gemerkt, Netzfehler nicht', async () => {
    let fail = true;
    const fetch = vi.fn(async () => {
      if (fail) throw new TypeError('offline');
      return jsonResponse({ recordings: [] });
    });
    const resolver = createCoverResolver({
      fetch,
      cache: createCache(localStorage),
      intervalMs: 0,
    });
    const t = yt('Testkünstler - Song');
    expect(await resolver.resolve(t)).toBeNull();
    expect(resolver.peek(t)).toBeUndefined(); // Netzfehler → später nochmal
    fail = false;
    expect(await resolver.resolve(t)).toBeNull();
    expect(resolver.peek(t)).toBeNull(); // wirklich nichts gefunden → gemerkt
  });

  it('hält den Abstand zwischen Anfragen ein (Regel von MusicBrainz)', async () => {
    vi.useFakeTimers();
    try {
      const times: number[] = [];
      const fetch = vi.fn(async () => {
        times.push(Date.now());
        return jsonResponse({ recordings: [] });
      });
      const resolver = createCoverResolver({ fetch, cache: createCache(null), intervalMs: 1000 });
      const all = Promise.all(
        [1, 2, 3].map((n) => resolver.resolve(yt(`K - Song ${n}`, 'K', `vid${n}`))),
      );
      await vi.advanceTimersByTimeAsync(5000);
      await all;
      expect(times).toHaveLength(3);
      expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(1000);
      expect(times[2]! - times[1]!).toBeGreaterThanOrEqual(1000);
    } finally {
      vi.useRealTimers();
    }
  });
});
