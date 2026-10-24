import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useLibrary } from '../library/libraryStore';
import { usePlayerView } from '../player/ui/playerView';
import { usePlayer } from './context';
import { useDialogs } from './dialogStore';
import { useToasts } from './toastStore';

export const SEEK_STEP_MS = 10_000;

export interface Shortcut {
  keys: string[];
  label:
    | 'playPause'
    | 'seek'
    | 'skip'
    | 'volume'
    | 'mute'
    | 'shuffle'
    | 'repeat'
    | 'like'
    | 'lyrics'
    | 'search'
    | 'help';
}

/** Für die Hilfe-Übersicht (Fragezeichen-Taste) */
export const SHORTCUTS: Shortcut[] = [
  { keys: ['Leertaste', 'K'], label: 'playPause' },
  { keys: ['←', '→'], label: 'seek' },
  { keys: ['Shift + ←', 'Shift + →'], label: 'skip' },
  { keys: ['↑', '↓'], label: 'volume' },
  { keys: ['M'], label: 'mute' },
  { keys: ['S'], label: 'shuffle' },
  { keys: ['R'], label: 'repeat' },
  { keys: ['L'], label: 'like' },
  { keys: ['T'], label: 'lyrics' },
  { keys: ['/'], label: 'search' },
  { keys: ['?'], label: 'help' },
];

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLInputElement && el.type !== 'range' && el.type !== 'checkbox')
  );
}

/** Tastenkürzel am PC (wie bei YouTube/Spotify). Beim Tippen in Feldern sind sie aus. */
export function useKeyboardShortcuts() {
  const player = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target) || useDialogs.getState().current) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const onControl = !!target?.closest('button, a, [role="slider"], input, [role="menu"]');
      const onSlider = target instanceof HTMLInputElement && target.type === 'range';
      if (target?.closest('[aria-roledescription="sortable"]')) return;
      const track = player.current;
      let handled = true;
      switch (e.key) {
        case ' ':
          if (onControl) return; // Leertaste drückt sonst den Knopf mit Fokus
          player.toggle();
          break;
        case 'k':
        case 'K':
          player.toggle();
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          // Pfeile auf Knöpfen gehören dem Knopf (Menüs, Verschieben per Tastatur)
          if (onSlider || onControl) return;
          const dir = e.key === 'ArrowLeft' ? -1 : 1;
          if (e.shiftKey) {
            if (dir < 0) player.prev();
            else player.next();
          } else player.seek(player.state.positionMs + dir * SEEK_STEP_MS);
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown':
          if (onSlider || onControl || !track) return;
          player.setVolume(player.state.volume + (e.key === 'ArrowUp' ? 0.1 : -0.1));
          break;
        case 'm':
        case 'M':
          player.toggleMute();
          break;
        case 's':
        case 'S':
          player.toggleShuffle();
          break;
        case 'r':
        case 'R':
          player.cycleRepeat();
          break;
        case 'l':
        case 'L':
          if (!track) return;
          useToasts
            .getState()
            .show(
              useLibrary.getState().toggleLike(track)
                ? 'library.likedToast'
                : 'library.unlikedToast',
              { title: track.title },
            );
          break;
        case 't':
        case 'T':
          if (!track) return;
          usePlayerView.getState().setLyrics(true);
          navigate('/player');
          break;
        case '/':
          navigate('/suche');
          requestAnimationFrame(() => document.getElementById('kr-search')?.focus());
          break;
        case '?':
          useDialogs.getState().open({ kind: 'shortcuts' });
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, navigate]);
}
