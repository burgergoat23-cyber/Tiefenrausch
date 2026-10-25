import { describe, expect, it } from 'vitest';
import { createRegistry } from '../sources/registry';
import type { MusicSource, SourceId } from '../sources/types';
import { track } from '../test/fixtures';
import { countCatalog, loadCatalogPage, mergeUnique } from './catalog';

function src(id: SourceId, total: number, extra: Partial<MusicSource> = {}): MusicSource {
  return {
    id,
    name: id,
    needsLogin: false,
    playbackMode: 'url',
    canUseWebAudio: true,
    allowsOfflineCache: false,
    isAvailable: async () => true,
    search: async (_q, o) => {
      const from = o?.offset ?? 0;
      const n = Math.max(0, Math.min(o?.limit ?? 20, total - from));
      return {
        tracks: Array.from({ length: n }, (_, i) => track(`${id}${from + i}`, { sourceId: id })),
        albums: [],
        artists: [],
        playlists: [],
      };
    },
    getTrack: async (t) => track(t),
    ...extra,
  };
}

describe('Katalog zum Durchblättern', () => {
  it('mischt freie Quellen abwechselnd, ohne YouTube und Radio', async () => {
    const reg = createRegistry([
      src('audius', 120),
      src('jamendo', 60),
      src('youtube', 999, { costlySearch: true }),
      src('radio', 999),
    ]);
    const p0 = await loadCatalogPage(reg, 'Drill', 0, { isEnabled: () => true });
    expect(p0.tracks).toHaveLength(100);
    expect(p0.tracks.slice(0, 2).map((t) => t.sourceId)).toEqual(['audius', 'jamendo']);
    expect(p0.tracks.some((t) => t.sourceId === 'youtube' || t.sourceId === 'radio')).toBe(false);
    const p1 = await loadCatalogPage(reg, 'Drill', 1, { isEnabled: () => true });
    expect(p1.tracks).toHaveLength(60);
    const p3 = await loadCatalogPage(reg, 'Drill', 3, { isEnabled: () => true });
    expect(p3.done).toBe(true);
  });

  it('hängt nur neue Songs an', () => {
    expect(
      mergeUnique([track('a')], [track('a'), track('b'), track('b')]).map((t) => t.id),
    ).toEqual(['a', 'b']);
  });
});

describe('Gesamtzahl', () => {
  it('zählt nur Quellen, die eine Zahl verraten', async () => {
    const reg = createRegistry([
      src('audius', 10),
      src('jamendo', 10, { countTracks: async () => 41250 }),
      src('archive', 10, { countTracks: async () => 8750 }),
    ]);
    const c = await countCatalog(reg, 'Drill', { isEnabled: () => true });
    expect(c).toEqual({
      total: 50000,
      counted: ['jamendo', 'archive'],
      uncounted: ['audius'],
      youtubePlaylists: 0,
    });
  });
});

describe('YouTube im Katalog', () => {
  it('blättert große Playlists seitenweise durch und zählt ihre Videos', async () => {
    const pages: Record<string, { tracks: ReturnType<typeof track>[]; next?: string }> = {
      'A:': { tracks: [track('a1', { sourceId: 'youtube' })], next: 'p2' },
      'A:p2': { tracks: [track('a2', { sourceId: 'youtube' })] },
      'B:': { tracks: [track('b1', { sourceId: 'youtube' })] },
    };
    const yt = Object.assign(src('youtube', 0, { costlySearch: true }), {
      findPlaylists: async () => [
        { id: 'B', title: 'klein', count: 300 },
        { id: 'A', title: 'groß', count: 5000 },
      ],
      playlistPage: async (id: string, token?: string) =>
        pages[`${id}:${token ?? ''}`] ?? { tracks: [] },
    });
    const reg = createRegistry([yt]);
    const opts = { isEnabled: () => true };
    const ids: string[] = [];
    for (let page = 0; page < 4; page++)
      ids.push(...(await loadCatalogPage(reg, 'Phonk', page, opts)).tracks.map((t) => t.id));
    expect(ids).toEqual(['a1', 'a2', 'b1']);
    const c = await countCatalog(reg, 'Phonk', opts);
    expect(c.total).toBe(5300);
    expect(c.youtubePlaylists).toBe(2);
  });
});
