import { z } from 'zod';
import { trackSchema, type Track } from '../sources/types';

const PREFIX = 'klangraum.cache.';

const entrySchema = z.object({
  until: z.number(),
  tracks: z.array(trackSchema).max(200),
});

/**
 * Kleiner Zwischenspeicher für Song-Listen (nur Anzeige-Infos, nie Audio), mit Ablaufzeit.
 * Spart z. B. YouTube-Kontingent: „Für dich“ fragt pro Künstler höchstens einmal am Tag.
 */
export interface TrackCache {
  get(key: string): Track[] | null;
  set(key: string, tracks: Track[], ttlMs: number): void;
}

export function createTrackCache(
  storage: Storage | null,
  now: () => number = Date.now,
): TrackCache {
  return {
    get(key) {
      if (!storage) return null;
      try {
        const raw = storage.getItem(PREFIX + key);
        if (!raw) return null;
        const r = entrySchema.safeParse(JSON.parse(raw));
        if (!r.success || r.data.until < now()) {
          storage.removeItem(PREFIX + key);
          return null;
        }
        return r.data.tracks;
      } catch {
        return null;
      }
    },
    set(key, tracks, ttlMs) {
      if (!storage) return;
      try {
        storage.setItem(PREFIX + key, JSON.stringify({ until: now() + ttlMs, tracks }));
      } catch {
        // Speicher voll – dann eben ohne Zwischenspeicher
      }
    },
  };
}
