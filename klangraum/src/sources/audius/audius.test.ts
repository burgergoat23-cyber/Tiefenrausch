import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, seededRandom } from '../../test/fixtures';
import { SourceError } from '../types';
import { AudiusSource } from './index';

const apiTrack = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Titel ${id}`,
  duration: 200,
  permalink: `/artist/titel-${id}`,
  artwork: { '150x150': `https://img.test/${id}-150.jpg`, '480x480': `https://img.test/${id}.jpg` },
  user: { id: 'u1', name: 'Künstlerin', handle: 'kuenstlerin' },
  is_streamable: true,
  ...extra,
});

/** Baut ein fetch, das je nach Adresse antwortet */
function router(routes: [RegExp, (url: string) => Response | Promise<Response>][]) {
  return vi.fn(async (url: string) => {
    for (const [re, fn] of routes) if (re.test(url)) return fn(url);
    throw new TypeError(`unerwartete Anfrage: ${url}`);
  });
}

describe('Audius-Adapter', () => {
  it('fragt api.audius.co nach Servern und hängt app_name an', async () => {
    const fetch = router([
      [/^https:\/\/api\.audius\.co\/?$/, () => jsonResponse({ data: ['https://dn1.test'] })],
      [/^https:\/\/dn1\.test\/v1\/tracks\/search/, () => jsonResponse({ data: [apiTrack('A1')] })],
    ]);
    const src = new AudiusSource({ fetch, random: seededRandom(1) });
    const res = await src.search('lofi');
    expect(res.tracks).toEqual([
      {
        id: 'A1',
        sourceId: 'audius',
        title: 'Titel A1',
        artists: ['Künstlerin'],
        artistId: 'u1',
        durationMs: 200000,
        artworkUrl: 'https://img.test/A1.jpg',
        permalink: 'https://audius.co/artist/titel-A1',
      },
    ]);
    const searchUrl = new URL(fetch.mock.calls[1]![0]);
    expect(searchUrl.searchParams.get('query')).toBe('lofi');
    expect(searchUrl.searchParams.get('app_name')).toBe('Klangraum');
  });

  it('nimmt den nächsten Server, wenn einer nicht antwortet', async () => {
    const fetch = router([
      [/^https:\/\/api\.audius\.co\/?$/, () => jsonResponse({ data: ['https://tot.test'] })],
      [/^https:\/\/tot\.test/, () => Promise.reject(new TypeError('Failed to fetch'))],
      [
        /^https:\/\/api\.audius\.co\/v1\/tracks\/trending/,
        () => jsonResponse({ data: [apiTrack('T1')] }),
      ],
    ]);
    const src = new AudiusSource({ fetch });
    const res = await src.getTrending();
    expect(res.map((t) => t.id)).toEqual(['T1']);
    // Der funktionierende Server steht jetzt vorne → Stream kommt von dort
    const url = await src.getStreamUrl(res[0]!);
    expect(url).toBe('https://api.audius.co/v1/tracks/T1/stream?app_name=Klangraum');
  });

  it('ohne Serverliste wird api.audius.co direkt benutzt', async () => {
    const fetch = router([
      [/^https:\/\/api\.audius\.co\/?$/, () => new Response('Hallo', { status: 200 })],
      [/^https:\/\/api\.audius\.co\/v1\/tracks\/search/, () => jsonResponse({ data: [] })],
    ]);
    const src = new AudiusSource({ fetch });
    await expect(src.search('x')).resolves.toMatchObject({ tracks: [] });
  });

  it('meldet einen Netzfehler, wenn kein Server antwortet', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('offline');
    });
    const src = new AudiusSource({ fetch });
    const err = await src.search('x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err).toMatchObject({ kind: 'network', sourceId: 'audius' });
  });

  it('meldet zu viele Anfragen (429) als rateLimit', async () => {
    const fetch = router([
      [/^https:\/\/api\.audius\.co\/?$/, () => jsonResponse({ data: [] })],
      [/\/v1\/tracks\/search/, () => jsonResponse({}, 429)],
    ]);
    const err = await new AudiusSource({ fetch }).search('x').catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: 'rateLimit' });
  });

  it('lässt nicht abspielbare und kaputte Einträge weg', async () => {
    const fetch = router([
      [/^https:\/\/api\.audius\.co\/?$/, () => jsonResponse({ data: [] })],
      [
        /\/v1\/tracks\/search/,
        () =>
          jsonResponse({
            data: [
              apiTrack('ok'),
              apiTrack('gesperrt', { is_streamable: false }),
              apiTrack('bezahlt', { stream_conditions: { usdc_purchase: {} } }),
              { id: 42 }, // kaputt
              apiTrack('ohnebild', { artwork: null, user: null }),
            ],
          }),
      ],
    ]);
    const res = await new AudiusSource({ fetch }).search('x');
    expect(res.tracks.map((t) => t.id)).toEqual(['ok', 'ohnebild']);
    expect(res.tracks[1]).toMatchObject({ artists: [], artworkUrl: undefined });
  });

  it('Bild-Adressen ohne https werden verworfen', async () => {
    const fetch = router([
      [/^https:\/\/api\.audius\.co\/?$/, () => jsonResponse({ data: [] })],
      [
        /\/v1\/tracks\/search/,
        () =>
          jsonResponse({
            data: [apiTrack('x', { artwork: { '480x480': 'javascript:alert(1)' } })],
          }),
      ],
    ]);
    const res = await new AudiusSource({ fetch }).search('x');
    expect(res.tracks[0]?.artworkUrl).toBeUndefined();
  });

  it('sucht Alben und Playlists getrennt', async () => {
    const lists = [
      { id: 'p1', playlist_name: 'Mix', is_album: false, user: { name: 'Max' } },
      { id: 'al1', playlist_name: 'Debüt', is_album: true, user: { name: 'Band' }, track_count: 9 },
    ];
    const fetch = router([
      [/^https:\/\/api\.audius\.co\/?$/, () => jsonResponse({ data: [] })],
      [/\/v1\/playlists\/search/, () => jsonResponse({ data: lists })],
    ]);
    const src = new AudiusSource({ fetch });
    expect((await src.search('x', { type: 'album' })).albums).toEqual([
      {
        id: 'al1',
        sourceId: 'audius',
        title: 'Debüt',
        artists: ['Band'],
        trackCount: 9,
        artworkUrl: undefined,
      },
    ]);
    expect((await src.search('x', { type: 'playlist' })).playlists.map((p) => p.id)).toEqual([
      'p1',
    ]);
  });

  it('lädt ein Album mit Songs', async () => {
    const fetch = router([
      [/^https:\/\/api\.audius\.co\/?$/, () => jsonResponse({ data: [] })],
      [
        /\/v1\/playlists\/al1\/tracks/,
        () => jsonResponse({ data: [apiTrack('s1'), apiTrack('s2')] }),
      ],
      [
        /\/v1\/playlists\/al1/,
        () => jsonResponse({ data: [{ id: 'al1', playlist_name: 'Debüt', is_album: true }] }),
      ],
    ]);
    const album = await new AudiusSource({ fetch }).getAlbum('al1');
    expect(album.title).toBe('Debüt');
    expect(album.tracks?.map((t) => t.id)).toEqual(['s1', 's2']);
  });

  it('leere Suche fragt gar nicht erst', async () => {
    const fetch = vi.fn();
    const res = await new AudiusSource({ fetch }).search('   ');
    expect(res.tracks).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
