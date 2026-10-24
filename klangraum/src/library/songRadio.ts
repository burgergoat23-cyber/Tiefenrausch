import type { SourceRegistry } from '../sources/registry';
import { trackKey, type MusicSource, type Track } from '../sources/types';
import { parseArtistTitle } from './covers';

export interface RadioOptions {
  /** eingeschaltete Quellen */
  isEnabled(source: MusicSource): boolean;
  favoriteArtists: string[];
  /** schon gehört / schon in der Warteschlange */
  exclude: Set<string>;
  random?: () => number;
  /** YouTube kostet Kontingent – nur wenn ausdrücklich erlaubt */
  allowCostly?: boolean;
  limit?: number;
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/**
 * Song-Radio: mehr vom selben Künstler plus Songs deiner Lieblingskünstler, gemischt.
 * Ehrlich gesagt keine „KI-Empfehlung“ – nur Suche in den freien Quellen nach passenden Künstlern.
 */
export async function similarTracks(
  seed: Track,
  registry: SourceRegistry,
  opts: RadioOptions,
): Promise<Track[]> {
  const random = opts.random ?? Math.random;
  const limit = opts.limit ?? 30;
  const artist = parseArtistTitle(seed)?.artist ?? seed.artists[0] ?? '';
  const favs = shuffle(
    opts.favoriteArtists.filter((a) => a.toLowerCase() !== artist.toLowerCase()),
    random,
  ).slice(0, 2);
  const names = [artist, ...favs].filter(Boolean);
  const sources = registry.all.filter(
    (s) =>
      s.id !== 'radio' &&
      s.id !== 'archive' &&
      opts.isEnabled(s) &&
      (!s.costlySearch || opts.allowCostly) &&
      (!s.searchTypes || s.searchTypes.includes('track')),
  );
  const available = (
    await Promise.all(
      sources.map(async (s) => ((await s.isAvailable().catch(() => false)) ? s : null)),
    )
  ).filter((s): s is MusicSource => s !== null);

  const jobs: Promise<Track[]>[] = [];
  for (const name of names) {
    for (const s of available) {
      // Teure Quelle (YouTube) nur für den Künstler des Songs, nicht für jeden Favoriten
      if (s.costlySearch && name !== artist) continue;
      jobs.push(
        s
          .search(name, { type: 'track', limit: 15 })
          .then((r) => r.tracks)
          .catch(() => []),
      );
    }
  }
  const groups = await Promise.all(jobs);
  const seen = new Set(opts.exclude);
  seen.add(trackKey(seed));
  const titles = new Set([seed.title.toLowerCase()]);
  const picked: Track[] = [];
  // Abwechselnd aus den Gruppen nehmen, damit nicht 15 Songs am Stück vom selben Künstler kommen
  const pools = groups.map((g) => shuffle(g, random));
  let added = true;
  while (picked.length < limit && added) {
    added = false;
    for (const pool of pools) {
      while (pool.length > 0) {
        const t = pool.shift() as Track;
        const k = trackKey(t);
        const title = t.title.toLowerCase();
        if (seen.has(k) || titles.has(title) || t.live) continue;
        seen.add(k);
        titles.add(title);
        picked.push(t);
        added = true;
        break;
      }
      if (picked.length >= limit) break;
    }
  }
  return picked;
}
