import { usePlayer, useSources } from '../app/context';
import { useSettings } from '../app/settingsStore';
import { useToasts } from '../app/toastStore';
import type { SourceRegistry } from '../sources/registry';
import { trackKey, type SourceId, type Track } from '../sources/types';
import { recentTracks } from './library';
import { useLibrary } from './libraryStore';
import { similarTracks } from './songRadio';

/** Gemeinsame Optionen für Song-Radio und Autoplay */
export function radioOptions(extraExclude: Track[] = [], allowCostly = false) {
  const settings = useSettings.getState().settings;
  const recent = recentTracks(useLibrary.getState().data, 150).map((r) => trackKey(r.track));
  return {
    isEnabled: (s: { id: SourceId }) => settings.sources[s.id] ?? true,
    favoriteArtists: settings.favoriteArtists,
    exclude: new Set([...recent, ...extraExclude.map(trackKey)]),
    allowCostly,
  };
}

/** Autoplay für die Engine: nur wenn in den Einstellungen an */
export function autoplayProvider(registry: SourceRegistry) {
  return async (last: Track, played: Track[]): Promise<Track[]> => {
    if (!useSettings.getState().settings.autoplay) return [];
    const tracks = await similarTracks(last, registry, {
      ...radioOptions(played, last.sourceId === 'youtube'),
      limit: 20,
    });
    if (tracks.length > 0) useToasts.getState().show('songRadio.autoplay');
    return tracks;
  };
}

/** „Song-Radio starten“: dieser Song + ähnliche */
export function useSongRadio() {
  const player = usePlayer();
  const registry = useSources();
  const toast = useToasts((s) => s.show);
  return async (track: Track) => {
    toast('songRadio.starting', { title: track.title });
    const more = await similarTracks(track, registry, radioOptions([], true)).catch(() => []);
    if (more.length === 0) {
      toast('songRadio.nothing', undefined, 'error');
      return;
    }
    player.playTracks([track, ...more]);
  };
}
