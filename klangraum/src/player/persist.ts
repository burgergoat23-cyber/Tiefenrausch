import { z } from 'zod';
import { trackSchema } from '../sources/types';
import type { PlayerEngine, PlayerState } from './engine';

export const PLAYER_STORAGE_KEY = 'klangraum.player.v1';

const savedSchema = z.object({
  v: z.literal(1),
  items: z.array(z.object({ uid: z.string().min(1).max(100), track: trackSchema })).max(5000),
  index: z.number().int().min(-1),
  shuffle: z.boolean(),
  repeat: z.enum(['off', 'all', 'one']),
  original: z.array(z.string()).nullable(),
  positionMs: z.number().nonnegative(),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
});

export type SavedPlayer = z.infer<typeof savedSchema>;

/** Liest die gespeicherte Warteschlange. Kaputte oder fremde Daten → null (dann leer starten). */
export function loadPlayerState(storage: Storage | null): Partial<PlayerState> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return null;
    const r = savedSchema.safeParse(JSON.parse(raw));
    if (!r.success) return null;
    const d = r.data;
    const index = d.items.length === 0 ? -1 : Math.min(Math.max(d.index, 0), d.items.length - 1);
    return {
      queue: {
        items: d.items,
        index,
        shuffle: d.shuffle,
        repeat: d.repeat,
        original: d.shuffle ? d.original : null,
      },
      positionMs: d.positionMs,
      durationMs: d.items[index]?.track.durationMs ?? 0,
      volume: d.volume,
      muted: d.muted,
    };
  } catch {
    return null;
  }
}

function toSaved(s: PlayerState): SavedPlayer {
  return {
    v: 1,
    items: s.queue.items,
    index: s.queue.index,
    shuffle: s.queue.shuffle,
    repeat: s.queue.repeat,
    original: s.queue.original,
    positionMs: s.positionMs,
    volume: s.volume,
    muted: s.muted,
  };
}

/**
 * Speichert Warteschlange, Lautstärke und Position lokal (nur Anzeige-Infos, nie Audio).
 * Die Position wird höchstens alle paar Sekunden geschrieben.
 */
export function persistPlayer(
  engine: PlayerEngine,
  storage: Storage | null,
  positionEveryMs = 5000,
) {
  if (!storage) return () => {};
  let lastPositionSave = 0;
  const save = (s: PlayerState) => {
    try {
      storage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(toSaved(s)));
    } catch {
      // Speicher voll oder gesperrt (privater Modus) – App läuft trotzdem weiter
    }
  };
  return engine.store.subscribe((s, prev) => {
    const important = s.queue !== prev.queue || s.volume !== prev.volume || s.muted !== prev.muted;
    const now = Date.now();
    if (important || now - lastPositionSave > positionEveryMs) {
      lastPositionSave = now;
      save(s);
    }
  });
}
