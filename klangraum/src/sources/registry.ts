import { ArchiveSource } from './archive';
import { AudiusSource } from './audius';
import { JamendoSource } from './jamendo';
import { RadioSource } from './radio';
import { YouTubeSource } from './youtube';
import type { MusicSource, SourceId } from './types';

export interface SourceRegistry {
  all: MusicSource[];
  get(id: SourceId): MusicSource | undefined;
}

export function createRegistry(list: MusicSource[]): SourceRegistry {
  const byId = new Map(list.map((s) => [s.id, s]));
  return { all: list, get: (id) => byId.get(id) };
}

/** Ländercode aus der Browser-Sprache, z. B. „de-DE“ → „DE“ (für beliebte Radiosender) */
export function browserCountryCode(): string {
  const lang = typeof navigator !== 'undefined' ? navigator.language : '';
  const region = /-([A-Za-z]{2})$/.exec(lang)?.[1];
  if (region) return region.toUpperCase();
  return lang.toLowerCase().startsWith('de') ? 'DE' : '';
}

export interface SourceKeys {
  jamendoClientId(): string;
  youtubeApiKey(): string;
}

/** Die echten Quellen der App. Weitere Quellen (Spotify, eigene Dateien …) folgen in späteren Phasen. */
export function createDefaultRegistry(keys: SourceKeys): SourceRegistry {
  return createRegistry([
    new AudiusSource(),
    new JamendoSource({
      getClientId: () => keys.jamendoClientId() || import.meta.env.VITE_JAMENDO_CLIENT_ID || '',
    }),
    new ArchiveSource(),
    new RadioSource({ getCountryCode: browserCountryCode }),
    new YouTubeSource({
      getApiKey: () => keys.youtubeApiKey() || import.meta.env.VITE_YOUTUBE_API_KEY || '',
      getRegionCode: browserCountryCode,
    }),
  ]);
}
