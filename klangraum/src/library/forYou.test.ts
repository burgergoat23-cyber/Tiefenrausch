import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createCache } from '../storage/cache';
import {
  emptyResult,
  trackSchema,
  type MusicSource,
  type Playlist,
  type SourceId,
  type Track,
} from '../sources/types';
import { track } from '../test/fixtures';
import { loadForYou, roundRobin } from './forYou';

function source(
  id: SourceId,
  make: (q: string) => Track[],
  playlists: (q: string) => Playlist[] = () => [],
): MusicSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    id,
    name: id,
    needsLogin: false,
    playbackMode: id === 'youtube' ? 'external' : 'url',
    canUseWebAudio: false,
    allowsOfflineCache: false,
    isAvailable: async () => true,
    getTrack: async (tid) => track(tid),
    search: vi.fn(async (q: string, opts?: { type?: string }) => {
      calls.push(`${opts?.type ?? 'track'}:${q}`);
      return opts?.type === 'playlist'
        ? { ...emptyResult(), playlists: playlists(q) }
        : { ...emptyResult(), tracks: make(q) };
    }),
    calls,
  };
}

const t = (id: string, sourceId: SourceId = 'youtube', extra: Partial<Track> = {}) =>
  track(id, { sourceId, ...extra });

describe('Für dich', () => {
  it('mischt abwechselnd aus jedem Künstler und dem Genre, ohne Doppelte', () => {
    const mix = roundRobin(
      [[t('a1'), t('a2'), t('a3')], [t('b1'), t('a1')], [t('g1', 'audius')]],
      10,
    );
    expect(mix.map((x) => x.id)).toEqual(['a1', 'b1', 'g1', 'a2', 'a3']);
    expect(roundRobin([[t('a'), t('b'), t('c')]], 2)).toHaveLength(2);
  });

  it('Künstler über YouTube, Genre über Audius und Radio', async () => {
    const youtube = source('youtube', (q) => [t(`${q}-1`), t(`${q}-2`)]);
    const audius = source('audius', (q) => [t(`${q}-indie`, 'audius')]);
    const radio = source('radio', (q) => [t(`${q}-fm`, 'radio', { live: true })]);
    const res = await loadForYou(
      ['King Von', 'YNW Melly'],
      ['Drill'],
      { youtube, audius, radio },
      createCache(localStorage),
    );
    expect(youtube.calls).toEqual(['track:King Von', 'track:YNW Melly', 'playlist:Drill']);
    expect(audius.calls).toEqual(['track:Drill']);
    expect(res.mix.map((x) => x.id)).toEqual([
      'King Von-1',
      'YNW Melly-1',
      'Drill-indie',
      'King Von-2',
      'YNW Melly-2',
    ]);
    expect(res.stations.map((x) => x.id)).toEqual(['Drill-fm']);
    expect(res.artistsNeedYouTube).toBe(false);
  });

  it('merkt sich YouTube-Ergebnisse einen Tag lang (spart Kontingent)', async () => {
    const youtube = source('youtube', (q) => [t(`${q}-1`)]);
    const cache = createCache(localStorage);
    await loadForYou(['King Von'], [], { youtube }, cache);
    await loadForYou(['King Von'], [], { youtube }, cache);
    expect(youtube.calls).toEqual(['track:King Von']);
  });

  it('Drill-Playlists von YouTube, ebenfalls einen Tag gemerkt', async () => {
    const youtube = source(
      'youtube',
      () => [],
      (q) => [{ id: `PL-${q}`, sourceId: 'youtube', title: `${q} Mix`, owner: 'Kanal' }],
    );
    const cache = createCache(localStorage);
    const first = await loadForYou([], ['Drill', 'UK Drill'], { youtube }, cache);
    expect(first.playlists.map((p) => p.title)).toEqual(['Drill Mix', 'UK Drill Mix']);
    await loadForYou([], ['Drill', 'UK Drill'], { youtube }, cache);
    expect(youtube.calls).toEqual(['playlist:Drill', 'playlist:UK Drill']);
  });

  it('bis zu 25 Songs pro Künstler', async () => {
    const youtube = source('youtube', (q) => Array.from({ length: 30 }, (_, i) => t(`${q}-${i}`)));
    const res = await loadForYou(['A'], [], { youtube }, createCache(null));
    expect(youtube.search).toHaveBeenCalledWith('A', { type: 'track', limit: 25 });
    expect(res.mix.length).toBe(30); // die Quelle bestimmt, wir schneiden erst beim Mix-Maximum ab
  });

  it('ohne YouTube: Hinweis statt Fehler, Genre geht trotzdem', async () => {
    const audius = source('audius', () => [t('x', 'audius')]);
    const res = await loadForYou(['King Von'], ['Drill'], { audius }, createCache(null));
    expect(res.artistsNeedYouTube).toBe(true);
    expect(res.mix.map((x) => x.id)).toEqual(['x']);
  });

  it('fällt eine Quelle aus, kommt der Rest trotzdem', async () => {
    const youtube = source('youtube', () => {
      throw new Error('Kontingent');
    });
    const audius = source('audius', () => [t('x', 'audius')]);
    const res = await loadForYou(['King Von'], ['Drill'], { youtube, audius }, createCache(null));
    expect(res.mix.map((x) => x.id)).toEqual(['x']);
    expect(res.failed).toEqual(['youtube']);
  });
});

describe('Zwischenspeicher', () => {
  const tracks = z.array(trackSchema);

  it('läuft ab und verwirft kaputte Einträge', () => {
    let now = 1000;
    const cache = createCache(localStorage, () => now);
    cache.set('k', [t('a')], 500);
    expect(cache.get('k', tracks)?.map((x) => x.id)).toEqual(['a']);
    now = 2000;
    expect(cache.get('k', tracks)).toBeNull();
    localStorage.setItem('klangraum.cache.kaputt', '{"until":99999999999999,"value":[{"id":1}]}');
    expect(cache.get('kaputt', tracks)).toBeNull();
  });
});
