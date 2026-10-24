import { describe, expect, it } from 'vitest';
import { SourceError, type MusicSource, type SourceId, type Track } from '../sources/types';
import { seededRandom, track, tracks } from '../test/fixtures';
import { PlayerEngine, type PlayerNotice } from './engine';
import { connectMediaSession, type MediaSessionLike } from './mediaSession';
import type { OutputListener, PlaybackOutput } from './output';
import { loadPlayerState, persistPlayer, PLAYER_STORAGE_KEY } from './persist';
import { currentItem } from './queue';

/** Nachgebaute Audio-Ausgabe: merkt sich, was geladen/gespielt wurde */
class FakeOutput implements PlaybackOutput {
  readonly kind = 'url' as const;
  listener!: OutputListener;
  loaded: string[] = [];
  playing = false;
  volume = 1;
  muted = false;
  seekedTo: number | null = null;
  playImpl: () => Promise<void> = async () => {
    this.playing = true;
    this.listener.onPlaying();
  };
  setListener(l: OutputListener) {
    this.listener = l;
  }
  load(url: string) {
    this.loaded.push(url);
    this.playing = false;
  }
  play() {
    return this.playImpl();
  }
  pause() {
    this.playing = false;
    this.listener.onPause();
  }
  seek(sec: number) {
    this.seekedTo = sec;
  }
  setVolume(v: number) {
    this.volume = v;
  }
  setMuted(m: boolean) {
    this.muted = m;
  }
  stop() {
    this.playing = false;
  }
  unlock() {}
  canSetVolume() {
    return true;
  }
}

function fakeSource(id: SourceId = 'audius', overrides: Partial<MusicSource> = {}): MusicSource {
  return {
    id,
    name: id,
    needsLogin: false,
    playbackMode: 'url',
    canUseWebAudio: true,
    allowsOfflineCache: false,
    isAvailable: async () => true,
    search: async () => ({ tracks: [], albums: [], artists: [], playlists: [] }),
    getTrack: async (tid) => track(tid),
    getStreamUrl: async (t: Track) => `https://stream.test/${t.sourceId}/${t.id}`,
    ...overrides,
  };
}

