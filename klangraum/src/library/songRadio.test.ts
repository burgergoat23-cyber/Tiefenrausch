import { describe, expect, it, vi } from 'vitest';
import { createRegistry } from '../sources/registry';
import type { MusicSource, SourceId } from '../sources/types';
import { seededRandom, track } from '../test/fixtures';
import { similarTracks } from './songRadio';

function source(
  id: SourceId,
  byArtist: Record<string, string[]>,
  extra: Partial<MusicSource> = {},
) {
  const search = vi.fn(async (q: string) => ({
    tracks: (byArtist[q] ?? []).map((tid) => track(tid, { sourceId: id, artists: [q] })),
    albums: [],
    artists: [],
    playlists: [],
  }));
  const s: MusicSource = {
    id,
    name: id,
    needsLogin: false,
    playbackMode: 'url',
    canUseWebAudio: true,
    allowsOfflineCache: false,
    isAvailable: async () => true,
    search,
    getTrack: async (t) => track(t),
    ...extra,
  };
  return { s, search };
}

describe('Song-Radio', () => {
  it('mischt Künstler und Lieblingskünstler, ohne den Song selbst und schon Gehörtes', async () => {
    const a = source('audius', { 'King Von': ['v1', 'v2', 'seed'], 'Lil Durk': ['d1', 'd2'] });
    const yt = source('youtube', { 'King Von': ['y1'] }, { costlySearch: true });
    const seed = track('seed', { artists: ['King Von'] });
    const out = await similarTracks(seed, createRegistry([a.s, yt.s]), {
      isEnabled: () => true,
      favoriteArtists: ['Lil Durk', 'King Von'],
      exclude: new Set(['audius:v2']),
      random: seededRandom(3),
    });
    const ids = out.map((t) => t.id).sort();
    expect(ids).toEqual(['d1', 'd2', 'v1']);
    expect(yt.search).not.toHaveBeenCalled();
  });

  it('YouTube nur wenn erlaubt und nur für den Künstler des Songs', async () => {
    const yt = source('youtube', { 'King Von': ['y1'] }, { costlySearch: true });
    const seed = track('seed', { artists: ['King Von'] });
    const out = await similarTracks(seed, createRegistry([yt.s]), {
      isEnabled: () => true,
      favoriteArtists: ['Lil Durk'],
      exclude: new Set(),
      allowCostly: true,
    });
    expect(out.map((t) => t.id)).toEqual(['y1']);
    expect(yt.search).toHaveBeenCalledTimes(1);
  });
});
