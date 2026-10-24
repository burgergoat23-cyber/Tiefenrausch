import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../test/fixtures';
import { SourceError } from '../types';
import { decodeEntities, parseIsoDuration, YouTubeSource } from './index';

const video = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  snippet: {
    title: `Lied &amp; Text &#39;${id}&#39;`,
    channelTitle: 'Künstlerin - Topic',
    thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } },
    liveBroadcastContent: 'none',
  },
  contentDetails: { duration: 'PT3M25S' },
  status: { embeddable: true },
  ...extra,
});

function api(handlers: Record<string, (u: URL) => unknown>, status = 200) {
  return vi.fn(async (url: string) => {
    const u = new URL(url);
    const name = u.pathname.replace('/youtube/v3/', '');
    const h = handlers[name];
    if (!h) throw new TypeError(`unerwartet: ${url}`);
    return jsonResponse(h(u), status);
  });
}

describe('YouTube-Adapter', () => {
  it('ohne Schlüssel still deaktiviert', async () => {
    const fetch = vi.fn();
    const src = new YouTubeSource({ getApiKey: () => '', fetch });
    expect(await src.isAvailable()).toBe(false);
    await expect(src.search('x')).rejects.toMatchObject({ kind: 'unavailable' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sucht nur einbettbare Musikvideos und lädt die Länge nach', async () => {
    const fetch = api({
      search: () => ({ items: [{ id: { videoId: 'abcdefghijk' }, snippet: video('x').snippet }] }),
      videos: () => ({ items: [video('abcdefghijk')] }),
    });
    const src = new YouTubeSource({ getApiKey: () => 'KEY', fetch });
    const res = await src.search('lied');
    const searchUrl = new URL(fetch.mock.calls[0]![0]);
    expect(searchUrl.searchParams.get('videoCategoryId')).toBe('10');
    expect(searchUrl.searchParams.get('videoEmbeddable')).toBe('true');
    expect(searchUrl.searchParams.get('type')).toBe('video');
    expect(searchUrl.searchParams.get('key')).toBe('KEY');
    expect(res.tracks).toEqual([
      {
        id: 'abcdefghijk',
        sourceId: 'youtube',
        title: "Lied & Text 'abcdefghijk'",
        artists: ['Künstlerin'],
        durationMs: 205000,
        artworkUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
        permalink: 'https://www.youtube.com/watch?v=abcdefghijk',
      },
    ]);
  });

  it('lässt nicht einbettbare und altersbeschränkte Videos weg', async () => {
    const ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'];
    const fetch = api({
      search: () => ({
        items: ids.map((id) => ({ id: { videoId: id }, snippet: video(id).snippet })),
      }),
      videos: () => ({
        items: [
          video('aaaaaaaaaaa'),
          video('bbbbbbbbbbb', { status: { embeddable: false } }),
          video('ccccccccccc', {
            contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } },
          }),
        ],
      }),
    });
    const res = await new YouTubeSource({ getApiKey: () => 'K', fetch }).search('x');
    expect(res.tracks.map((t) => t.id)).toEqual(['aaaaaaaaaaa']);
  });

  it('gleiche Suche zweimal → nur einmal Kontingent verbraucht', async () => {
    const fetch = api({
      search: () => ({ items: [{ id: { videoId: 'abcdefghijk' }, snippet: video('x').snippet }] }),
      videos: () => ({ items: [video('abcdefghijk')] }),
    });
    const src = new YouTubeSource({ getApiKey: () => 'K', fetch });
    await src.search('gleich');
    await src.search('gleich');
    expect(fetch).toHaveBeenCalledTimes(2); // 1× search + 1× videos
  });

  it('Kontingent verbraucht → eigene Meldung', async () => {
    const fetch = api(
      { search: () => ({ error: { code: 403, errors: [{ reason: 'quotaExceeded' }] } }) },
      403,
    );
    const err = await new YouTubeSource({ getApiKey: () => 'K', fetch })
      .search('x')
      .catch((e) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err).toMatchObject({ kind: 'quota', sourceId: 'youtube' });
  });

  it('falscher Schlüssel → eigene Meldung', async () => {
    const fetch = api(
      {
        search: () => ({
          error: { code: 400, message: 'API key not valid.', errors: [{ reason: 'badRequest' }] },
        }),
      },
      400,
    );
    await expect(
      new YouTubeSource({ getApiKey: () => 'falsch', fetch }).search('x'),
    ).rejects.toMatchObject({ kind: 'badKey' });
  });

  it('Musik-Charts im eigenen Land', async () => {
    const fetch = api({ videos: () => ({ items: [video('abcdefghijk')] }) });
    const res = await new YouTubeSource({
      getApiKey: () => 'K',
      fetch,
      getRegionCode: () => 'de',
    }).getTrending();
    const u = new URL(fetch.mock.calls[0]![0]);
    expect(u.searchParams.get('chart')).toBe('mostPopular');
    expect(u.searchParams.get('regionCode')).toBe('DE');
    expect(res).toHaveLength(1);
  });

  it('Playlist mit Songs', async () => {
    const fetch = api({
      playlists: () => ({
        items: [{ id: 'PL1234567890', snippet: { title: 'Mix', channelTitle: 'Kanal' } }],
      }),
      playlistItems: () => ({
        items: [
          { contentDetails: { videoId: 'abcdefghijk' } },
          { contentDetails: { videoId: 'x' } },
        ],
      }),
      videos: () => ({ items: [video('abcdefghijk')] }),
    });
    const p = await new YouTubeSource({ getApiKey: () => 'K', fetch }).getPlaylist('PL1234567890');
    expect(p).toMatchObject({ title: 'Mix', owner: 'Kanal' });
    expect(p.tracks?.map((t) => t.id)).toEqual(['abcdefghijk']);
  });

  it('Live-Videos werden als live markiert', async () => {
    const fetch = api({
      videos: () => ({
        items: [
          video('abcdefghijk', {
            snippet: { ...video('abcdefghijk').snippet, liveBroadcastContent: 'live' },
            contentDetails: { duration: 'P0D' },
          }),
        ],
      }),
    });
    const [t] = await new YouTubeSource({ getApiKey: () => 'K', fetch }).getTrending();
    expect(t).toMatchObject({ live: true, durationMs: 0 });
  });

  it('Hilfsfunktionen', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723000);
    expect(parseIsoDuration('PT45S')).toBe(45000);
    expect(parseIsoDuration('quatsch')).toBe(0);
    expect(decodeEntities('A &amp; B &quot;C&quot; &#x2764; &unbekannt;')).toBe(
      'A & B "C" ❤ &unbekannt;',
    );
  });
});
