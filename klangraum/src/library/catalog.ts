import { z } from 'zod';
import { create } from 'zustand';
import { createCache, type Cache } from '../storage/cache';
import { safeLocalStorage } from '../storage/settings';
import type { SourceRegistry } from '../sources/registry';
import { trackKey, type MusicSource, type Track } from '../sources/types';

/** Songs pro Quelle und Seite */
export const PAGE_SIZE = 50;

/** Genres und Richtungen, in denen viele kleine, unabhängige Künstler veröffentlichen */
export const DISCOVER_GENRES = [
  'Drill',
  'Hip-Hop',
  'Trap',
  'Rap',
  'Boom Bap',
  'Phonk',
  'Grime',
  'R&B',
  'Soul',
  'Pop',
  'Indie',
  'Electronic',
  'House',
  'Techno',
  'Drum and Bass',
  'Dubstep',
  'Lo-Fi',
  'Chill',
  'Ambient',
  'Synthwave',
  'Rock',
  'Punk',
  'Metal',
  'Folk',
  'Acoustic',
  'Jazz',
  'Blues',
  'Funk',
  'Reggae',
  'Afrobeats',
  'Latin',
  'Reggaeton',
  'Classical',
  'Piano',
  'Soundtrack',
  'Experimental',
] as const;

export interface CatalogOptions {
  isEnabled(source: MusicSource): boolean;
}

/** Quellen, die ohne Kontingent beliebig oft durchblättert werden dürfen */
async function pageableSources(registry: SourceRegistry, opts: CatalogOptions) {
  const list = registry.all.filter(
    (s) =>
      s.id !== 'radio' &&
      !s.costlySearch &&
      opts.isEnabled(s) &&
      (!s.searchTypes || s.searchTypes.includes('track')),
  );
  const ok = await Promise.all(list.map((s) => s.isAvailable().catch(() => false)));
  return list.filter((_, i) => ok[i]);
}

// ---------- YouTube: große Playlists pro Genre durchblättern ----------

interface PlaylistPager extends MusicSource {
  findPlaylists(
    query: string,
    max?: number,
  ): Promise<{ id: string; title: string; count: number }[]>;
  playlistPage(id: string, pageToken?: string): Promise<{ tracks: Track[]; next?: string }>;
}

function isPager(s: MusicSource | undefined): s is PlaylistPager {
  return !!s && 'findPlaylists' in s && 'playlistPage' in s;
}

const ytPlaylistsSchema = z.array(
  z.object({ id: z.string(), title: z.string(), count: z.number() }),
);
/** Playlists pro Genre eine Woche merken – die Suche kostet 100 Einheiten vom Tageskontingent */
const YT_PLAYLIST_TTL = 7 * 24 * 60 * 60 * 1000;

interface YtCursor {
  playlists: z.infer<typeof ytPlaylistsSchema>;
  idx: number;
  token?: string;
}
const ytCursors = new Map<string, YtCursor>();
let defaultCache: Cache | null = null;
const cache = () => (defaultCache ??= createCache(safeLocalStorage()));

async function youtubeFor(registry: SourceRegistry, opts: CatalogOptions) {
  const yt = registry.get('youtube');
  if (!isPager(yt) || !opts.isEnabled(yt)) return null;
  return (await yt.isAvailable().catch(() => false)) ? yt : null;
}

async function ytPlaylists(yt: PlaylistPager, genre: string) {
  const key = `yt-genre:${genre.toLowerCase()}`;
  const hit = cache().get(key, ytPlaylistsSchema);
  if (hit) return hit;
  const found = (await yt.findPlaylists(`${genre} music playlist`, 25))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);
  cache().set(key, found, YT_PLAYLIST_TTL);
  return found;
}

