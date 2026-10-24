import { z } from 'zod';
import type { Cache } from '../storage/cache';
import {
  playlistSummarySchema,
  trackKey,
  trackSchema,
  type MusicSource,
  type Playlist,
  type Track,
} from '../sources/types';

const DAY = 24 * 60 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;
const tracksSchema = z.array(trackSchema).max(200);
const playlistsSchema = z.array(playlistSummarySchema).max(50);

/** So viele Songs pro Künstler (eine YouTube-Suche liefert höchstens 25) */
export const SONGS_PER_ARTIST = 25;
/** Höchstens so viele Songs im Mix */
export const MIX_MAX = 200;

export interface ForYouSources {
  /** Für Lieblingskünstler und Playlists: offizielle Videos (kostet Kontingent → 24 h merken) */
  youtube?: MusicSource;
  /** Für Genres: unabhängige Künstler */
  audius?: MusicSource;
  /** Für Genres: passende Radiosender */
  radio?: MusicSource;
}

export interface ForYouResult {
  /** Gemischte Liste: abwechselnd aus jedem Künstler und dem Genre */
  mix: Track[];
  /** Radiosender zu den Lieblingsgenres */
  stations: Track[];
  /** YouTube-Playlists zu den Lieblingsgenres */
  playlists: Playlist[];
  /** true, wenn Künstler gewünscht sind, aber YouTube fehlt (dann Hinweis anzeigen) */
  artistsNeedYouTube: boolean;
  /** Quellen, die gerade nicht geantwortet haben */
  failed: string[];
}

/** Abwechselnd aus jeder Liste nehmen, doppelte Einträge weglassen */
export function roundRobin<T extends { sourceId: Track['sourceId']; id: string }>(
  lists: T[][],
  max: number,
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const list of lists) {
      const item = list[i];
      if (!item) continue;
      const key = trackKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= max) break;
    }
  }
  return out;
}

async function cached<T>(
  cache: Cache,
  key: string,
  schema: z.ZodType<T>,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key, schema);
  if (hit) return hit;
  const value = await load();
  cache.set(key, value, ttl);
  return value;
}

/**
 * Baut „Für dich“: Lieblingskünstler und Genre-Playlists über YouTube (offizieller Player),
 * Lieblingsgenres über Audius (unabhängige Künstler) und Internetradio.
 */
export async function loadForYou(
  artists: string[],
  genres: string[],
  sources: ForYouSources,
  cache: Cache,
): Promise<ForYouResult> {
  const failed = new Set<string>();
  const safe = async <T>(sourceName: string, p: Promise<T[]>): Promise<T[]> => {
    try {
      return await p;
    } catch {
      failed.add(sourceName);
      return [];
    }
  };
  const { youtube, audius, radio } = sources;
  const each = <T>(
    source: MusicSource | undefined,
    items: string[],
    load: (s: MusicSource, item: string) => Promise<T[]>,
  ): Promise<T[][]> =>
    source
      ? Promise.all(items.map((item) => safe(source.name, load(source, item))))
      : Promise.resolve([]);

  const [artistLists, genreLists, stationLists, playlistLists] = await Promise.all([
    each(youtube, artists, (yt, a) =>
      cached(cache, `fy:yt:${a.toLowerCase()}`, tracksSchema, DAY, async () =>
        (await yt.search(a, { type: 'track', limit: SONGS_PER_ARTIST })).tracks.filter(
          (t) => !t.live,
        ),
      ),
    ),
    each(audius, genres, (au, g) =>
      cached(
        cache,
        `fy:au:${g.toLowerCase()}`,
        tracksSchema,
        SIX_HOURS,
        async () => (await au.search(g, { type: 'track', limit: 25 })).tracks,
      ),
    ),
    each(radio, genres, (r, g) =>
      cached(
        cache,
        `fy:radio:${g.toLowerCase()}`,
        tracksSchema,
        SIX_HOURS,
        async () => (await r.search(g, { type: 'track', limit: 8 })).tracks,
      ),
    ),
    each(youtube, genres, (yt, g) =>
      cached(cache, `fy:ytpl:${g.toLowerCase()}`, playlistsSchema, DAY, async () =>
        (await yt.search(g, { type: 'playlist', limit: 10 })).playlists.map((p) => ({
          id: p.id,
          sourceId: p.sourceId,
          title: p.title,
          owner: p.owner,
          artworkUrl: p.artworkUrl,
          trackCount: p.trackCount,
        })),
      ),
    ),
  ]);

  return {
    mix: roundRobin([...artistLists, ...genreLists], MIX_MAX),
    stations: roundRobin(stationLists, 8),
    playlists: roundRobin(playlistLists, 10),
    artistsNeedYouTube: artists.length > 0 && !youtube,
    failed: [...failed],
  };
}
