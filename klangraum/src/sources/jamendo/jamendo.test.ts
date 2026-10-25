import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../test/fixtures';
import { SourceError } from '../types';
import { JamendoSource, parseCcLicense } from './index';

const ok = (results: unknown[]) =>
  jsonResponse({ headers: { status: 'success', code: 0, results_count: results.length }, results });

const apiTrack = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Lied ${id}`,
  duration: 123,
  artist_id: '7',
  artist_name: 'Freie Band',
  album_id: '99',
  album_name: 'Offen',
  album_image: 'https://usercontent.jamendo.test/album.jpg',
  image: 'https://usercontent.jamendo.test/track.jpg',
  audio: `https://prod-1.storage.jamendo.test/?trackid=${id}&format=mp31`,
  license_ccurl: 'http://creativecommons.org/licenses/by-nc-sa/3.0/',
  shareurl: `https://www.jamendo.com/track/${id}`,
  ...extra,
});

describe('Jamendo-Adapter', () => {
  it('ohne client_id: still deaktiviert, keine Anfrage', async () => {
    const fetch = vi.fn();
    const src = new JamendoSource({ getClientId: () => '', fetch });
    expect(await src.isAvailable()).toBe(false);
    await expect(src.search('x')).rejects.toMatchObject({ kind: 'unavailable' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sucht Songs mit client_id und zeigt die Lizenz', async () => {
    const fetch = vi.fn(async (_url: string) => ok([apiTrack('1')]));
    const src = new JamendoSource({ getClientId: () => 'abc123', fetch });
    expect(await src.isAvailable()).toBe(true);
    const res = await src.search('piano', { limit: 5 });
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe('https://api.jamendo.com/v3.0/tracks/');
    expect(url.searchParams.get('client_id')).toBe('abc123');
    expect(url.searchParams.get('search')).toBe('piano');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(res.tracks[0]).toEqual({
      id: '1',
      sourceId: 'jamendo',
      title: 'Lied 1',
      artists: ['Freie Band'],
      artistId: '7',
      album: 'Offen',
      albumId: '99',
      durationMs: 123000,
      artworkUrl: 'https://usercontent.jamendo.test/album.jpg',
      license: {
        name: 'CC BY-NC-SA 3.0',
        url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      },
      permalink: 'https://www.jamendo.com/track/1',
    });
  });

  it('merkt sich die Stream-Adresse aus der Suche', async () => {
    const fetch = vi.fn(async (_url: string) => ok([apiTrack('5')]));
    const src = new JamendoSource({ getClientId: () => 'abc', fetch });
    const [t] = (await src.search('x')).tracks;
    expect(await src.getStreamUrl(t!)).toBe(
      'https://prod-1.storage.jamendo.test/?trackid=5&format=mp31',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('holt die Stream-Adresse nach, wenn sie fehlt (z. B. nach Neuladen)', async () => {
    const fetch = vi.fn(async (_url: string) => ok([apiTrack('8')]));
    const src = new JamendoSource({ getClientId: () => 'abc', fetch });
    const url = await src.getStreamUrl({
      id: '8',
      sourceId: 'jamendo',
      title: 'Lied 8',
      artists: [],
      durationMs: 0,
    });
    expect(url).toContain('trackid=8');
    expect(new URL(fetch.mock.calls[0]![0]).searchParams.get('id')).toBe('8');
  });

  it('Fehler-Antwort (falsche client_id) → unavailable', async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        headers: { status: 'failed', code: 5, error_message: 'bad id' },
        results: [],
      }),
    );
    const err = await new JamendoSource({ getClientId: () => 'falsch', fetch })
      .search('x')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err).toMatchObject({ kind: 'unavailable', sourceId: 'jamendo' });
  });

  it('Netzfehler → freundlicher network-Fehler', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('offline');
    });
    await expect(
      new JamendoSource({ getClientId: () => 'a', fetch }).getTrending(),
    ).rejects.toMatchObject({ kind: 'network' });
  });

  it('Album mit Songs: fehlende Angaben kommen vom Album', async () => {
    const fetch = vi.fn(async () =>
      ok([
        {
          id: '99',
          name: 'Offen',
          artist_name: 'Freie Band',
          image: 'https://img.test/a.jpg',
          tracks: [{ id: '1', name: 'Eins', duration: 60, audio: 'https://a.test/1.mp3' }],
        },
      ]),
    );
    const album = await new JamendoSource({ getClientId: () => 'a', fetch }).getAlbum('99');
    expect(album.tracks?.[0]).toMatchObject({
      id: '1',
      artists: ['Freie Band'],
      album: 'Offen',
      artworkUrl: 'https://img.test/a.jpg',
    });
  });

  it('Lizenz-Adressen werden lesbar', () => {
    expect(parseCcLicense('http://creativecommons.org/licenses/by/4.0/')?.name).toBe('CC BY 4.0');
    expect(parseCcLicense('https://creativecommons.org/publicdomain/zero/1.0/')?.name).toBe(
      'Public Domain',
    );
    expect(parseCcLicense('javascript:alert(1)')).toBeUndefined();
    expect(parseCcLicense(null)).toBeUndefined();
  });
});

describe('Jamendo: Gesamtzahl', () => {
  it('liest results_fullcount', async () => {
    const fetch = async (url: string) => {
      expect(url).toContain('fullcount=true');
      return new Response(
        JSON.stringify({ headers: { status: 'success', results_fullcount: 1234 }, results: [] }),
      );
    };
    const s = new JamendoSource({ getClientId: () => 'abc', fetch });
    expect(await s.countTracks('drill')).toBe(1234);
  });
});
