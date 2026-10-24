import { describe, expect, it } from 'vitest';
import { track, tracks } from '../test/fixtures';
import * as L from './library';

describe('Bibliothek', () => {
  it('Herz an und wieder aus', () => {
    let lib = L.toggleLike(L.emptyLibrary(), track('a'), 1);
    expect(L.isLiked(lib, track('a'))).toBe(true);
    lib = L.toggleLike(lib, track('b'), 2);
    expect(lib.likes.map((l) => l.track.id)).toEqual(['b', 'a']);
    lib = L.toggleLike(lib, track('a'), 3);
    expect(L.isLiked(lib, track('a'))).toBe(false);
  });

  it('Playlist: anlegen, hinzufügen ohne Doppelte, verschieben, entfernen, umbenennen', () => {
    let lib = L.createPlaylist(
      L.emptyLibrary(),
      'pl-1',
      '  Drill   Mix ',
      tracks('a', 'a', 'b'),
      1,
    );
    expect(lib.playlists[0]?.name).toBe('Drill Mix');
    expect(lib.playlists[0]?.tracks.map((t) => t.id)).toEqual(['a', 'b']);
    const r = L.addToPlaylist(lib, 'pl-1', tracks('b', 'c'), 2);
    expect(r.added).toBe(1);
    lib = L.moveInPlaylist(r.lib, 'pl-1', 2, 0, 3);
    expect(lib.playlists[0]?.tracks.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    lib = L.removeFromPlaylist(lib, 'pl-1', 1, 4);
    expect(lib.playlists[0]?.tracks.map((t) => t.id)).toEqual(['c', 'b']);
    lib = L.renamePlaylist(lib, 'pl-1', '   ', 5);
    expect(lib.playlists[0]?.name).toBe('Drill Mix');
    lib = L.renamePlaylist(lib, 'pl-1', 'Neu', 6);
    expect(lib.playlists[0]).toMatchObject({ name: 'Neu', updatedAt: 6 });
    expect(L.deletePlaylist(lib, 'pl-1').playlists).toHaveLength(0);
  });

  it('Verlauf: neueste zuerst, jeder Song einmal, Hörzeit wird addiert', () => {
    let lib = L.emptyLibrary();
    lib = L.recordPlay(lib, track('a'), 30000, 1);
    lib = L.recordPlay(lib, track('b'), 30000, 2);
    lib = L.recordPlay(lib, track('a'), 30000, 3);
    lib = L.addListenTime(lib, track('a'), 60000);
    expect(L.recentTracks(lib).map((r) => r.track.id)).toEqual(['a', 'b']);
    expect(lib.plays.at(-1)?.ms).toBe(90000);
    expect(lib.plays[0]?.ms).toBe(30000);
  });

  it('Verlauf hat eine Obergrenze und räumt alte Song-Infos auf', () => {
    let lib = L.emptyLibrary();
    lib = L.recordPlay(lib, track('alt'), 1000, 0);
    for (let i = 0; i < L.MAX_PLAYS; i++) lib = L.recordPlay(lib, track('neu'), 1000, i + 1);
    expect(lib.plays).toHaveLength(L.MAX_PLAYS);
    expect(Object.keys(lib.known)).toEqual(['audius:neu']);
  });

  it('kaputte Einträge werden beim Laden einzeln verworfen', () => {
    const lib = L.parseLibrary({
      likes: [{ track: track('a'), at: 1 }, { track: { id: 'x' }, at: 2 }, 'quatsch'],
      playlists: [
        {
          id: 'pl-1',
          name: 'Gut',
          createdAt: 1,
          updatedAt: 1,
          tracks: [track('a'), { kaputt: 1 }],
        },
        { id: 'BÖSE ID', name: 'x', createdAt: 1, updatedAt: 1, tracks: [] },
      ],
      plays: [
        { k: 'audius:a', at: 1, ms: 5 },
        { k: 'audius:fehlt', at: 1, ms: 5 },
      ],
      known: { 'audius:a': track('a'), 'audius:b': track('falsch') },
    });
    expect(lib.likes).toHaveLength(1);
    expect(lib.playlists).toHaveLength(1);
    expect(lib.playlists[0]?.tracks).toHaveLength(1);
    expect(lib.plays).toHaveLength(1);
    expect(Object.keys(lib.known)).toEqual(['audius:a']);
    expect(L.parseLibrary('nichts')).toEqual(L.emptyLibrary());
  });

  it('Import führt zusammen, ohne etwas zu verlieren', () => {
    const base = L.toggleLike(
      L.createPlaylist(L.emptyLibrary(), 'pl-a', 'A', [], 1),
      track('a'),
      5,
    );
    const incoming = L.toggleLike(
      L.createPlaylist(L.emptyLibrary(), 'pl-b', 'B', [], 1),
      track('b'),
      9,
    );
    const merged = L.mergeLibrary(base, incoming);
    expect(merged.likes.map((l) => l.track.id)).toEqual(['b', 'a']);
    expect(merged.playlists.map((p) => p.id).sort()).toEqual(['pl-a', 'pl-b']);
  });

  it('Playlist-IDs sind gültig', () => {
    expect(L.playlistIdSchema.safeParse(L.newPlaylistId()).success).toBe(true);
  });
});
