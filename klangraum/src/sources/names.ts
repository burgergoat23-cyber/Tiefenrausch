import type { SourceId } from './types';

/** Anzeigenamen und Kürzel für das kleine Quellen-Symbol */
export const SOURCE_INFO: Record<SourceId, { name: string; short: string }> = {
  audius: { name: 'Audius', short: 'AU' },
  jamendo: { name: 'Jamendo', short: 'JA' },
  archive: { name: 'Internet Archive', short: 'IA' },
  radio: { name: 'Internetradio', short: 'FM' },
  local: { name: 'Eigene Dateien', short: '♪' },
  spotify: { name: 'Spotify', short: 'SP' },
};

export function sourceName(id: SourceId): string {
  return SOURCE_INFO[id].name;
}
