/** Rückmeldungen einer Ausgabe an die PlayerEngine */
export interface OutputListener {
  onTime(positionSec: number, durationSec: number): void;
  onEnded(): void;
  onError(code: number | null): void;
  onPlaying(): void;
  onPause(): void;
  onWaiting(): void;
}

/**
 * Eine Ausgabe spielt Töne ab. Phase 1: eigenes Audio (HTMLAudioElement).
 * Phase 3 bekommt eine zweite Ausgabe für Spotify mit derselben Schnittstelle.
 */
export interface PlaybackOutput {
  readonly kind: 'url' | 'external';
  setListener(listener: OutputListener): void;
  load(url: string, startSec?: number): void;
  play(): Promise<void>;
  pause(): void;
  seek(sec: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  stop(): void;
  /** iPhone/iPad: Audio beim ersten Tippen freischalten */
  unlock(): void;
  /** iPhone/iPad erlauben keine Lautstärke per Webseite – dann blenden wir den Regler aus */
  canSetVolume(): boolean;
  /** Tempo (Slowed/Sped up). Fehlt = geht bei dieser Ausgabe nicht. */
  setRate?(rate: number): void;
}

/** Sehr kurze, stille WAV-Datei zum Freischalten von Audio auf iOS */
export function silentWavDataUri(): string {
  const n = 800;
  const bytes = new Uint8Array(44 + n);
  const view = new DataView(bytes.buffer);
  const text = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + n, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

const noop: OutputListener = {
  onTime() {},
  onEnded() {},
  onError() {},
  onPlaying() {},
  onPause() {},
  onWaiting() {},
};

/** Eigenes Audio über ein <audio>-Element (für Audius, Jamendo …) */
export class HtmlAudioOutput implements PlaybackOutput {
  readonly kind = 'url' as const;
  readonly el: HTMLAudioElement;
  private listener: OutputListener = noop;
  /** true, solange nur die stille Freischalt-Datei drin ist – deren Ereignisse ignorieren wir */
  private silent = false;
  private volumeSupported: boolean | null = null;

  constructor(doc: Document = document) {
    const el = doc.createElement('audio');
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.preload = 'auto';
    el.hidden = true;
    el.dataset.kr = 'player';
    doc.body.appendChild(el);
    this.el = el;

    const time = () => {
      if (!this.silent) this.listener.onTime(el.currentTime, el.duration);
    };
    el.addEventListener('timeupdate', time);
    el.addEventListener('durationchange', time);
    el.addEventListener('loadedmetadata', time);
    el.addEventListener('ended', () => !this.silent && this.listener.onEnded());
    el.addEventListener('playing', () => !this.silent && this.listener.onPlaying());
    el.addEventListener('pause', () => !this.silent && this.listener.onPause());
    el.addEventListener('waiting', () => !this.silent && this.listener.onWaiting());
    el.addEventListener('error', () => {
      if (this.silent || !el.getAttribute('src')) return;
      this.listener.onError(el.error?.code ?? null);
    });
  }

  setListener(listener: OutputListener) {
    this.listener = listener;
  }

  load(url: string, startSec = 0) {
    this.silent = false;
    this.el.src = url;
    this.el.load();
    if (startSec > 0) {
      const jump = () => {
        this.el.currentTime = startSec;
        this.el.removeEventListener('loadedmetadata', jump);
      };
      this.el.addEventListener('loadedmetadata', jump);
    }
  }

  play() {
    return this.el.play();
  }

  pause() {
    this.el.pause();
  }

  seek(sec: number) {
    if (Number.isFinite(sec)) this.el.currentTime = Math.max(0, sec);
  }

  setVolume(volume: number) {
    this.el.volume = Math.min(1, Math.max(0, volume));
  }

  setMuted(muted: boolean) {
    this.el.muted = muted;
  }

  /** Tempo ohne Tonhöhen-Korrektur: langsamer klingt tiefer („slowed“), schneller höher („sped up“) */
  setRate(rate: number) {
    const el = this.el as HTMLAudioElement & { webkitPreservesPitch?: boolean };
    el.preservesPitch = rate === 1;
    el.webkitPreservesPitch = rate === 1;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
  }

  stop() {
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
  }

  unlock() {
    if (this.el.getAttribute('src')) return;
    this.silent = true;
    this.el.src = silentWavDataUri();
    const p = this.el.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        if (this.silent) this.el.pause();
      }).catch(() => {});
    }
  }

  canSetVolume() {
    if (this.volumeSupported === null) {
      // iOS ignoriert volume (bleibt 1) – so erkennen wir das, ohne den Browser zu raten
      const probe = document.createElement('audio');
      probe.volume = 0.5;
      this.volumeSupported = Math.abs(probe.volume - 0.5) < 0.01;
    }
    return this.volumeSupported;
  }
}