function setup(
  sources: MusicSource[] = [fakeSource('audius'), fakeSource('jamendo')],
  initial = {},
) {
  const output = new FakeOutput();
  const notices: PlayerNotice[] = [];
  const engine = new PlayerEngine(
    {
      getSource: (id) => sources.find((s) => s.id === id),
      output,
      random: seededRandom(1),
      onNotice: (n) => notices.push(n),
    },
    initial,
  );
  return { engine, output, notices };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('PlayerEngine', () => {
  it('spielt eine Liste ab dem gewählten Song', async () => {
    const { engine, output } = setup();
    engine.playTracks(tracks('a', 'b', 'c'), 1);
    await flush();
    expect(output.loaded).toEqual(['https://stream.test/audius/b']);
    expect(engine.state.status).toBe('playing');
    expect(engine.current?.id).toBe('b');
  });

  it('spielt nach Songende automatisch den nächsten', async () => {
    const { engine, output } = setup();
    engine.playTracks(tracks('a', 'b'));
    await flush();
    output.listener.onEnded();
    await flush();
    expect(engine.current?.id).toBe('b');
    expect(output.loaded.at(-1)).toBe('https://stream.test/audius/b');
  });

  it('bleibt am Ende der Warteschlange pausiert stehen', async () => {
    const { engine, output } = setup();
    engine.playTracks(tracks('a'));
    await flush();
    output.listener.onEnded();
    expect(engine.state.status).toBe('paused');
    expect(engine.current?.id).toBe('a');
    expect(output.seekedTo).toBe(0);
  });

  it('Wiederholen: einer – startet denselben Song neu', async () => {
    const { engine, output } = setup();
    engine.playTracks(tracks('a', 'b'));
    engine.cycleRepeat();
    engine.cycleRepeat();
    expect(engine.state.queue.repeat).toBe('one');
    await flush();
    output.listener.onEnded();
    await flush();
    expect(engine.current?.id).toBe('a');
    expect(output.loaded).toHaveLength(1);
    expect(output.seekedTo).toBe(0);
  });

  it('Übergang zwischen Quellen: jeder Song fragt seine eigene Quelle', async () => {
    const { engine, output } = setup();
    engine.playTracks([track('a'), track('b', { sourceId: 'jamendo' }), track('c')]);
    await flush();
    engine.next();
    await flush();
    engine.next();
    await flush();
    expect(output.loaded).toEqual([
      'https://stream.test/audius/a',
      'https://stream.test/jamendo/b',
      'https://stream.test/audius/c',
    ]);
  });

  it('Zurück-Knopf: nach 3 Sekunden an den Anfang, sonst vorheriger Song', async () => {
    const { engine, output } = setup();
    engine.playTracks(tracks('a', 'b'), 1);
    await flush();
    output.listener.onTime(10, 180);
    engine.prev();
    expect(engine.current?.id).toBe('b');
    expect(output.seekedTo).toBe(0);
    output.listener.onTime(1, 180);
    engine.prev();
    await flush();
    expect(engine.current?.id).toBe('a');
  });

  it('überspringt kaputte Songs, aber höchstens dreimal hintereinander', async () => {
    const { engine, output, notices } = setup();
    engine.playTracks(tracks('a', 'b', 'c', 'd', 'e'));
    output.playImpl = async () => {}; // spielt nie wirklich los
    await flush();
    output.listener.onError(4);
    await flush();
    expect(engine.current?.id).toBe('b');
    output.listener.onError(4);
    await flush();
    output.listener.onError(4);
    await flush();
    expect(engine.current?.id).toBe('c');
    expect(engine.state.status).toBe('paused');
    expect(notices.filter((n) => n.kind === 'trackError')).toHaveLength(3);
    expect(notices.at(-1)).toEqual({ kind: 'trackError', title: 'Song c', skipped: false });
  });

  it('meldet freundlich, wenn eine Quelle nicht antwortet', async () => {
    const broken = fakeSource('audius', {
      getStreamUrl: async () => {
        throw new SourceError('audius', 'network');
      },
    });
    const { engine, notices } = setup([broken]);
    engine.playTracks(tracks('a'));
    await flush();
    expect(notices).toEqual([{ kind: 'sourceError', sourceId: 'audius', errorKind: 'network' }]);
    expect(engine.state.status).toBe('paused');
  });

  it('ignoriert veraltete Ladevorgänge bei schnellem Weiterschalten', async () => {
    let release: (v: string) => void = () => {};
    const slow = fakeSource('audius', {
      getStreamUrl: (t) =>
        t.id === 'a'
          ? new Promise<string>((r) => (release = r))
          : Promise.resolve(`https://stream.test/${t.id}`),
    });
    const { engine, output } = setup([slow]);
    engine.playTracks(tracks('a', 'b'));
    engine.next();
    await flush();
    release('https://stream.test/a-zu-spaet');
    await flush();
    expect(output.loaded).toEqual(['https://stream.test/b']);
    expect(engine.current?.id).toBe('b');
  });

  it('Pause und weiter spielen ohne neu zu laden', async () => {
    const { engine, output } = setup();
    engine.playTracks(tracks('a'));
    await flush();
    engine.pause();
    expect(engine.state.status).toBe('paused');
    await engine.play();
    expect(engine.state.status).toBe('playing');
    expect(output.loaded).toHaveLength(1);
  });

  it('Browser blockiert Autoplay → pausiert statt hängen', async () => {
    const { engine, output } = setup();
    output.playImpl = async () => {
      throw new DOMException('nope', 'NotAllowedError');
    };
    engine.playTracks(tracks('a'));
    await flush();
    expect(engine.state.status).toBe('paused');
  });

  it('Lautstärke und Stumm', () => {
    const { engine, output } = setup();
    engine.setVolume(0.3);
    expect(output.volume).toBe(0.3);
    engine.toggleMute();
    expect(output.muted).toBe(true);
    engine.setVolume(0.5);
    expect(output.muted).toBe(false);
    engine.setVolume(7);
    expect(engine.state.volume).toBe(1);
  });

  it('Als Nächstes in leerer Warteschlange startet sofort', async () => {
    const { engine, output } = setup();
    engine.playNext(tracks('x'));
    await flush();
    expect(output.loaded).toEqual(['https://stream.test/audius/x']);
  });

  it('Entfernen des laufenden Songs spielt den nächsten', async () => {
    const { engine, output } = setup();
    engine.playTracks(tracks('a', 'b', 'c'));
    await flush();
    engine.removeFromQueue(0);
    await flush();
    expect(engine.current?.id).toBe('b');
    expect(output.loaded.at(-1)).toBe('https://stream.test/audius/b');
  });
});

describe('Warteschlange speichern', () => {
  it('speichert und lädt die Warteschlange (nur Anzeige-Infos)', async () => {
    const { engine } = setup();
    persistPlayer(engine, localStorage);
    engine.playTracks(tracks('a', 'b'), 1);
    engine.setVolume(0.4);
    await flush();
    const restored = loadPlayerState(localStorage);
    expect(restored?.queue?.items.map((i) => i.track.id)).toEqual(['a', 'b']);
    expect(restored?.queue?.index).toBe(1);
    expect(restored?.volume).toBe(0.4);

    const again = setup(undefined, restored ?? {});
    expect(again.engine.state.status).toBe('paused');
    expect(again.engine.current?.id).toBe('b');
    await again.engine.play();
    expect(again.output.loaded).toEqual(['https://stream.test/audius/b']);
  });

  it('kaputte gespeicherte Daten werden ignoriert', () => {
    localStorage.setItem(PLAYER_STORAGE_KEY, '{kaputt');
    expect(loadPlayerState(localStorage)).toBeNull();
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ v: 1, items: [{ uid: 'x', track: { id: 'a' } }] }),
    );
    expect(loadPlayerState(localStorage)).toBeNull();
  });

  it('Bild-Adressen müssen http(s) sein', () => {
    const bad = {
      v: 1,
      items: [{ uid: 'x', track: { ...track('a'), artworkUrl: 'javascript:alert(1)' } }],
      index: 0,
      shuffle: false,
      repeat: 'off',
      original: null,
      positionMs: 0,
      volume: 1,
      muted: false,
    };
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(bad));
    expect(loadPlayerState(localStorage)).toBeNull();
  });
});

