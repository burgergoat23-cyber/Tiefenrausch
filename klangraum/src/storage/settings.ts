import { z } from 'zod';
import { DEFAULT_THEME_ID } from '../customize/themes';
import { sourceIdSchema } from '../sources/types';
import { runMigrations, type Migration } from './migrations';

export const SETTINGS_STORAGE_KEY = 'klangraum.settings';
export const SETTINGS_VERSION = 6;

/**
 * EIN Einstellungs-Objekt für alles, was man anpassen kann.
 * Phase 1 enthält Theme, Sprache und Quellen; spätere Phasen hängen Layout, Sound, Tastenkürzel an.
 */
export const settingsSchema = z.object({
  schemaVersion: z.literal(SETTINGS_VERSION),
  themeId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  language: z.enum(['de', 'en']),
  /** Quellen an/aus. Fehlt eine Quelle, ist sie an. */
  sources: z.partialRecord(sourceIdSchema, z.boolean()),
  /** Jamendo-Client-ID (öffentlich, kein Geheimnis) – alternativ zur .env-Datei */
  jamendoClientId: z
    .string()
    .max(64)
    .regex(/^[A-Za-z0-9_-]*$/),
  /** YouTube-API-Schlüssel (Browser-Schlüssel, in der Google-Konsole auf die eigene Seite beschränken) */
  youtubeApiKey: z
    .string()
    .max(100)
    .regex(/^[A-Za-z0-9_-]*$/),
  searchHistory: z.array(z.string().max(200)).max(20),
  /** „Für dich“: Lieblingskünstler und -genres (frei änderbar unter Einstellungen → Deine Musik) */
  favoriteArtists: z.array(z.string().min(1).max(60)).max(20),
  favoriteGenres: z.array(z.string().min(1).max(40)).max(10),
  /** Autoplay: wenn die Warteschlange zu Ende ist, ähnliche Songs weiterspielen */
  autoplay: z.boolean(),
  /** Eigene Akzentfarbe (#rrggbb) – leer = Farbe des Themes */
  accentColor: z.union([z.literal(''), z.string().regex(/^#[0-9a-fA-F]{6}$/)]),
  /** Verschwommenes Cover als Hintergrund im großen Player */
  playerBackdrop: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;

/** Startwerte für „Für dich“ – so gewünscht vom Besitzer der App, jederzeit änderbar */
export const DEFAULT_FAVORITE_ARTISTS = [
  'King Von',
  'Bloodhound Lil Jeff',
  'YNW Melly',
  'Lil Durk',
  'Chief Keef',
  'Pop Smoke',
  'Polo G',
  'G Herbo',
  'Fivio Foreign',
  'Central Cee',
] as const;
/** Mit Version 4 neu dazugekommene Startkünstler (werden bei bestehenden Einstellungen ergänzt) */
const ADDED_IN_V4 = DEFAULT_FAVORITE_ARTISTS.slice(3);
export const DEFAULT_FAVORITE_GENRES = ['Drill'] as const;

export function defaultSettings(language: 'de' | 'en' = 'de'): Settings {
  return {
    schemaVersion: SETTINGS_VERSION,
    themeId: DEFAULT_THEME_ID,
    language,
    sources: { audius: true, jamendo: true },
    jamendoClientId: '',
    youtubeApiKey: '',
    searchHistory: [],
    favoriteArtists: [...DEFAULT_FAVORITE_ARTISTS],
    favoriteGenres: [...DEFAULT_FAVORITE_GENRES],
    autoplay: true,
    accentColor: '',
    playerBackdrop: true,
  };
}

export const SETTINGS_MIGRATIONS: Record<number, Migration> = {
  /** 1 → 2: Feld für den YouTube-Schlüssel */
  1: (d) => ({ ...d, youtubeApiKey: '' }),
  /** 2 → 3: Lieblingskünstler und -genres für „Für dich“ */
  2: (d) => ({
    ...d,
    favoriteArtists: DEFAULT_FAVORITE_ARTISTS.slice(0, 3),
    favoriteGenres: [...DEFAULT_FAVORITE_GENRES],
  }),
  /** 3 → 4: weitere Drill-Künstler ergänzen (eigene Einträge bleiben, höchstens 20) */
  3: (d) => {
    const own = Array.isArray(d.favoriteArtists)
      ? d.favoriteArtists.filter((a): a is string => typeof a === 'string')
      : [];
    const have = new Set(own.map((a) => a.toLowerCase()));
    const added = ADDED_IN_V4.filter((a) => !have.has(a.toLowerCase()));
    return { ...d, favoriteArtists: [...own, ...added].slice(0, 20) };
  },
  /** 4 → 5: Autoplay (an) */
  4: (d) => ({ ...d, autoplay: true }),
  /** 5 → 6: eigene Akzentfarbe, Cover-Hintergrund im Player */
  5: (d) => ({ ...d, accentColor: '', playerBackdrop: true }),
};

/** Browser-Sprache als Startwert (Deutsch zuerst) */
export function guessLanguage(): 'de' | 'en' {
  if (typeof navigator === 'undefined') return 'de';
  const lang = (navigator.language || 'de').toLowerCase();
  return lang.startsWith('de') ? 'de' : lang.startsWith('en') ? 'en' : 'de';
}

/**
 * Prüft beliebige Daten (aus dem Speicher oder einem Import).
 * Einzelne kaputte Felder werden durch Standardwerte ersetzt, statt alles zu verwerfen.
 */
export function parseSettings(input: unknown, fallback: Settings = defaultSettings()): Settings {
  const migrated = runMigrations(input, SETTINGS_MIGRATIONS, SETTINGS_VERSION);
  if (!migrated) return fallback;
  const whole = settingsSchema.safeParse(migrated);
  if (whole.success) return whole.data;
  const out: Record<string, unknown> = { ...fallback };
  const shape = settingsSchema.shape;
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const r = shape[key].safeParse(migrated[key]);
    if (r.success) out[key] = r.data;
  }
  const again = settingsSchema.safeParse(out);
  return again.success ? again.data : fallback;
}

export function loadSettings(storage: Storage | null): Settings {
  const fallback = defaultSettings(guessLanguage());
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    return parseSettings(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function saveSettings(storage: Storage | null, settings: Settings) {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Speicher voll oder gesperrt – nicht schlimm, die App läuft weiter
  }
}

/** localStorage kann im privaten Modus fehlen oder werfen */
export function safeLocalStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const k = '__kr_test__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}
