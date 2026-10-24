import { z } from 'zod';
import { trackKey, trackSchema, type Track } from '../sources/types';

/**
 * Deine Bibliothek: Lieblingssongs, eigene Playlists und was du gehört hast.
 * Alles bleibt auf deinem Gerät. Gespeichert werden nur Anzeige-Infos zu Songs, nie Audio.
 * Hier stehen nur reine Funktionen (leicht zu testen); der Store liegt in libraryStore.ts.
 */
export const LIBRARY_VERSION = 1;
export const MAX_LIKES = 5000;
export const MAX_PLAYLISTS = 200;
export const MAX_PLAYLIST_TRACKS = 1000;
export const MAX_PLAYS = 5000;
export const MAX_NAME = 100;

const likeSchema = z.object({ track: trackSchema, at: z.number() });
export type Like = z.infer<typeof likeSchema>;

export const playlistIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

const playlistSchema = z.object({
  id: playlistIdSchema,
  name: z.string().min(1).max(MAX_NAME),
  createdAt: z.number(),
  updatedAt: z.number(),
  tracks: z.array(z.unknown()),
});
export interface LocalPlaylist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tracks: Track[];
}

/** Ein Mal Hören: Song-Schlüssel, Zeitpunkt, gehörte Millisekunden */
const playSchema = z.object({
  k: z.string().max(220),
  at: z.number(),
  ms: z.number().nonnegative(),
});
export type Play = z.infer<typeof playSchema>;

export interface LibraryData {
  version: typeof LIBRARY_VERSION;
  likes: Like[];
  playlists: LocalPlaylist[];
  plays: Play[];
  /** Song-Infos zu den Einträgen in plays (damit der Verlauf ohne Internet angezeigt werden kann) */
  known: Record<string, Track>;
}

export function emptyLibrary(): LibraryData {
  return { version: LIBRARY_VERSION, likes: [], playlists: [], plays: [], known: {} };
}

/** Nur gültige Einträge übernehmen – ein kaputter Eintrag verwirft nicht die ganze Bibliothek */
function validItems<T>(raw: unknown, schema: z.ZodType<T>, max: number): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
    if (out.length >= max) break;
  }
  return out;
}

