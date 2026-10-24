import { create } from 'zustand';
import type { SourceId } from '../sources/types';
import {
  defaultSettings,
  guessLanguage,
  loadSettings,
  safeLocalStorage,
  saveSettings,
  type Settings,
} from '../storage/settings';

const MAX_HISTORY = 10;

export interface SettingsStore {
  settings: Settings;
  setTheme(themeId: string): void;
  setLanguage(language: Settings['language']): void;
  setSourceEnabled(id: SourceId, on: boolean): void;
  setJamendoClientId(id: string): void;
  setYoutubeApiKey(key: string): void;
  addSearch(query: string): void;
  removeSearch(query: string): void;
  clearSearchHistory(): void;
  addFavorite(kind: 'favoriteArtists' | 'favoriteGenres', name: string): void;
  removeFavorite(kind: 'favoriteArtists' | 'favoriteGenres', name: string): void;
  setAutoplay(on: boolean): void;
  setAccentColor(color: string): void;
  setFavorites(artists: string[], genres: string[]): void;
  setPlayerBackdrop(on: boolean): void;
  resetAll(): void;
}

const storage = safeLocalStorage();

export const useSettings = create<SettingsStore>()((set, get) => {
  const update = (patch: Partial<Settings>) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    saveSettings(storage, settings);
  };
  return {
    settings: loadSettings(storage),
    setTheme: (themeId) => update({ themeId }),
    setLanguage: (language) => update({ language }),
    setSourceEnabled: (id, on) => update({ sources: { ...get().settings.sources, [id]: on } }),
    setJamendoClientId: (id) => update({ jamendoClientId: id.trim() }),
    setYoutubeApiKey: (key) => update({ youtubeApiKey: key.trim() }),
    addSearch: (query) => {
      const q = query.trim();
      if (!q) return;
      const rest = get().settings.searchHistory.filter((h) => h.toLowerCase() !== q.toLowerCase());
      update({ searchHistory: [q, ...rest].slice(0, MAX_HISTORY) });
    },
    removeSearch: (query) =>
      update({ searchHistory: get().settings.searchHistory.filter((h) => h !== query) }),
    clearSearchHistory: () => update({ searchHistory: [] }),
    addFavorite: (kind, name) => {
      const v = name.trim().replace(/\s+/g, ' ');
      const max = kind === 'favoriteArtists' ? 20 : 10;
      const list = get().settings[kind];
      if (!v || v.length > 60 || list.length >= max) return;
      if (list.some((x) => x.toLowerCase() === v.toLowerCase())) return;
      update({ [kind]: [...list, v] });
    },
    removeFavorite: (kind, name) =>
      update({ [kind]: get().settings[kind].filter((x) => x !== name) }),
    setAutoplay: (autoplay) => update({ autoplay }),
    setAccentColor: (accentColor) =>
      update({
        accentColor: /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor.toLowerCase() : '',
      }),
    setPlayerBackdrop: (playerBackdrop) => update({ playerBackdrop }),
    setFavorites: (artists, genres) =>
      update({
        favoriteArtists: artists
          .map((a) => a.trim())
          .filter((a) => a && a.length <= 60)
          .slice(0, 20),
        favoriteGenres: genres
          .map((g) => g.trim())
          .filter((g) => g && g.length <= 40)
          .slice(0, 10),
      }),
    resetAll: () => update(defaultSettings(guessLanguage())),
  };
});
