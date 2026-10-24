import { openDB } from 'idb';
import { create } from 'zustand';
import { trackKey, type Track } from '../sources/types';
import * as L from './library';

export interface LibraryPersistence {
  load(): Promise<unknown>;
  save(data: L.LibraryData): Promise<void>;
}

const DB_NAME = 'klangraum';
const STORE = 'kv';
const KEY = 'library';

/** Speichert die Bibliothek in IndexedDB (mehr Platz als localStorage, bleibt auf dem Gerät) */
export function idbPersistence(): LibraryPersistence | null {
  if (typeof indexedDB === 'undefined') return null;
  const db = openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    },
  });
  return {
    load: async () => (await db).get(STORE, KEY),
    save: async (data) => {
      await (await db).put(STORE, data, KEY);
    },
  };
}

export interface LibraryStore {
  data: L.LibraryData;
  /** true, sobald die gespeicherte Bibliothek geladen ist */
  ready: boolean;
  toggleLike(track: Track): boolean;
  createPlaylist(name: string, tracks?: Track[]): string;
  renamePlaylist(id: string, name: string): void;
  deletePlaylist(id: string): void;
  addToPlaylist(id: string, tracks: Track[]): number;
  removeFromPlaylist(id: string, index: number): void;
  moveInPlaylist(id: string, from: number, to: number): void;
  recordPlay(track: Track, ms: number): void;
  addListenTime(track: Track, ms: number): void;
  clearHistory(): void;
  importData(incoming: L.LibraryData): void;
}

export const useLibrary = create<LibraryStore>()((set, get) => {
  const update = (fn: (d: L.LibraryData) => L.LibraryData) => set({ data: fn(get().data) });
  return {
    data: L.emptyLibrary(),
    ready: false,
    toggleLike(track) {
      update((d) => L.toggleLike(d, track, Date.now()));
      return L.isLiked(get().data, track);
    },
    createPlaylist(name, tracks = []) {
      const id = L.newPlaylistId();
      update((d) => L.createPlaylist(d, id, name, tracks, Date.now()));
      return id;
    },
    renamePlaylist: (id, name) => update((d) => L.renamePlaylist(d, id, name, Date.now())),
    deletePlaylist: (id) => update((d) => L.deletePlaylist(d, id)),
    addToPlaylist(id, tracks) {
      const r = L.addToPlaylist(get().data, id, tracks, Date.now());
      set({ data: r.lib });
      return r.added;
    },
    removeFromPlaylist: (id, index) =>
      update((d) => L.removeFromPlaylist(d, id, index, Date.now())),
    moveInPlaylist: (id, from, to) => update((d) => L.moveInPlaylist(d, id, from, to, Date.now())),
    recordPlay: (track, ms) => update((d) => L.recordPlay(d, track, ms, Date.now())),
    addListenTime: (track, ms) => update((d) => L.addListenTime(d, track, ms)),
    clearHistory: () => update((d) => L.clearHistory(d)),
    importData: (incoming) => update((d) => L.mergeLibrary(d, incoming)),
  };
});

/** Ist der Song ein Lieblingssong? (Komponente aktualisiert sich nur, wenn sich das ändert) */
export function useIsLiked(track: Track | null | undefined): boolean {
  const k = track ? trackKey(track) : '';
  return useLibrary((s) => !!k && s.data.likes.some((l) => trackKey(l.track) === k));
}

export function usePlaylist(id: string): L.LocalPlaylist | undefined {
  return useLibrary((s) => s.data.playlists.find((p) => p.id === id));
}

const SAVE_DELAY_MS = 400;

/** Lädt die gespeicherte Bibliothek und speichert danach jede Änderung (kurz gesammelt) */
export async function connectLibrary(p: LibraryPersistence | null): Promise<void> {
  if (!p) {
    useLibrary.setState({ ready: true });
    return;
  }
  let stored = L.emptyLibrary();
  try {
    stored = L.parseLibrary(await p.load());
  } catch {
    // Speicher nicht lesbar (z. B. privater Modus) – dann startet die Bibliothek leer
  }
  // Was vor dem Laden schon passiert ist (z. B. ein Herz), geht nicht verloren
  const early = useLibrary.getState().data;
  useLibrary.setState({ data: L.mergeLibrary(stored, early), ready: true });

  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    p.save(useLibrary.getState().data).catch(() => undefined);
  };
  useLibrary.subscribe((s, prev) => {
    if (s.data === prev.data) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  });
  window.addEventListener('pagehide', () => {
    if (timer) flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) flush();
  });
  if (early.likes.length || early.playlists.length || early.plays.length) flush();
}
