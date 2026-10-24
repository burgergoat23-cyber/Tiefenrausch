import type { Track } from '../sources/types';
import { currentItem } from './queue';
import type { PlayerEngine, PlayerState } from './engine';

type Action =
  | 'play'
  | 'pause'
  | 'previoustrack'
  | 'nexttrack'
  | 'seekto'
  | 'seekbackward'
  | 'seekforward'
  | 'stop';

/** Der Teil von navigator.mediaSession, den wir brauchen (für Tests austauschbar) */
export interface MediaSessionLike {
  metadata: MediaMetadata | null;
  playbackState: MediaSessionPlaybackState;
  setActionHandler(
    action: Action,
    handler: ((details: MediaSessionActionDetails) => void) | null,
  ): void;
  setPositionState?(state?: MediaPositionState): void;
}

export type MetadataFactory = (init: MediaMetadataInit) => MediaMetadata;

const SKIP_SECONDS = 10;

/**
 * Verbindet die Engine mit dem Sperrbildschirm, Kopfhörer-Tasten und der Mediensteuerung des Systems.
 */
export function connectMediaSession(
  engine: PlayerEngine,
  session: MediaSessionLike | null = typeof navigator !== 'undefined' && 'mediaSession' in navigator
    ? (navigator.mediaSession as MediaSessionLike)
    : null,
  makeMetadata: MetadataFactory | null = typeof MediaMetadata !== 'undefined'
    ? (init) => new MediaMetadata(init)
    : null,
): () => void {
  if (!session) return () => {};

  const handlers: Partial<Record<Action, (d: MediaSessionActionDetails) => void>> = {
    play: () => void engine.play(),
    pause: () => engine.pause(),
    stop: () => engine.pause(),
    previoustrack: () => engine.prev(),
    nexttrack: () => engine.next(),
    seekto: (d) => {
      if (typeof d.seekTime === 'number') engine.seek(d.seekTime * 1000);
    },
    seekbackward: (d) =>
      engine.seek(engine.state.positionMs - (d.seekOffset ?? SKIP_SECONDS) * 1000),
    seekforward: (d) =>
      engine.seek(engine.state.positionMs + (d.seekOffset ?? SKIP_SECONDS) * 1000),
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      session.setActionHandler(action as Action, handler ?? null);
    } catch {
      // Manche Browser kennen nicht jede Aktion – das ist in Ordnung
    }
  }

  let lastTrack: Track | null | undefined;
  const update = (s: PlayerState) => {
    const track = currentItem(s.queue)?.track ?? null;
    if (track !== lastTrack) {
      lastTrack = track;
      if (track && makeMetadata) {
        session.metadata = makeMetadata({
          title: track.title,
          artist: track.artists.join(', '),
          album: track.album ?? '',
          artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: '480x480' }] : [],
        });
      } else if (!track) {
        session.metadata = null;
      }
    }
    session.playbackState =
      s.status === 'playing' || s.status === 'loading'
        ? 'playing'
        : s.status === 'paused'
          ? 'paused'
          : 'none';
    if (session.setPositionState && s.durationMs > 0) {
      try {
        session.setPositionState({
          duration: s.durationMs / 1000,
          position: Math.min(s.positionMs, s.durationMs) / 1000,
          playbackRate: 1,
        });
      } catch {
        // ungültige Werte während des Ladens – beim nächsten Update klappt es
      }
    }
  };
  update(engine.state);
  const unsub = engine.store.subscribe((s, prev) => {
    if (
      s.queue !== prev.queue ||
      s.status !== prev.status ||
      s.durationMs !== prev.durationMs ||
      Math.abs(s.positionMs - prev.positionMs) > 900
    ) {
      update(s);
    }
  });
  return () => {
    unsub();
    for (const action of Object.keys(handlers)) {
      try {
        session.setActionHandler(action as Action, null);
      } catch {
        // egal
      }
    }
  };
}
