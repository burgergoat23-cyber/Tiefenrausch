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
  /** iPhone/iPad: Video läuft nur stumm – ein Tipp auf „Ton an“ schaltet den Ton ein */
  needsUnmute: boolean;
  /** Browser lässt das Video gar nicht von selbst starten → Hinweis „einmal aufs Video tippen“ */
  needsTap: boolean;
  unmute: (() => void) | null;
}

export const useVideoDock = create<VideoDockStore>()((set) => ({
  host: null,
  fullSlot: null,
  setHost: (host) => set({ host }),
  setFullSlot: (fullSlot) => set({ fullSlot }),
  needsUnmute: false,
  needsTap: false,
  unmute: null,
}));
