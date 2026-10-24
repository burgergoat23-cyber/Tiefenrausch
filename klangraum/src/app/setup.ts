import { applyTheme, findTheme, withAccent } from '../customize/themes';
import { translate } from '../i18n';
import { PlayerEngine, type PlayerNotice } from '../player/engine';
import { coverFor, createCoverResolver, setCoverResolver, useCovers } from '../library/covers';
import { connectMediaSession } from '../player/mediaSession';
import { createCache } from '../storage/cache';
import { HtmlAudioOutput } from '../player/output';
import { YouTubeOutput } from '../player/youtubeOutput';
import { loadPlayerState, persistPlayer } from '../player/persist';
import { sourceName } from '../sources/names';
import { createDefaultRegistry } from '../sources/registry';
import { safeLocalStorage } from '../storage/settings';
import type { AppServices } from './context';
import { useSettings } from './settingsStore';
import { useToasts } from './toastStore';
import { connectLibrary, idbPersistence, useLibrary } from '../library/libraryStore';
import { trackPlays } from '../library/playTracker';
import { autoplayProvider } from '../library/useSongRadio';
import { connectSleepTimer } from '../player/sleepTimer';

export function isAppleTouchDevice(): boolean {
  const ua = navigator.userAgent;
  return (
    /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function showNotice(n: PlayerNotice) {
  const toast = useToasts.getState().show;
  if (n.kind === 'sourceError')
    toast(`errors.${n.errorKind}`, { source: sourceName(n.sourceId) }, 'error');
  else if (n.kind === 'trackError')
    toast(n.skipped ? 'errors.trackSkipped' : 'errors.trackFailed', { title: n.title }, 'error');
  else if (n.kind === 'sleep') toast('sleep.stopped');
  else toast('errors.unsupported', { source: sourceName(n.sourceId) }, 'error');
}

/** Startet alles, was die App braucht: Theme, Quellen, Player, Sperrbildschirm-Steuerung */
export function setupApp(): AppServices {
  const storage = safeLocalStorage();

  // Theme + Sprache sofort anwenden und bei Änderungen nachziehen
  const applySettings = () => {
    const s = useSettings.getState().settings;
    applyTheme(withAccent(findTheme(s.themeId), s.accentColor));
    document.documentElement.lang = s.language;
    document.title = translate(s.language, 'app.name');
  };
  applySettings();
  useSettings.subscribe((s, prev) => {
    if (
      s.settings.themeId !== prev.settings.themeId ||
      s.settings.accentColor !== prev.settings.accentColor ||
      s.settings.language !== prev.settings.language
    ) {
      applySettings();
    }
  });

  const sources = createDefaultRegistry({
    jamendoClientId: () => useSettings.getState().settings.jamendoClientId,
    youtubeApiKey: () => useSettings.getState().settings.youtubeApiKey,
  });
  const output = new HtmlAudioOutput();
  // Der YouTube-Player wird erst gebaut, wenn wirklich ein YouTube-Video läuft
  let youtube: YouTubeOutput | null = null;
  const player = new PlayerEngine(
    {
      getSource: (id) => sources.get(id),
      output,
      getExternalOutput: (source) =>
        source.id === 'youtube' ? (youtube ??= new YouTubeOutput()) : undefined,
      onNotice: showNotice,
      onQueueEnd: autoplayProvider(sources),
    },
    loadPlayerState(storage) ?? {},
  );
  persistPlayer(player, storage);
  void connectLibrary(idbPersistence());
  trackPlays(
    player.store,
    (track, ms) => useLibrary.getState().recordPlay(track, ms),
    (track, ms) => useLibrary.getState().addListenTime(track, ms),
  );
  connectSleepTimer(player, () => showNotice({ kind: 'sleep' }));
  setCoverResolver(createCoverResolver({ cache: createCache(storage) }));
  connectMediaSession(player, undefined, undefined, {
    get: coverFor,
    subscribe: (cb) => useCovers.subscribe(cb),
  });

  // iPhone/iPad: Audio beim allerersten Tippen freischalten
  if (isAppleTouchDevice()) {
    const unlock = () => {
      player.unlock();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  return { player, sources };
}
