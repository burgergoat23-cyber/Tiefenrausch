import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { PlayerEngine, PlayerState } from '../player/engine';
import type { SourceRegistry } from '../sources/registry';

export interface AppServices {
  player: PlayerEngine;
  sources: SourceRegistry;
}

/** Stellt Player und Quellen für alle Komponenten bereit (in Tests austauschbar) */
export const ServicesContext = createContext<AppServices | null>(null);

function useServices(): AppServices {
  const s = useContext(ServicesContext);
  if (!s) throw new Error('ServicesContext fehlt');
  return s;
}

/** Die Abspiel-Engine – die Oberfläche steuert Musik nur hierüber. */
export function usePlayer(): PlayerEngine {
  return useServices().player;
}

/** Liest einen Teil des Player-Zustands; die Komponente aktualisiert sich nur, wenn sich dieser Teil ändert. */
export function usePlayerState<T>(selector: (s: PlayerState) => T): T {
  return useStore(useServices().player.store, selector);
}

export function useSources(): SourceRegistry {
  return useServices().sources;
}
