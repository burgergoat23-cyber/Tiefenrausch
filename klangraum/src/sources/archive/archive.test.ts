import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../test/fixtures';
import { ArchiveSource, cleanQuery, parseLength, pickAudioFiles } from './index';

const doc = (identifier: string, extra: Record<string, unknown> = {}) => ({
  identifier,
  title: `Konzert ${identifier}`,
  creator: 'Die Band',
  year: '1999',
  collection: ['etree', 'DieBand'],
  ...extra,
});

const meta = (identifier: string, extra: Record<string, unknown> = {}) => ({
  metadata: {
    identifier,
    title: `Konzert ${identifier}`,
    creator: 'Die Band',
    collection: ['etree'],
    date: '1999-05-01',
    ...extra,
  },
  files: [
    { name: 'gd99-02.flac', format: 'Flac', title: 'Zwei' },
    { name: 'gd99-02.mp3', format: 'VBR MP3', title: 'Zwei', track: '2', length: '05:10' },
    { name: 'gd99-01.mp3', format: 'VBR MP3', title: 'Eins', track: '1', length: '312.5' },
    { name: 'gd99-01_64kb.mp3', format: '64Kbps MP3', title: 'Eins' },
    { name: 'cover.jpg', format: 'JPEG' },
  ],
});

function router(routes: [RegExp, (url: string) => Response][]) {
  return vi.fn(async (url: string) => {
    for (const [re, fn] of routes) if (re.test(url)) return fn(url);
    throw new TypeError(`unerwartet: ${url}`);
  });
}

describe('Internet-Archive-Adapter', () => {
  it('sucht nur in freigegebenen Sammlungen und nur Audio', async () => {
    const fetch = router([
      [/advancedsearch/, () => jsonResponse({ response: { docs: [doc('a1')] } })],
    ]);
    const res = await new ArchiveSource({ fetch }).search('dead (live)', { type: 'album' });
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.searchParams.get('q')).toBe(
      '(dead live) AND mediatype:audio AND collection:(etree OR netlabels)',
    );
    expect(url.searchParams.getAll('fl[]')).toContain('licenseurl');
    expect(res.albums).toEqual([
      {
        id: 'a1',
        sourceId: 'archive',
        title: 'Konzert a1',
        artists: ['Die Band'],
        artworkUrl: 'https://archive.org/services/img/a1',
        year: 1999,
      },
    ]);
  });

  it('lässt Einträge ohne klare Lizenz weg', async () => {
    const fetch = router([
      [
        /advancedsearch/,
        () =>
          jsonResponse({
            response: {
              docs: [
                doc('lma'),
                doc('cc', {
                  collection: ['netlabels'],
                  licenseurl: 'http://creativecommons.org/licenses/by/3.0/',
                }),
                doc('ohne', { collection: ['netlabels'] }),
                { identifier: '../böse' },
              ],
            },
          }),
      ],
    ]);
    const res = await new ArchiveSource({ fetch }).search('x', { type: 'album' });
    expect(res.albums.map((a) => a.id)).toEqual(['lma', 'cc']);
  });

  it('Songs: holt die Einträge und nimmt je ein MP3-Format in Track-Reihenfolge', async () => {
    const fetch = router([
      [/advancedsearch/, () => jsonResponse({ response: { docs: [doc('a1')] } })],
      [/\/metadata\/a1$/, () => jsonResponse(meta('a1'))],
    ]);
    const src = new ArchiveSource({ fetch });
    const res = await src.search('band');
    expect(res.tracks.map((t) => t.title)).toEqual(['Eins', 'Zwei']);
    expect(res.tracks[0]).toMatchObject({
      id: 'a1/gd99-01.mp3',
      sourceId: 'archive',
      artists: ['Die Band'],
      album: 'Konzert a1',
      albumId: 'a1',
      durationMs: 312500,
      license: { name: 'Live Music Archive' },
    });
    expect(res.tracks[1]?.durationMs).toBe(310000);
    expect(await src.getStreamUrl(res.tracks[0]!)).toBe(
      'https://archive.org/download/a1/gd99-01.mp3',
    );
  });

  it('Sonderzeichen im Dateinamen werden sicher kodiert', async () => {
    const src = new ArchiveSource({ fetch: vi.fn() });
    const url = await src.getStreamUrl({
      id: 'a1/CD 1/Lied #2?.mp3',
      sourceId: 'archive',
      title: 'x',
      artists: [],
      durationMs: 0,
    });
    expect(url).toBe('https://archive.org/download/a1/CD%201/Lied%20%232%3F.mp3');
  });

  it('Album laden und Song nachladen', async () => {
    const fetch = router([[/\/metadata\/a1$/, () => jsonResponse(meta('a1'))]]);
    const src = new ArchiveSource({ fetch });
    const album = await src.getAlbum('a1');
    expect(album.tracks).toHaveLength(2);
    expect((await src.getTrack('a1/gd99-02.mp3')).title).toBe('Zwei');
  });

  it('Netzfehler → freundlicher Fehler', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('offline');
    });
    await expect(new ArchiveSource({ fetch }).search('x', { type: 'album' })).rejects.toMatchObject(
      {
        kind: 'network',
        sourceId: 'archive',
      },
    );
  });

  it('Hilfsfunktionen', () => {
    expect(cleanQuery('rock AND (roll) "live" OR *')).toBe('rock roll live');
    expect(parseLength('1:02:03')).toBe(3723000);
    expect(parseLength('abc')).toBe(0);
    expect(pickAudioFiles([{ name: 'a.ogg', format: 'Ogg Vorbis' }])).toEqual([]);
  });
});
