import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, track } from '../test/fixtures';
import { activeLine, fetchLyrics, parseLrc, pickResult } from './lyrics';

describe('LRC lesen', () => {
  it('liest Zeitstempel, mehrere pro Zeile und den Versatz', () => {
    const lines = parseLrc(
      '[ar:X]\n[offset:+500]\n[00:12.50]Zwei\n[00:01.00][00:20.00]Eins\nohne Zeit',
    );
    expect(lines).toEqual([
      { timeMs: 500, text: 'Eins' },
      { timeMs: 12000, text: 'Zwei' },
      { timeMs: 19500, text: 'Eins' },
    ]);
  });

  it('findet die aktive Zeile', () => {
    const lines = parseLrc('[00:01.00]a\n[00:05.00]b\n[00:09.00]c');
    expect(activeLine(lines, 0)).toBe(-1);
    expect(activeLine(lines, 1000)).toBe(0);
    expect(activeLine(lines, 8999)).toBe(1);
    expect(activeLine(lines, 99999)).toBe(2);
  });
});

describe('Bestes Ergebnis', () => {
  const r = (name: string, duration: number, synced = true) => ({
    trackName: name,
    duration,
    plainLyrics: 'x',
    syncedLyrics: synced ? '[00:01.00]x' : null,
  });

  it('Titel muss passen, Länge höchstens 4 s daneben, synchron bevorzugt', () => {
    expect(pickResult([r('Anderer Song', 180)], 'Mein Song', 180000)).toBeNull();
    expect(pickResult([r('Mein Song', 200)], 'Mein Song', 180000)).toBeNull();
    const best = pickResult([r('Mein Song', 181, false), r('mein song', 182)], 'Mein Song', 180000);
    expect(best?.syncedLyrics).toBeTruthy();
  });
});

describe('Songtext laden', () => {
  it('fragt LRCLIB mit Künstler und Titel (YouTube-Titel wird aufgeräumt)', async () => {
    const fetch = vi.fn(async (_url: string) =>
      jsonResponse([
        {
          trackName: 'Crazy Story',
          artistName: 'King Von',
          duration: 180,
          syncedLyrics: '[00:02.00]Hallo',
          plainLyrics: 'Hallo',
        },
      ]),
    );
    const t = track('v1', {
      sourceId: 'youtube',
      title: 'King Von - Crazy Story (Official Video)',
      artists: ['KingVonVEVO'],
    });
    const l = await fetchLyrics(t, fetch);
    expect(String(fetch.mock.calls[0]?.[0])).toContain(
      'track_name=Crazy%20Story&artist_name=King%20Von',
    );
    expect(l?.synced).toEqual([{ timeMs: 2000, text: 'Hallo' }]);
  });

  it('versucht es locker nochmal und gibt null zurück, wenn nichts passt', async () => {
    const fetch = vi.fn(async (_url: string) => jsonResponse([]));
    expect(await fetchLyrics(track('a'), fetch)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Radio bekommt keinen Songtext, Serverfehler werden gemeldet', async () => {
    const fetch = vi.fn(async () => jsonResponse({}, 500));
    expect(await fetchLyrics(track('r', { live: true }), fetch)).toBeNull();
    await expect(fetchLyrics(track('a'), fetch)).rejects.toThrow();
  });
});
