import { createStore, type StoreApi } from 'zustand/vanilla';
import type { MusicSource, SourceErrorKind, SourceId, Track } from '../sources/types';
import { SourceError } from '../sources/types';
import type { OutputListener, PlaybackOutput } from './output';
import * as Q from './queue';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface PlayerState {
  queue: Q.QueueState;
  status: PlayerStatus;
  /** Song lädt nach (Netz langsam) */
  buffering: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  muted: boolean;
  /** uid des Eintrags, der gerade in der Ausgabe steckt (null = muss vor dem Abspielen geladen werden) */
  loadedUid: string | null;
}

export type PlayerNotice =
  | { kind: 'sourceError'; sourceId: SourceId; errorKind: SourceErrorKind }
  | { kind: 'trackError'; title: string; skipped: boolean }
  | { kind: 'unsupported'; sourceId: SourceId }
  /** Schlaf-Timer hat angehalten */
  | { kind: 'sleep' };

export interface EngineDeps {
  getSource(id: SourceId): MusicSource | undefined;
  /** Eigenes Audio (für Quellen mit playbackMode 'url') */
  output: PlaybackOutput;
  /** Ausgabe für Quellen, die selbst abspielen (playbackMode 'external', z. B. YouTube-Player) */
  getExternalOutput?(source: MusicSource): PlaybackOutput | undefined;
  random?: Q.Random;
  onNotice?(notice: PlayerNotice): void;
  /** Autoplay: Warteschlange zu Ende → passende Songs zum Weiterspielen (leer = aufhören) */
  onQueueEnd?(last: Track, played: Track[]): Promise<Track[]>;
}

/** Wie oft hintereinander ein kaputter Song übersprungen wird, bevor wir aufhören */
const MAX_ERROR_SKIPS = 3;
/** Zurück-Knopf: nach so vielen ms springt er an den Anfang statt zum vorigen Song */
const PREV_RESTART_MS = 3000;

export function initialPlayerState(): PlayerState {
  return {
    queue: Q.emptyQueue(),
    status: 'idle',
    buffering: false,
    positionMs: 0,
    durationMs: 0,
    volume: 1,
    muted: false,
    loadedUid: null,
  };
}

/**
 * Die zentrale Abspiel-Engine. Die Oberfläche spricht nur mit ihr – nie direkt mit Audio.
 * Sie hält Warteschlange + Status (in einem Zustand-Store) und steuert die passende Ausgabe.
 */
export class PlayerEngine {
  readonly store: StoreApi<PlayerState>;
  private readonly deps: EngineDeps;
  private readonly random: Q.Random;
  private loadToken = 0;
  private errorStreak = 0;
  /** Die Ausgabe, die gerade spielt – nur ihre Rückmeldungen zählen */
  private active: PlaybackOutput;
  private readonly outputs: PlaybackOutput[] = [];
  /** Schlaf-Timer „Ende des Songs“: nach diesem Song anhalten statt weiterzuspielen */
  stopAfterCurrent = false;

  constructor(deps: EngineDeps, initial: Partial<PlayerState> = {}) {
    this.deps = deps;
    this.random = deps.random ?? Math.random;
    this.store = createStore<PlayerState>(() => ({
      ...initialPlayerState(),
      ...initial,
      status: initial.queue && initial.queue.index >= 0 ? 'paused' : 'idle',
      loadedUid: null,
      buffering: false,
    }));
    this.active = deps.output;
    this.bind(deps.output);
  }

  /** Meldet eine Ausgabe bei der Engine an (Lautstärke übernehmen, Rückmeldungen empfangen) */
  private bind(output: PlaybackOutput) {
    if (this.outputs.includes(output)) return;
    this.outputs.push(output);
    const s = this.store.getState();
    output.setVolume(s.volume);
    output.setMuted(s.muted);
    output.setListener(this.makeListener(output));
  }

  /** Wechsel z. B. von eigenem Audio zum YouTube-Player: die alte Ausgabe wird angehalten */
  private switchTo(output: PlaybackOutput) {
    this.bind(output);
    if (output === this.active) return;
    const old = this.active;
    this.active = output;
    old.stop();
  }

  get state(): PlayerState {
    return this.store.getState();
  }

  get current(): Track | null {
    return Q.currentItem(this.state.queue)?.track ?? null;
  }

  private set(partial: Partial<PlayerState>) {
    this.store.setState(partial);
  }

  private setQueue(queue: Q.QueueState) {
    this.set({ queue });
  }

  // ---------- Warteschlange ----------

  /** Liste abspielen, beginnend bei startIndex (z. B. Klick auf einen Song in einem Album) */
  playTracks(tracks: Track[], startIndex = 0) {
    if (tracks.length === 0) return;
    this.errorStreak = 0;
    this.setQueue(Q.setQueue(this.state.queue, tracks, startIndex, this.random));
    void this.loadCurrent(true);
  }

  /** Liste im Zufallsmodus abspielen (Start bei einem zufälligen Song) */
  playShuffled(tracks: Track[]) {
    if (tracks.length === 0) return;
    this.errorStreak = 0;
    const queue = { ...this.state.queue, shuffle: true };
    const start = Math.floor(this.random() * tracks.length);
    this.setQueue(Q.setQueue(queue, tracks, start, this.random));
    void this.loadCurrent(true);
  }

