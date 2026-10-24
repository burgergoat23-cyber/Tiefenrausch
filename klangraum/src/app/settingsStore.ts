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
    resetAll: () => update(defaultSettings(guessLanguage())),
  };
});
