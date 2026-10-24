import type { TrackCache } from '../storage/cache';
import { trackKey, type MusicSource, type Track } from '../sources/types';

const DAY = 24 * 60 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;

export interface ForYouSources {
  /** Für Lieblingskünstler: offizielle Videos (kostet Kontingent → 24 h merken) */
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
  /** true, wenn Künstler gewünscht sind, aber YouTube fehlt (dann Hinweis anzeigen) */
  artistsNeedYouTube: boolean;
  /** Quellen, die gerade nicht geantwortet haben */
  failed: string[];
}

/** Abwechselnd aus jeder Liste nehmen, doppelte Songs weglassen */
export function roundRobin(lists: Track[][], max: number): Track[] {
  const out: Track[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const list of lists) {
      const t = list[i];
      if (!t) continue;
      const key = trackKey(t);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= max) break;
    }
  }
  return out;
}

async function cached(
  cache: TrackCache,
  key: string,
  ttl: number,
  load: () => Promise<Track[]>,
): Promise<Track[]> {
  const hit = cache.get(key);
  if (hit) return hit;
  const tracks = await load();
  cache.set(key, tracks, ttl);
  return tracks;
}

/**
 * Baut „Für dich“: Lieblingskünstler über YouTube (offizieller Player),
 * Lieblingsgenres über Audius (unabhängige Künstler) und Internetradio.
 */
export async function loadForYou(
  artists: string[],
  genres: string[],
  sources: ForYouSources,
  cache: TrackCache,
): Promise<ForYouResult> {
  const failed = new Set<string>();
  const safe = async (sourceName: string, p: Promise<Track[]>) => {
    try {
      return await p;
    } catch {
      failed.add(sourceName);
      return [];
    }
  };
  const { youtube, audius, radio } = sources;

  const artistLists = youtube
    ? await Promise.all(
        artists.map((a) =>
          safe(
            youtube.name,
            cached(cache, `fy:yt:${a.toLowerCase()}`, DAY, async () =>
              (await youtube.search(a, { type: 'track', limit: 10 })).tracks.filter((t) => !t.live),
            ),
          ),
        ),
      )
    : [];

  const genreLists = audius
    ? await Promise.all(
        genres.map((g) =>
          safe(
            audius.name,
            cached(
              cache,
              `fy:au:${g.toLowerCase()}`,
              SIX_HOURS,
              async () => (await audius.search(g, { type: 'track', limit: 15 })).tracks,
            ),
          ),
        ),
      )
    : [];

  const stationLists = radio
    ? await Promise.all(
        genres.map((g) =>
          safe(
            radio.name,
            cached(
              cache,
              `fy:radio:${g.toLowerCase()}`,
              SIX_HOURS,
              async () => (await radio.search(g, { type: 'track', limit: 8 })).tracks,
            ),
          ),
        ),
      )
    : [];

  return {
    mix: roundRobin([...artistLists, ...genreLists], 60),
    stations: roundRobin(stationLists, 8),
    artistsNeedYouTube: artists.length > 0 && !youtube,
    failed: [...failed],
  };
}
