import type { OutputListener, PlaybackOutput } from './output';
import { useVideoDock } from './videoDock';

/** Das Nötigste aus der offiziellen YouTube-IFrame-API */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  cueVideoById(opts: { videoId: string; startSeconds?: number }): void;
  setPlaybackRate?(rate: number): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      host?: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_API_URL = 'https://www.youtube.com/iframe_api';
/** Wenn das Video nach so vielen ms nicht läuft, braucht es einen Tipp aufs Video (iPhone) */
const PLAY_TIMEOUT_MS = 4000;

const STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

let apiPromise: Promise<YTNamespace> | null = null;

/** Lädt das offizielle Skript von YouTube (nur einmal) */
export function loadYouTubeApi(doc: Document = document): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube-Player fehlt'));
    };
    const script = doc.createElement('script');
    script.src = YT_API_URL;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube-Player konnte nicht geladen werden'));
    };
    doc.head.appendChild(script);
  });
  return apiPromise;
}

const noop: OutputListener = {
  onTime() {},
  onEnded() {},
  onError() {},
  onPlaying() {},
  onPause() {},
  onWaiting() {},
};

/**
 * Ausgabe über den offiziellen YouTube-Player (datenschutzfreundlich über youtube-nocookie.com).
 * Regeln von YouTube: Das Video bleibt sichtbar (mind. 200 × 200 px), nichts wird verdeckt oder gespeichert.
 */
export class YouTubeOutput implements PlaybackOutput {
  readonly kind = 'external' as const;
  readonly host: HTMLDivElement;
  private readonly mount: HTMLDivElement;
  private listener: OutputListener = noop;
  private player: YTPlayer | null = null;
  private ready: Promise<YTPlayer> | null = null;
  private cued: Promise<void> = Promise.resolve();
  private videoId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private volume = 1;
  private muted = false;
  private rate = 1;
  private pendingPlay: {
    resolve(): void;
    reject(e: unknown): void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  constructor(doc: Document = document) {
    const host = doc.createElement('div');
    host.className = 'kr-video-host';
    host.dataset.testid = 'video-host';
    Object.assign(host.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: '0px',
      height: '0px',
      zIndex: '55',
      visibility: 'hidden',
      overflow: 'hidden',
      borderRadius: 'var(--kr-radius)',
      background: '#000',
    });
    const mount = doc.createElement('div');
    mount.style.width = '100%';
    mount.style.height = '100%';
    host.appendChild(mount);
    doc.body.appendChild(host);
    this.host = host;
    this.mount = mount;
    useVideoDock.getState().setHost(host);
  }

  setListener(listener: OutputListener) {
    this.listener = listener;
  }

  private ensurePlayer(): Promise<YTPlayer> {
    this.ready ??= loadYouTubeApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          new YT.Player(this.mount, {
            host: 'https://www.youtube-nocookie.com',
            width: '100%',
            height: '100%',
            playerVars: {
              playsinline: 1, // iPhone: nicht automatisch in Vollbild
              rel: 0,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (e) => {
                this.player = e.target;
                e.target.setVolume(Math.round(this.volume * 100));
                if (this.muted) e.target.mute();
                if (this.rate !== 1) e.target.setPlaybackRate?.(this.rate);
                resolve(e.target);
              },
              onStateChange: (e) => this.onState(e.data),
              onError: (e) => {
                this.settlePlay(new Error(`YouTube-Fehler ${e.data}`));
                this.listener.onError(e.data);
              },
            },
          });
        }),
    );
    this.ready.catch(() => {
      this.ready = null;
    });
    return this.ready;
  }

  private onState(state: number) {
    if (state === STATE.PLAYING) {
      this.settlePlay();
      this.startTimer();
      this.listener.onPlaying();
    } else if (state === STATE.PAUSED) {
      this.stopTimer();
      this.listener.onPause();
    } else if (state === STATE.BUFFERING) {
      this.listener.onWaiting();
    } else if (state === STATE.ENDED) {
      this.stopTimer();
      this.listener.onEnded();
    }
  }

  private settlePlay(err?: unknown) {
    const p = this.pendingPlay;
    if (!p) return;
    this.pendingPlay = null;
    clearTimeout(p.timer);
    if (err) p.reject(err);
    else p.resolve();
  }

  private startTimer() {
    this.stopTimer();
    const tick = () => {
      const p = this.player;
      if (p) this.listener.onTime(p.getCurrentTime() || 0, p.getDuration() || 0);
    };
    tick();
    this.timer = setInterval(tick, 500);
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** „url“ ist hier die Video-ID */
  load(videoId: string, startSec = 0) {
    this.videoId = videoId;
    this.settlePlay(new DOMException('Neues Video', 'AbortError'));
    this.cued = this.ensurePlayer().then((p) => {
      if (this.videoId !== videoId) return;
      p.cueVideoById({ videoId, startSeconds: startSec });
    });
    this.cued.catch(() => this.listener.onError(null));
  }

  async play(): Promise<void> {
    await this.cued;
    const p = this.player;
    if (!p) throw new Error('YouTube-Player nicht bereit');
    return new Promise<void>((resolve, reject) => {
      this.settlePlay(new DOMException('Neuer Start', 'AbortError'));
      const timer = setTimeout(() => {
        // Am iPhone startet ein eingebettetes Video oft erst nach einem Tipp aufs Video selbst
        this.settlePlay(new DOMException('Bitte aufs Video tippen', 'NotAllowedError'));
      }, PLAY_TIMEOUT_MS);
      this.pendingPlay = { resolve, reject, timer };
      p.playVideo();
      if (this.rate !== 1) p.setPlaybackRate?.(this.rate);
    });
  }

  pause() {
    this.settlePlay(new DOMException('Pause', 'AbortError'));
    this.player?.pauseVideo();
  }

  seek(sec: number) {
    if (Number.isFinite(sec)) this.player?.seekTo(Math.max(0, sec), true);
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.player?.setVolume(Math.round(this.volume * 100));
  }

  /** YouTube kennt nur feste Stufen (0,75 / 1 / 1,25 …) und behält die Tonhöhe */
  setRate(rate: number) {
    this.rate = rate < 1 ? 0.75 : rate > 1 ? 1.25 : 1;
    this.player?.setPlaybackRate?.(this.rate);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.player?.mute();
    else this.player?.unMute();
  }

  stop() {
    this.videoId = null;
    this.settlePlay(new DOMException('Stopp', 'AbortError'));
    this.stopTimer();
    this.player?.stopVideo();
  }

  unlock() {}

  canSetVolume() {
    return true;
  }
}
