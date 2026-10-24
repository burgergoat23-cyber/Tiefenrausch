import { AudiusSource } from './audius';
import { JamendoSource } from './jamendo';
import type { MusicSource, SourceId } from './types';

export interface SourceRegistry {
  all: MusicSource[];
  get(id: SourceId): MusicSource | undefined;
}

export function createRegistry(list: MusicSource[]): SourceRegistry {
  const byId = new Map(list.map((s) => [s.id, s]));
  return { all: list, get: (id) => byId.get(id) };
}

/** Die echten Quellen der App. Weitere Quellen (Spotify, eigene Dateien …) folgen in späteren Phasen. */
export function createDefaultRegistry(getJamendoClientId: () => string): SourceRegistry {
  return createRegistry([
    new AudiusSource(),
    new JamendoSource({
      getClientId: () => getJamendoClientId() || import.meta.env.VITE_JAMENDO_CLIENT_ID || '',
    }),
  ]);
}
