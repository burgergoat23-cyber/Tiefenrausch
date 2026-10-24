import type { StoreApi } from 'zustand/vanilla';
import type { PlayerState } from '../player/engine';
import { currentItem } from '../player/queue';
import type { Track } from '../sources/types';

/** Ab wann ein Song als „gehört“ zählt: 30 Sekunden oder die Hälfte (bei kurzen Songs) */
export const COUNT_AFTER_MS = 30_000;
/** Größere Sprünge der Position sind Spulen, kein Hören */
const MAX_STEP_MS = 5_000;

export function countThreshold(durationMs: number): number {
  return durationMs > 0 ? Math.min(COUNT_AFTER_MS, durationMs / 2) : COUNT_AFTER_MS;
}

/**
 * Zählt, wie lange ein Song wirklich lief (nur Abspielzeit, kein Spulen),
 * und meldet ihn einmal als gehört. Wird er neu gestartet (Wiederholen), zählt er erneut.
 */
export function trackPlays(
  store: StoreApi<PlayerState>,
  onPlay: (track: Track, listenedMs: number) => void,
  /** Weitere Hörzeit zum zuletzt gezählten Song (für die Minuten im Rückblick) */
  onMore: (track: Track, ms: number) => void = () => undefined,
): () => void {
  let uid: string | null = null;
  let track: Track | null = null;
  let listened = 0;
  let reported = 0;
  let counted = false;
  let lastPos = 0;

  const report = () => {
    if (counted && track && listened > reported) onMore(track, listened - reported);
    reported = listened;
  };

  return store.subscribe((s) => {
    const item = currentItem(s.queue);
    if (!item) return;
    if (item.uid !== uid) {
      report();
      uid = item.uid;
      track = item.track;
      reported = 0;
      listened = 0;
      counted = false;
      lastPos = s.positionMs;
      return;
    }
    const step = s.positionMs - lastPos;
    // Von hinten wieder an den Anfang (Wiederholen): neue Runde
    if (step < -MAX_STEP_MS && s.positionMs < 3000 && counted) {
      report();
      listened = 0;
      reported = 0;
      counted = false;
    }
    lastPos = s.positionMs;
    if (s.status !== 'playing' || step <= 0 || step > MAX_STEP_MS) return;
    listened += step;
    if (!counted && listened >= countThreshold(item.track.live ? 0 : s.durationMs)) {
      counted = true;
      reported = listened;
      onPlay(item.track, listened);
    } else if (counted && listened - reported >= COUNT_AFTER_MS) {
      report();
    }
  });
}
