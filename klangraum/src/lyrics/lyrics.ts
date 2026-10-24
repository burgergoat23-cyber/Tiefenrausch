import { useEffect, useState } from 'react';
import { z } from 'zod';
import { parseArtistTitle } from '../library/covers';
import type { FetchLike } from '../sources/http';
import { trackKey, type Track } from '../sources/types';

/**
 * Songtexte von LRCLIB (lrclib.net): freie, offene Datenbank, kein Schlüssel nötig.
 * Viele Texte sind „synchron“ (mit Zeitstempeln) → sie laufen beim Hören mit.
 */
export const LRCLIB_API = 'https://lrclib.net/api';

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface Lyrics {
  synced: LyricLine[] | null;
  plain: string | null;
  instrumental: boolean;
}

/** „[01:02.50] Text“ → { timeMs: 62500, text: 'Text' }. Mehrere Zeitstempel pro Zeile gehen auch. */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  let offset = 0;
  for (const raw of lrc.split(/\r?\n/)) {
    const off = /^\[offset:\s*([+-]?\d+)\]/i.exec(raw);
    if (off) {
      offset = Number(off[1]);
      continue;
    }
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const min = Number(m[1]);
      const sec = Number((m[2] ?? '0').replace(':', '.'));
      if (!Number.isFinite(min) || !Number.isFinite(sec)) continue;
      out.push({ timeMs: Math.max(0, Math.round((min * 60 + sec) * 1000) - offset), text });
    }
  }
  return out.sort((a, b) => a.timeMs - b.timeMs);
}

/** Welche Zeile gerade dran ist (-1 = vor der ersten) */
export function activeLine(lines: LyricLine[], positionMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid]?.timeMs ?? Infinity) <= positionMs) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const resultSchema = z.object({
  trackName: z.string().nullish(),
  artistName: z.string().nullish(),
  duration: z.number().nullish(),
  instrumental: z.boolean().nullish(),
  plainLyrics: z.string().max(100_000).nullish(),
  syncedLyrics: z.string().max(200_000).nullish(),
});
type LrcResult = z.infer<typeof resultSchema>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Bestes Ergebnis: passender Titel, Länge ±4 s (wenn bekannt), synchron vor reinem Text */
export function pickResult(
  results: LrcResult[],
  title: string,
  durationMs: number,
): LrcResult | null {
  const want = norm(title);
  const scored = results
    .filter((r) => r.instrumental || r.plainLyrics || r.syncedLyrics)
    .map((r) => {
      let score = 0;
      const name = norm(r.trackName ?? '');
      if (name === want) score += 4;
      else if (name.includes(want) || want.includes(name)) score += 2;
      else return null;
      if (durationMs > 0 && r.duration) {
        const diff = Math.abs(r.duration - durationMs / 1000);
        if (diff > 4) return null;
        score += diff <= 2 ? 2 : 1;
      }
      if (r.syncedLyrics) score += 1;
      return { r, score };
    })
    .filter((x): x is { r: LrcResult; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.r ?? null;
}

export async function fetchLyrics(
  track: Track,
  fetchImpl: FetchLike = (i, init) => fetch(i, init),
): Promise<Lyrics | null> {
  if (track.live) return null;
  const parsed = parseArtistTitle(track);
  if (!parsed) return null;
  const queries = [
    `track_name=${encodeURIComponent(parsed.title)}&artist_name=${encodeURIComponent(parsed.artist)}`,
    `q=${encodeURIComponent(`${parsed.artist} ${parsed.title}`)}`,
  ];
  for (const q of queries) {
    const res = await fetchImpl(`${LRCLIB_API}/search?${q}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
    const body = z.array(z.unknown()).safeParse(await res.json());
    if (!body.success) continue;
    const results = body.data.flatMap((r) => {
      const p = resultSchema.safeParse(r);
      return p.success ? [p.data] : [];
    });
    const best = pickResult(results, parsed.title, track.durationMs);
    if (!best) continue;
    const synced = best.syncedLyrics ? parseLrc(best.syncedLyrics) : [];
    return {
      synced: synced.length > 0 ? synced : null,
      plain: best.plainLyrics?.trim() || null,
      instrumental: !!best.instrumental,
    };
  }
  return null;
}

// ---------- Anbindung an die Oberfläche ----------

const MAX_CACHED = 60;
const memory = new Map<string, Lyrics | null>();
let fetcher: ((t: Track) => Promise<Lyrics | null>) | null = (t) => fetchLyrics(t);

/** In Tests austauschbar (null = nie suchen) */
export function setLyricsFetcher(f: ((t: Track) => Promise<Lyrics | null>) | null) {
  fetcher = f;
  memory.clear();
}

export type LyricsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'none' }
  | { status: 'done'; lyrics: Lyrics };

export function useLyrics(track: Track | null, enabled: boolean): [LyricsState, () => void] {
  const key = track ? trackKey(track) : '';
  const [state, setState] = useState<{ key: string; s: LyricsState }>({
    key: '',
    s: { status: 'loading' },
  });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!track || !enabled) return;
    const cached = memory.get(key);
    if (cached !== undefined) {
      setState({ key, s: cached ? { status: 'done', lyrics: cached } : { status: 'none' } });
      return;
    }
    if (!fetcher) {
      setState({ key, s: { status: 'none' } });
      return;
    }
    let alive = true;
    setState({ key, s: { status: 'loading' } });
    fetcher(track).then(
      (l) => {
        memory.set(key, l);
        if (memory.size > MAX_CACHED) memory.delete(memory.keys().next().value as string);
        if (alive) setState({ key, s: l ? { status: 'done', lyrics: l } : { status: 'none' } });
      },
      () => {
        if (alive) setState({ key, s: { status: 'error' } });
      },
    );
    return () => {
      alive = false;
    };
  }, [track, key, enabled, retry]);

  const current: LyricsState = state.key === key ? state.s : { status: 'loading' };
  return [current, () => setRetry((r) => r + 1)];
}
