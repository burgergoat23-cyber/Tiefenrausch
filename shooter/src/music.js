// Prozedurale Musik (ca. 120 BPM): Kick, Hi-Hat, Bass, Arpeggio; im Boss-Kampf schneller mit Snare und Lead.
// Dynamisch: Pause = nur Bass und Hi-Hat, Welle = alles, Boss = schneller + zusätzliche Spuren.
// Ein Planer schaut 120 ms voraus und setzt die Noten genau auf die Zeitachse des AudioContext.

import { CONFIG } from './config.js';

// a-Moll: Am – F – C – G
const ROOTS = [55, 43.65, 65.41, 49];
const CHORDS = [
  [440, 523.25, 659.25],
  [349.23, 440, 523.25],
  [523.25, 659.25, 783.99],
  [392, 493.88, 587.33],
];
const BASS = [1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1.5, 0];
// Lautstärke der Spuren je Intensität: [kick, hat, bass, arp, snare, lead]
const MIX = [
  [0, 0.7, 1, 0, 0, 0],
  [1, 1, 1, 0.8, 0, 0],
  [1, 1, 1, 0.9, 1, 0.8],
];
const NAMES = ['kick', 'hat', 'bass', 'arp', 'snare', 'lead'];

export function createMusic(a) {
  const ctx = a.ctx;
  const m = {
    bpm: CONFIG.audio.bpm,
    targetBpm: CONFIG.audio.bpm,
    step: 0,
    nextTime: ctx.currentTime + 0.1,
    intensity: 0,
    gains: {},
    kicks: [0, 0, 0, 0, 0, 0, 0, 0],
    kickIdx: 0,
  };
  for (const n of NAMES) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(a.musicBus);
    m.gains[n] = g;
  }

  m.setIntensity = (level) => {
    m.intensity = level;
    m.targetBpm = level >= 2 ? CONFIG.audio.bossBpm : CONFIG.audio.bpm;
    const mix = MIX[Math.max(0, Math.min(2, level))];
    const t = ctx.currentTime;
    NAMES.forEach((n, i) => m.gains[n].gain.setTargetAtTime(mix[i], t, 0.4));
  };

  // Stärke des Takt-Pulses (0..1) für das Bodengitter
  m.pulse = () => {
    const now = ctx.currentTime;
    let best = -1;
    for (const k of m.kicks) if (k <= now && k > best) best = k;
    if (best < 0) return 0;
    return Math.exp(-(now - best) * 7);
  };

  function schedule() {
    if (ctx.state !== 'running') return;
    const ahead = ctx.currentTime + 0.12;
    if (m.nextTime < ctx.currentTime - 0.2) m.nextTime = ctx.currentTime + 0.05; // nach Pause nicht nachholen
    while (m.nextTime < ahead) {
      if (m.step % 16 === 0) m.bpm = m.targetBpm;
      playStep(a, m, m.step, m.nextTime);
      m.nextTime += 60 / m.bpm / 4;
      m.step = (m.step + 1) % 64;
    }
  }
  m.timer = setInterval(schedule, 25);
  m.stop = () => clearInterval(m.timer);
  return m;
}

function note(a, out, t, type, f, dur, vol, filterHz) {
  const ctx = a.ctx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (filterHz) {
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = filterHz;
    o.connect(fl);
    fl.connect(g);
  } else {
    o.connect(g);
  }
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hit(a, out, t, dur, vol, type, freq, q = 1) {
  const ctx = a.ctx;
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t, Math.random() * 1.5, dur + 0.02);
}

function playStep(a, m, step, t) {
  const s16 = step % 16;
  const bar = Math.floor(step / 16) % 4;
  const muted = a.settings.musicMuted || a.settings.musicVolume <= 0;
  const G = m.gains;
  // Kick auf jedem Viertel (merken für das pulsierende Gitter, auch wenn stumm)
  if (s16 % 4 === 0) {
    m.kicks[m.kickIdx] = t;
    m.kickIdx = (m.kickIdx + 1) % m.kicks.length;
  }
  if (muted) return;
  const ctx = a.ctx;
  if (s16 % 4 === 0 && m.intensity >= 1) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g);
    g.connect(G.kick);
    o.start(t);
    o.stop(t + 0.3);
  }
  // Hi-Hat auf den Achtel-Offbeats, bei Intensität leise Sechzehntel dazwischen
  if (s16 % 4 === 2) hit(a, G.hat, t, 0.05, 0.22, 'highpass', 7500);
  else if (m.intensity >= 1 && s16 % 2 === 1) hit(a, G.hat, t, 0.025, 0.07, 'highpass', 9000);
  // Bass in Achteln
  const b = BASS[s16];
  if (b) note(a, G.bass, t, 'sawtooth', ROOTS[bar] * b, 0.2, 0.35, 520);
  // Arpeggio in Sechzehnteln durch die Akkordtöne
  if (m.intensity >= 1) {
    const ch = CHORDS[bar];
    const idx = [0, 1, 2, 1][s16 % 4];
    const oct = s16 >= 8 ? 2 : 1;
    note(a, G.arp, t, 'square', ch[idx] * oct * 0.5, 0.11, 0.07, 2600);
  }
  // Boss: Snare auf 2 und 4, Lead mit langen Tönen
  if (m.intensity >= 2) {
    if (s16 === 4 || s16 === 12) hit(a, G.snare, t, 0.14, 0.35, 'bandpass', 1900, 0.8);
    if (s16 === 0 || s16 === 10) {
      const f = CHORDS[bar][s16 === 0 ? 0 : 2];
      note(a, G.lead, t, 'sawtooth', f, s16 === 0 ? 0.6 : 0.35, 0.09, 1800);
      note(a, G.lead, t, 'sawtooth', f * 1.006, s16 === 0 ? 0.6 : 0.35, 0.06, 1800);
    }
  }
}
