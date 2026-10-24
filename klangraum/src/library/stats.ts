import type { Track } from '../sources/types';
import type { LibraryData } from './library';

export interface ArtistStat {
  name: string;
  plays: number;
  ms: number;
  /** ein Song des Künstlers (für das Bild) */
  sample: Track;
}

export interface TrackStat {
  track: Track;
  plays: number;
}

export interface Stats {
  plays: number;
  ms: number;
  artists: number;
  topArtists: ArtistStat[];
  topTracks: TrackStat[];
  /** Anzahl gehörter Songs je Stunde (0–23, Ortszeit) */
  hours: number[];
  /** Tage am Stück mit Musik, bis heute (oder gestern) */
  streak: number;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

function dayIndex(ts: number): number {
  const d = new Date(ts);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY_MS);
}

/** Dein Rückblick: alles aus dem Verlauf auf dem Gerät berechnet */
export function computeStats(lib: LibraryData, since: number, now: number, top = 10): Stats {
  const hours = new Array<number>(24).fill(0);
  const byTrack = new Map<string, TrackStat>();
  const byArtist = new Map<string, ArtistStat>();
  let plays = 0;
  let ms = 0;
  for (const p of lib.plays) {
    if (p.at < since || p.at > now) continue;
    const track = lib.known[p.k];
    if (!track) continue;
    plays += 1;
    ms += p.ms;
    hours[new Date(p.at).getHours()] = (hours[new Date(p.at).getHours()] ?? 0) + 1;
    const ts = byTrack.get(p.k) ?? { track, plays: 0 };
    ts.plays += 1;
    byTrack.set(p.k, ts);
    const name = track.artists[0];
    if (name && !track.live) {
      const key = name.toLowerCase();
      const as = byArtist.get(key) ?? { name, plays: 0, ms: 0, sample: track };
      as.plays += 1;
      as.ms += p.ms;
      byArtist.set(key, as);
    }
  }
  const days = new Set(lib.plays.map((p) => dayIndex(p.at)));
  let streak = 0;
  let day = dayIndex(now);
  if (!days.has(day)) day -= 1;
  while (days.has(day)) {
    streak += 1;
    day -= 1;
  }
  return {
    plays,
    ms,
    artists: byArtist.size,
    topArtists: [...byArtist.values()]
      .sort((a, b) => b.plays - a.plays || b.ms - a.ms)
      .slice(0, top),
    topTracks: [...byTrack.values()].sort((a, b) => b.plays - a.plays).slice(0, top),
    hours,
    streak,
  };
}

export type Period = 'week' | 'month' | 'year' | 'all';

export function periodStart(period: Period, now: number): number {
  if (period === 'week') return now - 7 * DAY_MS;
  if (period === 'month') return now - 30 * DAY_MS;
  if (period === 'year') return new Date(new Date(now).getFullYear(), 0, 1).getTime();
  return 0;
}

/** Tageszeit mit den meisten Songs */
export function favoriteDaytime(hours: number[]): 'morning' | 'day' | 'evening' | 'night' | null {
  const sum = (from: number, to: number) => hours.slice(from, to).reduce((a, b) => a + b, 0);
  const parts = {
    night: sum(0, 5) + sum(22, 24),
    morning: sum(5, 11),
    day: sum(11, 17),
    evening: sum(17, 22),
  };
  const best = (Object.entries(parts) as [keyof typeof parts, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];
  return best && best[1] > 0 ? best[0] : null;
}
