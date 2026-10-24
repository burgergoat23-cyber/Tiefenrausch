import { describe, expect, it } from 'vitest';
import { track } from '../test/fixtures';
import { emptyLibrary, recordPlay } from './library';
import { computeStats, DAY_MS, favoriteDaytime } from './stats';

describe('Rückblick', () => {
  it('zählt Songs, Minuten, Top-Künstler und Tage am Stück', () => {
    const now = new Date(2026, 9, 24, 20, 0).getTime();
    let lib = emptyLibrary();
    const von = track('v', { artists: ['King Von'] });
    const durk = track('d', { artists: ['Lil Durk'] });
    lib = recordPlay(lib, von, 60000, now - 2 * DAY_MS);
    lib = recordPlay(lib, von, 120000, now - DAY_MS);
    lib = recordPlay(lib, durk, 60000, now - 1000);
    lib = recordPlay(lib, durk, 60000, now - 40 * DAY_MS);
    const s = computeStats(lib, now - 30 * DAY_MS, now);
    expect(s.plays).toBe(3);
    expect(s.ms).toBe(240000);
    expect(s.topArtists[0]?.name).toBe('King Von');
    expect(s.topTracks[0]?.track.id).toBe('v');
    expect(s.streak).toBe(3);
    expect(s.hours.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('Lieblings-Tageszeit', () => {
    const h = new Array(24).fill(0);
    expect(favoriteDaytime(h)).toBeNull();
    h[23] = 5;
    h[9] = 2;
    expect(favoriteDaytime(h)).toBe('night');
  });
});
