import { compressToEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import { track, tracks } from '../test/fixtures';
import { decodeShare, encodeShare, MAX_SHARED_TRACKS, shareUrl } from './shareLinks';

describe('Teilen-Links', () => {
  it('hin und zurück ergibt dieselben Songs', () => {
    const list = [
      track('a', { artworkUrl: 'https://img.test/a.jpg', album: 'X', license: { name: 'CC BY' } }),
      track('b', { sourceId: 'youtube' }),
    ];
    expect(decodeShare(encodeShare(list, 'Mix'))).toEqual({ name: 'Mix', tracks: list });
  });

  it('höchstens 100 Songs', () => {
    const many = Array.from({ length: 150 }, (_, i) => track(String(i)));
    expect(decodeShare(encodeShare(many))?.tracks).toHaveLength(MAX_SHARED_TRACKS);
  });

  it('manipulierte Links: gefährliche Adressen und Müll werden verworfen', () => {
    const evil = compressToEncodedURIComponent(
      JSON.stringify({
        v: 1,
        t: [
          { s: 'audius', i: '1', t: 'x', a: [], d: 0, w: 'javascript:alert(1)' },
          { s: 'audius', i: '2', t: 'ok', a: ['A'], d: 1 },
        ],
      }),
    );
    expect(decodeShare(evil)?.tracks.map((t) => t.id)).toEqual(['2']);
    expect(decodeShare('quatsch')).toBeNull();
    expect(decodeShare('')).toBeNull();
  });

  it('baut eine Adresse in die App', () => {
    const url = shareUrl(tracks('a'), undefined, 'https://x.test/klangraum/?a=1#/suche');
    expect(url.startsWith('https://x.test/klangraum/#/geteilt?d=')).toBe(true);
  });
});
