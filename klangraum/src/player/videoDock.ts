import { create } from 'zustand';

/**
 * Wo das YouTube-Video gerade zu sehen sein soll.
 * Das Video-Fenster selbst (iframe) wird nie im DOM verschoben – sonst lädt es neu.
 * Stattdessen legt es sich genau über einen „Platzhalter“ (Slot): groß im Player oder klein schwebend.
 */
interface VideoDockStore {
  /** Das Element mit dem YouTube-Player (vom YouTubeOutput angelegt) */
  host: HTMLElement | null;
  /** Platzhalter im Vollbild-Player */
  fullSlot: HTMLElement | null;
  setHost(el: HTMLElement | null): void;
  setFullSlot(el: HTMLElement | null): void;
}

export const useVideoDock = create<VideoDockStore>()((set) => ({
  host: null,
  fullSlot: null,
  setHost: (host) => set({ host }),
  setFullSlot: (fullSlot) => set({ fullSlot }),
}));
