import { z } from 'zod';

const PREFIX = 'klangraum.cache.';

const entrySchema = z.object({ until: z.number(), value: z.unknown() });

/**
 * Kleiner Zwischenspeicher mit Ablaufzeit (nur Anzeige-Infos, nie Audio).
 * Spart z. B. YouTube-Kontingent: „Für dich“ fragt pro Künstler höchstens einmal am Tag.
 * Beim Lesen wird mit zod geprüft – kaputte oder alte Einträge werden verworfen.
 */
export interface Cache {
  get<T>(key: string, schema: z.ZodType<T>): T | null;
  set(key: string, value: unknown, ttlMs: number): void;
}

export function createCache(storage: Storage | null, now: () => number = Date.now): Cache {
  return {
    get(key, schema) {
      if (!storage) return null;
      try {
        const raw = storage.getItem(PREFIX + key);
        if (!raw) return null;
        const entry = entrySchema.safeParse(JSON.parse(raw));
        const value = entry.success ? schema.safeParse(entry.data.value) : null;
        if (!entry.success || !value?.success || entry.data.until < now()) {
          storage.removeItem(PREFIX + key);
          return null;
        }
        return value.data;
      } catch {
        return null;
      }
    },
    set(key, value, ttlMs) {
      if (!storage) return;
      try {
        storage.setItem(PREFIX + key, JSON.stringify({ until: now() + ttlMs, value }));
      } catch {
        // Speicher voll – dann eben ohne Zwischenspeicher
      }
    },
  };
}