/** Nächste 50 Songs aus den YouTube-Playlists des Genres (2 Einheiten pro Seite) */
async function ytNextPage(yt: PlaylistPager, genre: string, restart: boolean): Promise<Track[]> {
  const key = genre.toLowerCase();
  let cur = ytCursors.get(key);
  if (!cur || restart) {
    cur = { playlists: await ytPlaylists(yt, genre), idx: 0 };
    ytCursors.set(key, cur);
  }
  while (cur.idx < cur.playlists.length) {
    const pl = cur.playlists[cur.idx];
    if (!pl) break;
    const page = await yt.playlistPage(pl.id, cur.token);
    if (page.next) cur.token = page.next;
    else {
      cur.idx += 1;
      cur.token = undefined;
    }
    if (page.tracks.length > 0) return page.tracks.filter((t) => !t.live);
  }
  return [];
}

/**
 * Eine Seite des Katalogs: aus jeder freien Quelle bis zu 50 Songs zum Genre, abwechselnd gemischt.
 * `done` = keine Quelle hat mehr etwas geliefert.
 */
export async function loadCatalogPage(
  registry: SourceRegistry,
  genre: string,
  page: number,
  opts: CatalogOptions,
): Promise<{ tracks: Track[]; done: boolean }> {
  const sources = await pageableSources(registry, opts);
  const yt = await youtubeFor(registry, opts);
  const groups = await Promise.all([
    ...sources.map((s) =>
      s
        .search(genre, { type: 'track', limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then((r) => r.tracks.filter((t) => !t.live))
        .catch(() => [] as Track[]),
    ),
    // Kontingent aufgebraucht o. Ä.: dann eben ohne YouTube
    ...(yt ? [ytNextPage(yt, genre, page === 0).catch(() => [] as Track[])] : []),
  ]);
  const tracks: Track[] = [];
  const longest = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < longest; i++) for (const g of groups) if (g[i]) tracks.push(g[i] as Track);
  return { tracks, done: tracks.length === 0 };
}

export interface CatalogCount {
  /** Summe der Quellen, die ihre Gesamtzahl verraten */
  total: number;
  /** Quellen, die mitgezählt wurden bzw. keine Zahl liefern */
  counted: string[];
  uncounted: string[];
  /** In so vielen YouTube-Playlists wurde gezählt (0 = YouTube nicht dabei) */
  youtubePlaylists: number;
}

/** Wie viele Songs es zum Genre mindestens gibt (Quellen ohne Zählung kommen noch dazu) */
export async function countCatalog(
  registry: SourceRegistry,
  genre: string,
  opts: CatalogOptions,
): Promise<CatalogCount> {
  const sources = await pageableSources(registry, opts);
  const yt = await youtubeFor(registry, opts);
  const [counts, ytCount] = await Promise.all([
    Promise.all(
      sources.map((s) => (s.countTracks ? s.countTracks(genre).catch(() => null) : null)),
    ),
    yt
      ? ytPlaylists(yt, genre)
          .then((pls) => ({ videos: pls.reduce((n, p) => n + p.count, 0), playlists: pls.length }))
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const out: CatalogCount = { total: 0, counted: [], uncounted: [], youtubePlaylists: 0 };
  if (ytCount && ytCount.videos > 0) {
    out.total += ytCount.videos;
    out.youtubePlaylists = ytCount.playlists;
  }
  sources.forEach((s, i) => {
    const n = counts[i];
    if (typeof n === 'number' && n > 0) {
      out.total += n;
      out.counted.push(s.name);
    } else out.uncounted.push(s.name);
  });
  return out;
}

/** Neue Songs anhängen, ohne Doppelte */
export function mergeUnique(have: Track[], more: Track[]): Track[] {
  const seen = new Set(have.map(trackKey));
  return [...have, ...more.filter((t) => !seen.has(trackKey(t)) && seen.add(trackKey(t)))];
}

/** Endlos-Mix: solange er läuft, holt Autoplay die nächste Katalog-Seite */
interface StationStore {
  station: { genre: string; nextPage: number; anchorKey: string } | null;
  set(station: StationStore['station']): void;
}

export const useStation = create<StationStore>()((set) => ({
  station: null,
  set: (station) => set({ station }),
}));
