import { useEffect } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import type { FetchLike } from '../sources/http';
import { trackKey, webUrlSchema, type Track } from '../sources/types';
import type { Cache } from '../storage/cache';

/**
 * Originale Cover über offene Musik-Datenbanken:
 * MusicBrainz findet zum Song das Album/die Single, das Cover Art Archive liefert das Bild.
 * Bilder werden nur angezeigt (verlinkt), nie gespeichert oder kopiert.
 */
export const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
export const COVER_ART_ARCHIVE = 'https://coverartarchive.org';

const DAY = 24 * 60 * 60 * 1000;
const FOUND_TTL = 30 * DAY;
const NOT_FOUND_TTL = 7 * DAY;
/** MusicBrainz erlaubt im Schnitt höchstens eine Anfrage pro Sekunde */
const MB_INTERVAL_MS = 1100;
const MIN_SCORE = 85;

const mbid = z.string().regex(/^[0-9a-f-]{36}$/);
const mbResponseSchema = z.object({
  recordings: z
    .array(
      z.object({
        score: z.coerce.number().optional(),
        releases: z
          .array(
            z.object({
              status: z.string().optional(),
              date: z.string().optional(),
              'release-group': z
                .object({
                  id: mbid,
                  'primary-type': z.string().optional(),
                  'secondary-types': z.array(z.string()).optional(),
                })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});
type MbResponse = z.infer<typeof mbResponseSchema>;

const cachedCoverSchema = z.object({ url: webUrlSchema.nullable() });

/** Für welche Songs lohnt sich die Suche? YouTube zeigt nur Video-Standbilder, manche Songs haben gar kein Bild. */
export function needsCoverLookup(t: Track): boolean {
  if (t.live || t.sourceId === 'radio') return false;
  if (t.sourceId === 'youtube') return true;
  return !t.artworkUrl;
}

/** Aus „King Von - Song (Official Video)“ wird { artist: 'King Von', title: 'Song' } */
export function parseArtistTitle(t: Track): { artist: string; title: string } | null {
  let title = t.title;
  let artist = t.artists[0] ?? '';
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    artist = parts[0] ?? artist;
    title = parts.slice(1).join(' - ');
  }
  title = title
    .replace(/[([【][^)\]】]*[)\]】]/g, ' ') // Zusätze in Klammern: (Official Video), [Lyrics] …
    .replace(/\s+(ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .replace(/["“”„]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  artist = artist
    .replace(/\s+(x|&|feat\.?|ft\.?|with)\s+.*$/i, '')
    .replace(/,.*$/, '')
    .replace(/VEVO$/, '')
    .replace(/\s+-\s+Topic$/i, '')
    .trim();
  if (!title || !artist) return null;
  return { artist, title };
}

const quote = (s: string) => `"${s.replace(/[\\"]/g, '\\$&')}"`;

/** Einzelne Wörter ohne Sonderzeichen der Such-Sprache (für die lockere zweite Suche) */
const words = (s: string) =>
  s
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(AND|OR|NOT)$/i.test(w))
    .join(' ');

/** Bestes Album/Single zur Aufnahme: offiziell, kein Sampler/Live, möglichst die erste Veröffentlichung */
export function pickReleaseGroup(data: MbResponse): string | null {
  const candidates: { id: string; date: string }[] = [];
  for (const rec of data.recordings ?? []) {
    if ((rec.score ?? 0) < MIN_SCORE) continue;
    for (const rel of rec.releases ?? []) {
      const rg = rel['release-group'];
      if (!rg) continue;
      if (rel.status && rel.status !== 'Official') continue;
      if (!['Album', 'Single', 'EP'].includes(rg['primary-type'] ?? '')) continue;
      const bad = (rg['secondary-types'] ?? []).some((s) =>
        ['Compilation', 'Live', 'DJ-mix'].includes(s),
      );
      if (bad) continue;
      candidates.push({ id: rg.id, date: rel.date || '9999' });
    }
    if (candidates.length > 0) break; // beste passende Aufnahme gefunden
  }
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0]?.id ?? null;
}

export function coverUrl(releaseGroupId: string): string {
  return `${COVER_ART_ARCHIVE}/release-group/${releaseGroupId}/front-500`;
}

export interface CoverResolver {
  /** Bereits bekanntes Cover (undefined = noch nicht gesucht, null = keins gefunden) */
  peek(track: Track): string | null | undefined;
  resolve(track: Track): Promise<string | null>;
}

export interface CoverResolverOptions {
  fetch?: FetchLike;
  cache: Cache;
  intervalMs?: number;
  now?: () => number;
}

export function createCoverResolver(opts: CoverResolverOptions): CoverResolver {
  const fetchImpl: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init));
  const now = opts.now ?? Date.now;
  const interval = opts.intervalMs ?? MB_INTERVAL_MS;
  const inFlight = new Map<string, Promise<string | null>>();
  let queue: Promise<unknown> = Promise.resolve();
  let lastRequest = 0;

  const cacheKey = (t: Track) => `cover:${trackKey(t)}`;

  /** Anfragen nacheinander, mit Abstand (Regel von MusicBrainz) */
  const throttled = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const wait = lastRequest + interval - now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastRequest = now();
      return fn();
    });
    queue = run.catch(() => undefined);
    return run;
  };

  const lookup = async (t: Track): Promise<string | null> => {
    const parsed = parseArtistTitle(t);
    if (!parsed) return null;
    // 1. genau (Titel und Künstler als ganze Wortgruppe), 2. locker (einzelne Wörter)
    const queries = [
      `recording:${quote(parsed.title)} AND artist:${quote(parsed.artist)}`,
      `recording:(${words(parsed.title)}) AND artist:(${words(parsed.artist)})`,
    ];
    for (const query of queries) {
      const url = `${MUSICBRAINZ_API}/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
      const res = await throttled(() =>
        fetchImpl(url, { headers: { Accept: 'application/json' } }),
      );
      if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
      const body = mbResponseSchema.safeParse(await res.json());
      const rg = body.success ? pickReleaseGroup(body.data) : null;
      if (rg) return coverUrl(rg);
    }
    return null;
  };

  return {
    peek(t) {
      if (!needsCoverLookup(t)) return null;
      const hit = opts.cache.get(cacheKey(t), cachedCoverSchema);
      return hit ? hit.url : undefined;
    },
    resolve(t) {
      if (!needsCoverLookup(t)) return Promise.resolve(null);
      const hit = opts.cache.get(cacheKey(t), cachedCoverSchema);
      if (hit) return Promise.resolve(hit.url);
      const key = cacheKey(t);
      const running = inFlight.get(key);
      if (running) return running;
      const p = lookup(t)
        .then((url) => {
          opts.cache.set(key, { url }, url ? FOUND_TTL : NOT_FOUND_TTL);
          return url;
        })
        .catch(() => null) // Netzfehler: nichts merken, später nochmal versuchen
        .finally(() => inFlight.delete(key));
      inFlight.set(key, p);
      return p;
    },
  };
}

// ---------- Anbindung an die Oberfläche ----------

let resolver: CoverResolver | null = null;

/** Wird beim App-Start gesetzt; in Tests ausgeschaltet (null) */
export function setCoverResolver(r: CoverResolver | null) {
  resolver = r;
}

interface CoverStore {
  urls: Record<string, string | null>;
  setUrl(key: string, url: string | null): void;
}

/** Gefundene Cover für die ganze App (auch Mini-Player und Sperrbildschirm) */
export const useCovers = create<CoverStore>()((set) => ({
  urls: {},
  setUrl: (key, url) => set((s) => ({ urls: { ...s.urls, [key]: url } })),
}));

/** Originales Cover zu einem Song (sucht erst, wenn `enabled` – z. B. sobald der Song sichtbar ist) */
export function useCover(track: Track | null | undefined, enabled = true): string | undefined {
  const key = track ? trackKey(track) : '';
  const known = useCovers((s) => (key ? s.urls[key] : undefined));
  useEffect(() => {
    if (!track || !enabled || known !== undefined || !resolver) return;
    const r = resolver;
    const peeked = r.peek(track);
    if (peeked !== undefined) {
      useCovers.getState().setUrl(key, peeked);
      return;
    }
    let alive = true;
    void r.resolve(track).then((url) => {
      if (alive || url) useCovers.getState().setUrl(key, url);
    });
    return () => {
      alive = false;
    };
  }, [track, key, enabled, known]);
  return known ?? undefined;
}

/** Für Nicht-React-Code (Sperrbildschirm): bekanntes Cover oder das Bild der Quelle */
export function coverFor(track: Track): string | undefined {
  return useCovers.getState().urls[trackKey(track)] ?? track.artworkUrl;
}