  playNext(tracks: Track[]) {
    const wasEmpty = this.state.queue.index < 0;
    this.setQueue(Q.playNext(this.state.queue, tracks));
    if (wasEmpty) void this.loadCurrent(true);
  }

  addToQueue(tracks: Track[]) {
    const wasEmpty = this.state.queue.index < 0;
    this.setQueue(Q.addToEnd(this.state.queue, tracks));
    if (wasEmpty) void this.loadCurrent(true);
  }

  moveInQueue(from: number, to: number) {
    this.setQueue(Q.move(this.state.queue, from, to));
  }

  removeFromQueue(index: number) {
    const before = Q.currentItem(this.state.queue);
    const wasPlaying = this.state.status === 'playing' || this.state.status === 'loading';
    const queue = Q.removeAt(this.state.queue, index);
    this.setQueue(queue);
    const after = Q.currentItem(queue);
    if (after?.uid !== before?.uid) {
      if (after) void this.loadCurrent(wasPlaying);
      else this.stop();
    }
  }

  clearUpcoming() {
    this.setQueue(Q.clearUpcoming(this.state.queue));
  }

  jumpTo(index: number) {
    this.errorStreak = 0;
    this.setQueue(Q.jumpTo(this.state.queue, index));
    void this.loadCurrent(true);
  }

  toggleShuffle() {
    this.setQueue(Q.setShuffle(this.state.queue, !this.state.queue.shuffle, this.random));
  }

  cycleRepeat() {
    this.setQueue(Q.cycleRepeat(this.state.queue));
  }

  // ---------- Steuerung ----------

  async play() {
    const item = Q.currentItem(this.state.queue);
    if (!item) return;
    if (this.state.loadedUid !== item.uid) {
      // Live-Radio startet immer „jetzt“, Songs dort, wo man aufgehört hat
      await this.loadCurrent(true, item.track.live ? 0 : this.state.positionMs);
      return;
    }
    try {
      await this.active.play();
    } catch (err) {
      this.handlePlayRejection(err);
    }
  }

  pause() {
    this.active.pause();
    if (this.state.status !== 'idle') this.set({ status: 'paused', buffering: false });
  }

  toggle() {
    const st = this.state.status;
    if (st === 'playing' || st === 'loading') this.pause();
    else void this.play();
  }

  next() {
    const idx = Q.nextIndex(this.state.queue, false);
    if (idx === null) {
      void this.continueWithAutoplay(false);
      return;
    }
    this.errorStreak = 0;
    this.setQueue(Q.jumpTo(this.state.queue, idx));
    void this.loadCurrent(true);
  }

  prev() {
    if (this.state.positionMs > PREV_RESTART_MS && !this.current?.live) {
      this.seek(0);
      return;
    }
    const idx = Q.prevIndex(this.state.queue);
    if (idx === null) {
      this.seek(0);
      return;
    }
    this.errorStreak = 0;
    this.setQueue(Q.jumpTo(this.state.queue, idx));
    void this.loadCurrent(true);
  }

  seek(ms: number) {
    if (this.current?.live) return;
    const dur = this.state.durationMs;
    const clamped = Math.max(0, dur > 0 ? Math.min(ms, dur) : ms);
    this.set({ positionMs: clamped });
    if (this.state.loadedUid) this.active.seek(clamped / 1000);
  }

  setVolume(volume: number) {
    const v = Math.min(1, Math.max(0, volume));
    for (const o of this.outputs) o.setVolume(v);
    this.set({ volume: v, muted: v === 0 ? this.state.muted : false });
    if (v > 0) for (const o of this.outputs) o.setMuted(false);
  }

  toggleMute() {
    const muted = !this.state.muted;
    for (const o of this.outputs) o.setMuted(muted);
    this.set({ muted });
  }

  canSetVolume() {
    return this.deps.output.canSetVolume();
  }

  /** Beim ersten Tippen aufrufen (iPhone/iPad): schaltet Audio frei */
  unlock() {
    this.deps.output.unlock();
  }

  stop() {
    this.loadToken += 1;
    this.active.stop();
    this.set({ status: 'idle', positionMs: 0, loadedUid: null, buffering: false });
  }

  // ---------- intern ----------

  private notice(n: PlayerNotice) {
    this.deps.onNotice?.(n);
  }