/** Liest gespeicherte oder importierte Daten vorsichtig ein */
export function parseLibrary(raw: unknown): LibraryData {
  if (!raw || typeof raw !== 'object') return emptyLibrary();
  const o = raw as Record<string, unknown>;
  const ids = new Set<string>();
  const playlists = validItems(o.playlists, playlistSchema, MAX_PLAYLISTS).flatMap((p) => {
    if (ids.has(p.id)) return [];
    ids.add(p.id);
    return [{ ...p, tracks: validItems(p.tracks, trackSchema, MAX_PLAYLIST_TRACKS) }];
  });
  const known: Record<string, Track> = {};
  if (o.known && typeof o.known === 'object') {
    for (const [k, v] of Object.entries(o.known as Record<string, unknown>)) {
      const r = trackSchema.safeParse(v);
      if (r.success && trackKey(r.data) === k) known[k] = r.data;
    }
  }
  const seen = new Set<string>();
  const likes = validItems(o.likes, likeSchema, MAX_LIKES).filter((l) => {
    const k = trackKey(l.track);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const plays = validItems(o.plays, playSchema, MAX_PLAYS).filter((p) => p.k in known);
  return { version: LIBRARY_VERSION, likes, playlists, plays, known };
}

// ---------- Lieblingssongs ----------

export function isLiked(lib: LibraryData, t: Track): boolean {
  const k = trackKey(t);
  return lib.likes.some((l) => trackKey(l.track) === k);
}

export function toggleLike(lib: LibraryData, t: Track, now: number): LibraryData {
  const k = trackKey(t);
  if (isLiked(lib, t)) return { ...lib, likes: lib.likes.filter((l) => trackKey(l.track) !== k) };
  return { ...lib, likes: [{ track: t, at: now }, ...lib.likes].slice(0, MAX_LIKES) };
}

// ---------- Playlists ----------

export function newPlaylistId(random: () => number = Math.random): string {
  return `pl-${Math.floor(random() * 36 ** 8)
    .toString(36)
    .padStart(8, '0')}`;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function uniqueTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const k = trackKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function createPlaylist(
  lib: LibraryData,
  id: string,
  name: string,
  tracks: Track[],
  now: number,
): LibraryData {
  const pl: LocalPlaylist = {
    id,
    name: cleanName(name) || 'Playlist',
    createdAt: now,
    updatedAt: now,
    tracks: uniqueTracks(tracks).slice(0, MAX_PLAYLIST_TRACKS),
  };
  return { ...lib, playlists: [pl, ...lib.playlists].slice(0, MAX_PLAYLISTS) };
}

function updatePlaylist(
  lib: LibraryData,
  id: string,
  now: number,
  fn: (p: LocalPlaylist) => Partial<LocalPlaylist>,
): LibraryData {
  return {
    ...lib,
    playlists: lib.playlists.map((p) => (p.id === id ? { ...p, ...fn(p), updatedAt: now } : p)),
  };
}

export function renamePlaylist(lib: LibraryData, id: string, name: string, now: number) {
  const clean = cleanName(name);
  if (!clean) return lib;
  return updatePlaylist(lib, id, now, () => ({ name: clean }));
}

export function deletePlaylist(lib: LibraryData, id: string): LibraryData {
  return { ...lib, playlists: lib.playlists.filter((p) => p.id !== id) };
}

/** Fügt Songs hinzu, die noch nicht drin sind. Gibt zurück, wie viele neu dazugekommen sind. */
export function addToPlaylist(
  lib: LibraryData,
  id: string,
  tracks: Track[],
  now: number,
): { lib: LibraryData; added: number } {
  const pl = lib.playlists.find((p) => p.id === id);
  if (!pl) return { lib, added: 0 };
  const have = new Set(pl.tracks.map(trackKey));
  const fresh: Track[] = [];
  for (const t of tracks) {
    const k = trackKey(t);
    if (have.has(k)) continue;
    have.add(k);
    fresh.push(t);
  }
  const room = MAX_PLAYLIST_TRACKS - pl.tracks.length;
  const added = fresh.slice(0, Math.max(0, room));
  if (added.length === 0) return { lib, added: 0 };
  return {
    lib: updatePlaylist(lib, id, now, (p) => ({ tracks: [...p.tracks, ...added] })),
    added: added.length,
  };
}

export function removeFromPlaylist(lib: LibraryData, id: string, index: number, now: number) {
  return updatePlaylist(lib, id, now, (p) => ({ tracks: p.tracks.filter((_, i) => i !== index) }));
}

export function moveInPlaylist(
  lib: LibraryData,
  id: string,
  from: number,
  to: number,
  now: number,
): LibraryData {
  return updatePlaylist(lib, id, now, (p) => {
    if (from < 0 || from >= p.tracks.length || to < 0 || to >= p.tracks.length) return {};
    const tracks = [...p.tracks];
    const [item] = tracks.splice(from, 1);
    if (item) tracks.splice(to, 0, item);
    return { tracks };
  });
}

// ---------- Verlauf ----------

export function recordPlay(lib: LibraryData, t: Track, ms: number, now: number): LibraryData {
  const k = trackKey(t);
  let plays = [...lib.plays, { k, at: now, ms: Math.max(0, Math.round(ms)) }];
  let known = { ...lib.known, [k]: t };
  if (plays.length > MAX_PLAYS) {
    plays = plays.slice(plays.length - MAX_PLAYS);
    const used = new Set(plays.map((p) => p.k));
    known = Object.fromEntries(Object.entries(known).filter(([key]) => used.has(key)));
  }
  return { ...lib, plays, known };
}

/** Hörzeit zum letzten Eintrag dieses Songs addieren */
export function addListenTime(lib: LibraryData, t: Track, ms: number): LibraryData {
  const k = trackKey(t);
  for (let i = lib.plays.length - 1; i >= 0; i--) {
    const p = lib.plays[i];
    if (p?.k !== k) continue;
    const plays = [...lib.plays];
    plays[i] = { ...p, ms: p.ms + Math.max(0, Math.round(ms)) };
    return { ...lib, plays };
  }
  return lib;
}

export function clearHistory(lib: LibraryData): LibraryData {
  return { ...lib, plays: [], known: {} };
}

/** Zuletzt gehörte Songs, jeder nur einmal, neueste zuerst */
export function recentTracks(lib: LibraryData, limit = 100): { track: Track; at: number }[] {
  const out: { track: Track; at: number }[] = [];
  const seen = new Set<string>();
  for (let i = lib.plays.length - 1; i >= 0 && out.length < limit; i--) {
    const p = lib.plays[i];
    if (!p || seen.has(p.k)) continue;
    seen.add(p.k);
    const track = lib.known[p.k];
    if (track) out.push({ track, at: p.at });
  }
  return out;
}

// ---------- Import ----------

/** Führt importierte Daten mit den vorhandenen zusammen (nichts geht verloren) */
export function mergeLibrary(base: LibraryData, incoming: LibraryData): LibraryData {
  const likeKeys = new Set(base.likes.map((l) => trackKey(l.track)));
  const likes = [...base.likes, ...incoming.likes.filter((l) => !likeKeys.has(trackKey(l.track)))]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_LIKES);
  const plIds = new Set(base.playlists.map((p) => p.id));
  const playlists = [
    ...base.playlists,
    ...incoming.playlists.filter((p) => !plIds.has(p.id)),
  ].slice(0, MAX_PLAYLISTS);
  const playKeys = new Set(base.plays.map((p) => `${p.k}@${p.at}`));
  const plays = [...base.plays, ...incoming.plays.filter((p) => !playKeys.has(`${p.k}@${p.at}`))]
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_PLAYS);
  const known = { ...incoming.known, ...base.known };
  return parseLibrary({ version: LIBRARY_VERSION, likes, playlists, plays, known });
}
