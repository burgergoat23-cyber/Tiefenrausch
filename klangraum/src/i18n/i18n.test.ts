import { describe, expect, it } from 'vitest';
import { allKeys, de, en, translate } from './index';

describe('Texte (i18n)', () => {
  it('Englisch hat genau dieselben Schlüssel wie Deutsch', () => {
    expect(allKeys(en).sort()).toEqual(allKeys(de).sort());
  });

  it('kein Text ist leer', () => {
    for (const dict of [de, en]) {
      for (const key of allKeys(dict)) {
        expect(translate(dict === de ? 'de' : 'en', key as never).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('Platzhalter werden ersetzt', () => {
    expect(translate('de', 'errors.network', { source: 'Audius' })).toBe(
      'Audius antwortet gerade nicht – versuch es gleich nochmal.',
    );
    expect(translate('en', 'track.count', { count: 3 })).toBe('3 songs');
  });

  it('Platzhalter stimmen in beiden Sprachen überein', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const key of allKeys(de)) {
      expect(vars(translate('en', key as never)), key).toBe(vars(translate('de', key as never)));
    }
  });
});