  private async loadCurrent(autoplay: boolean, startMs = 0) {
    const token = ++this.loadToken;
    const item = Q.currentItem(this.state.queue);
    if (!item) {
      this.stop();
      return;
    }
    this.set({
      status: autoplay ? 'loading' : 'paused',
      positionMs: startMs,
      durationMs: item.track.durationMs,
      loadedUid: null,
      buffering: false,
    });
    const source = this.deps.getSource(item.track.sourceId);
    const output =
      source?.playbackMode === 'url' && source.getStreamUrl
        ? this.deps.output
        : source?.playbackMode === 'external'
          ? this.deps.getExternalOutput?.(source)
          : undefined;
    if (!source || !output) {
      this.notice({ kind: 'unsupported', sourceId: item.track.sourceId });
      this.set({ status: 'paused' });
      return;
    }
    // Eigenes Audio braucht eine Stream-Adresse; externe Player (YouTube) bekommen die ID
    let ref = item.track.id;
    if (source.playbackMode === 'url' && source.getStreamUrl) {
      try {
        ref = await source.getStreamUrl(item.track);
      } catch (err) {
        if (token !== this.loadToken) return;
        const kind = err instanceof SourceError ? err.kind : 'network';
        this.notice({ kind: 'sourceError', sourceId: source.id, errorKind: kind });
        this.set({ status: 'paused' });
        return;
      }
    }
    if (token !== this.loadToken) return;
    this.switchTo(output);
    output.load(ref, startMs / 1000);
    this.set({ loadedUid: item.uid });
    if (!autoplay) return;
    try {
      await output.play();
    } catch (err) {
      if (token !== this.loadToken) return;
      this.handlePlayRejection(err);
    }
  }

  /** Ende der Warteschlange: mit Autoplay weiter, sonst bleibt der letzte Song stehen */
  private async continueWithAutoplay(ended: boolean) {
    const q = this.state.queue;
    const last = Q.currentItem(q)?.track;
    const stopHere = () => {
      if (!ended) return;
      this.active.seek(0);
      this.set({ status: 'paused', positionMs: 0, buffering: false });
    };
    if (!last || !this.deps.onQueueEnd) {
      stopHere();
      return;
    }
    const token = ++this.loadToken;
    if (ended) this.set({ status: 'loading', buffering: false });
    let more: Track[] = [];
    try {
      more = await this.deps.onQueueEnd(
        last,
        q.items.map((i) => i.track),
      );
    } catch {
      more = [];
    }
    // In der Zwischenzeit hat jemand etwas anderes gestartet
    if (token !== this.loadToken) return;
    if (more.length === 0) {
      stopHere();
      return;
    }
    // Hat man beim Warten auf Pause gedrückt, wird nur angehängt, aber nicht losgespielt
    const autoplay = !ended || this.state.status === 'loading';
    const added = Q.addToEnd(this.state.queue, more);
    const idx = Q.nextIndex(added, false);
    this.setQueue(idx === null ? added : Q.jumpTo(added, idx));
    void this.loadCurrent(autoplay);
  }

  private handlePlayRejection(err: unknown) {
    // NotAllowedError: Browser will erst einen Tipp vom Nutzer → einfach pausiert anzeigen.
    // Andere Fehler meldet das <audio>-Element selbst über onError.
    if (err instanceof DOMException && err.name === 'AbortError') return;
    this.set({ status: 'paused', buffering: false });
  }

  private onEnded = () => {
    const q = this.state.queue;
    if (this.stopAfterCurrent) {
      this.stopAfterCurrent = false;
      this.active.seek(0);
      this.set({ status: 'paused', positionMs: 0, buffering: false });
      this.notice({ kind: 'sleep' });
      return;
    }
    const idx = Q.nextIndex(q, true);
    if (idx === null) {
      void this.continueWithAutoplay(true);
      return;
    }
    if (idx === q.index) {
      this.active.seek(0);
      this.set({ positionMs: 0 });
      this.active.play().catch((err) => this.handlePlayRejection(err));
      return;
    }
    this.setQueue(Q.jumpTo(q, idx));
    void this.loadCurrent(true);
  };

  private onError = () => {
    const q = this.state.queue;
    const item = Q.currentItem(q);
    if (!item) return;
    this.errorStreak += 1;
    const idx = Q.nextIndex(q, false);
    const canSkip = this.errorStreak < MAX_ERROR_SKIPS && idx !== null && idx !== q.index;
    this.notice({ kind: 'trackError', title: item.track.title, skipped: canSkip });
    if (canSkip && idx !== null) {
      this.setQueue(Q.jumpTo(q, idx));
      void this.loadCurrent(true);
    } else {
      this.set({ status: 'paused', loadedUid: null, buffering: false });
    }
  };

  /** Rückmeldungen einer Ausgabe – von nicht (mehr) aktiven Ausgaben werden sie ignoriert */
  private makeListener(output: PlaybackOutput): OutputListener {
    const ifActive =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (output === this.active) fn(...args);
      };
    return {
      onTime: ifActive((pos: number, dur: number) => {
        const partial: Partial<PlayerState> = { positionMs: Math.round(pos * 1000) };
        if (Number.isFinite(dur) && dur > 0) partial.durationMs = Math.round(dur * 1000);
        this.set(partial);
      }),
      onEnded: ifActive(() => this.onEnded()),
      onError: ifActive(() => this.onError()),
      onPlaying: ifActive(() => {
        this.errorStreak = 0;
        this.set({ status: 'playing', buffering: false });
      }),
      onPause: ifActive(() => {
        if (this.state.status === 'playing') this.set({ status: 'paused', buffering: false });
      }),
      onWaiting: ifActive(() => {
        if (this.state.status === 'playing') this.set({ buffering: true });
      }),
    };
  }
}
