import { describe, expect, it } from 'vitest';
import { DEFAULT_FAVORITE_ARTISTS } from '../storage/settings';
import { openSuggestions, SUGGESTED_ARTISTS, SUGGESTED_GENRES } from './suggestions';

describe('Vorschläge', () => {
  it('zeigt nur, was noch fehlt (Groß-/Kleinschreibung egal)', () => {
    expect(openSuggestions(['A', 'B', 'C'], ['b'])).toEqual(['A', 'C']);
  });

  it('keine doppelten Namen, Längen passen in die Einstellungen', () => {
    for (const list of [SUGGESTED_ARTISTS, SUGGESTED_GENRES]) {
      const lower = list.map((x) => x.toLowerCase());
      expect(new Set(lower).size).toBe(list.length);
      for (const x of list) expect(x.length).toBeLessThanOrEqual(40);
    }
  });

  it('Startkünstler sind höchstens 20', () => {
    expect(DEFAULT_FAVORITE_ARTISTS.length).toBeLessThanOrEqual(20);
  });
});
