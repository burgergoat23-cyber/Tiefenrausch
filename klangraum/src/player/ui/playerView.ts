import { create } from 'zustand';

/** Was der Vollbild-Player zeigt: Cover oder Songtext */
export const usePlayerView = create<{ lyrics: boolean; setLyrics(on: boolean): void }>()((set) => ({
  lyrics: false,
  setLyrics: (lyrics) => set({ lyrics }),
}));