describe('Media Session (Sperrbildschirm)', () => {
  function fakeSession() {
    const handlers = new Map<string, ((d: MediaSessionActionDetails) => void) | null>();
    const session: MediaSessionLike & { positions: MediaPositionState[] } = {
      metadata: null,
      playbackState: 'none',
      positions: [],
      setActionHandler: (a, h) => void handlers.set(a, h),
      setPositionState(s) {
        if (s) this.positions.push(s);
      },
    };
    return { session, handlers };
  }

  it('zeigt Titel, Künstler, Cover und reagiert auf Tasten', async () => {
    const { engine } = setup();
    const { session, handlers } = fakeSession();
    const made: MediaMetadataInit[] = [];
    connectMediaSession(engine, session, (init) => {
      made.push(init);
      return init as unknown as MediaMetadata;
    });
    engine.playTracks([track('a', { artworkUrl: 'https://img.test/a.jpg' }), track('b')]);
    await flush();
    expect(made.at(-1)).toMatchObject({
      title: 'Song a',
      artist: 'Artist a',
      artwork: [{ src: 'https://img.test/a.jpg', sizes: '480x480' }],
    });
    expect(session.playbackState).toBe('playing');
    handlers.get('nexttrack')?.({ action: 'nexttrack' });
    await flush();
    expect(currentItem(engine.state.queue)?.track.id).toBe('b');
    handlers.get('pause')?.({ action: 'pause' });
    expect(session.playbackState).toBe('paused');
    handlers.get('seekto')?.({ action: 'seekto', seekTime: 42 });
    expect(engine.state.positionMs).toBe(42000);
  });

  it('ohne Media Session (alter Browser) passiert nichts Schlimmes', () => {
    const { engine } = setup();
    const off = connectMediaSession(engine, null, null);
    expect(() => off()).not.toThrow();
  });
});
