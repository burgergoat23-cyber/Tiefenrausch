import type { Track } from '../sources/types';
import type { LibraryData } from './library';
import { computeStats, DAY_MS } from './stats';

export type MixKind = 'repeat' | 'liked' | 'rediscover';

export interface LocalMix {
  kind: MixKind;
  tracks: Track[];
  shuffle: boolean;
}

const MIN_TRACKS = 3;

/**
 * Mixe nur aus deinen eigenen Daten (auf dem Gerät berechnet):
 * „Auf Repeat“ (meistgehört, 30 Tage), „Lieblingssongs-Mix“, „Wiederentdecken“ (früher oft, lange nicht mehr)
 */
export function localMixes(lib: LibraryData, now: number): LocalMix[] {
  const mixes: LocalMix[] = [];
  const recent = computeStats(lib, now - 30 * DAY_MS, now, 25).topTracks.filter(
    (s) => s.plays >= 2,
  );
  if (recent.length >= MIN_TRACKS)
    mixes.push({ kind: 'repeat', tracks: recent.map((s) => s.track), shuffle: false });

  const liked = lib.likes.map((l) => l.track);
  if (liked.length >= MIN_TRACKS) mixes.push({ kind: 'liked', tracks: liked, shuffle: true });

  const cutoff = now - 21 * DAY_MS;
  const lastPlayed = new Map<string, number>();
  const count = new Map<string, number>();
  for (const p of lib.plays) {
    lastPlayed.set(p.k, Math.max(lastPlayed.get(p.k) ?? 0, p.at));
    count.set(p.k, (count.get(p.k) ?? 0) + 1);
  }
  const old = [...count.entries()]
    .filter(([k, n]) => n >= 2 && (lastPlayed.get(k) ?? 0) < cutoff)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .flatMap(([k]) => (lib.known[k] ? [lib.known[k] as Track] : []))
    .filter((t) => !t.live);
  if (old.length >= MIN_TRACKS) mixes.push({ kind: 'rediscover', tracks: old, shuffle: true });
  return mixes;
}
