import { describe, expect, it } from 'vitest';
import { runMigrations } from './migrations';
import {
  defaultSettings,
  loadSettings,
  parseSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION,
} from './settings';

describe('Migrationen', () => {
  const migrations = {
    0: (d: Record<string, unknown>) => ({
      ...d,
      themeId: d.theme ?? 'mitternacht',
      theme: undefined,
    }),
    1: (d: Record<string, unknown>) => ({ ...d, extra: true }),
  };

  it('führt alle Schritte der Reihe nach aus', () => {
    const out = runMigrations({ theme: 'hell' }, migrations, 2);
    expect(out).toMatchObject({ themeId: 'hell', extra: true, schemaVersion: 2 });
  });

  it('beginnt bei der gespeicherten Version', () => {
    const out = runMigrations({ schemaVersion: 1, themeId: 'oled' }, migrations, 2);
    expect(out).toMatchObject({ themeId: 'oled', extra: true, schemaVersion: 2 });
  });

  it('Daten aus der Zukunft oder Unsinn → null', () => {
    expect(runMigrations({ schemaVersion: 99 }, migrations, 2)).toBeNull();
    expect(runMigrations('kaputt', migrations, 2)).toBeNull();
    expect(runMigrations([1, 2], migrations, 2)).toBeNull();
    expect(runMigrations({ schemaVersion: 0 }, {}, 1)).toBeNull(); // fehlender Schritt
  });
});

describe('Einstellungen', () => {
  it('ohne gespeicherte Daten: Standardwerte', () => {
    const s = loadSettings(localStorage);
    expect(s.schemaVersion).toBe(SETTINGS_VERSION);
    expect(s.themeId).toBe('mitternacht');
  });

  it('speichern und wieder laden', () => {
    const s = { ...defaultSettings(), themeId: 'hell', language: 'en' as const };
    saveSettings(localStorage, s);
    expect(loadSettings(localStorage)).toEqual(s);
  });

  it('kaputtes JSON → Standardwerte statt Absturz', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{nicht json');
    expect(loadSettings(localStorage).themeId).toBe('mitternacht');
  });

  it('einzelne kaputte Felder werden ersetzt, der Rest bleibt', () => {
    const s = parseSettings({
      ...defaultSettings(),
      themeId: 'oled',
      language: 'klingonisch',
      jamendoClientId: '<script>',
    });
    expect(s.themeId).toBe('oled');
    expect(s.language).toBe('de');
    expect(s.jamendoClientId).toBe('');
  });

  it('Quellen: fehlende Einträge sind erlaubt', () => {
    const s = parseSettings({ ...defaultSettings(), sources: { jamendo: false } });
    expect(s.sources).toEqual({ jamendo: false });
  });
});

describe('Echte Migration 1 → 2', () => {
  it('alte Einstellungen bekommen das YouTube-Feld, alles andere bleibt', () => {
    const v1 = {
      schemaVersion: 1,
      themeId: 'hell',
      language: 'en',
      sources: { audius: false },
      jamendoClientId: 'abc',
      searchHistory: ['rock'],
    };
    const s = parseSettings(v1);
    expect(s).toMatchObject({
      schemaVersion: 2,
      themeId: 'hell',
      language: 'en',
      sources: { audius: false },
      jamendoClientId: 'abc',
      youtubeApiKey: '',
      searchHistory: ['rock'],
    });
  });
});
