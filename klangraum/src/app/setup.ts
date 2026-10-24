import { applyTheme, findTheme } from '../customize/themes';
import { translate } from '../i18n';
import { PlayerEngine, type PlayerNotice } from '../player/engine';
import { connectMediaSession } from '../player/mediaSession';
import { HtmlAudioOutput } from '../player/output';
import { YouTubeOutput } from '../player/youtubeOutput';
import { loadPlayerState, persistPlayer } from '../player/persist';
import { sourceName } from '../sources/names';
import { createDefaultRegistry } from '../sources/registry';
import { safeLocalStorage } from '../storage/settings';
import type { AppServices } from './context';
import { useSettings } from './settingsStore';
import { useToasts } from './toastStore';

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
  else toast('errors.unsupported', { source: sourceName(n.sourceId) }, 'error');
}

/** Startet alles, was die App braucht: Theme, Quellen, Player, Sperrbildschirm-Steuerung */
export function setupApp(): AppServices {
  const storage = safeLocalStorage();

  // Theme + Sprache sofort anwenden und bei Änderungen nachziehen
  const applySettings = () => {
    const s = useSettings.getState().settings;
    applyTheme(findTheme(s.themeId));
    document.documentElement.lang = s.language;
    document.title = translate(s.language, 'app.name');
  };
  applySettings();
  useSettings.subscribe((s, prev) => {
    if (
      s.settings.themeId !== prev.settings.themeId ||
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
    },
    loadPlayerState(storage) ?? {},
  );
  persistPlayer(player, storage);
  connectMediaSession(player);

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
