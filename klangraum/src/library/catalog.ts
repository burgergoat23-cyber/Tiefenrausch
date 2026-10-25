import { create } from 'zustand';
import type { SourceRegistry } from '../sources/registry';
import { trackKey, type MusicSource, type Track } from '../sources/types';

/** Songs pro Quelle und Seite */
export const PAGE_SIZE = 50;

export const DISCOVER_GENRES = [
  'Drill',
  'Hip-Hop',
  'Trap',
  'Rap',
  'R&B',
  'Pop',
  'Electronic',
  'House',
  'Lo-Fi',
  'Rock',
  'Jazz',
  'Ambient',
  'Reggae',
  'Afrobeats',
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
  const groups = await Promise.all(
    sources.map((s) =>
      s
        .search(genre, { type: 'track', limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then((r) => r.tracks.filter((t) => !t.live))
        .catch(() => [] as Track[]),
    ),
  );
  const tracks: Track[] = [];
  const longest = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < longest; i++) for (const g of groups) if (g[i]) tracks.push(g[i] as Track);
  return { tracks, done: tracks.length === 0 };
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
