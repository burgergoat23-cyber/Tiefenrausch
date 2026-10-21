// Ton: Alle Geräusche werden mit der Web Audio API erzeugt (Oszillatoren, Rauschen, Filter, Hüllkurven).
// Mischpult: Effekte und Musik getrennt, beide in einen Master mit Kompressor.
// iPhone/Safari: der AudioContext entsteht erst bei der ersten Berührung/dem ersten Klick (unlock).

import { CONFIG } from './config.js';
import { SOUNDS } from './sounds.js';
import { createMusic } from './music.js';

const MAX_VOICES = CONFIG.audio.maxVoices;
// Wichtige Töne dürfen das Stimmen-Limit überschreiten
const PRIORITY = new Set(['playerHit', 'playerDeath', 'bossAppear', 'bossDeath', 'roar', 'waveStart', 'bossWave',
  'waveClear', 'combo', 'fanfare', 'heart', 'pickup', 'click']);

export function createAudio(settings) {
  const a = {
    ctx: null,
    master: null,
    sfx: null,
    musicBus: null,
    noise: null,
    voiceEnds: new Float64Array(MAX_VOICES),
    last: Object.create(null),
    settings,
    music: null,
    charge: null,
    heartT: 0,
    intensity: 0,
    unlocked: false,
    suspendedByApp: false,
  };

  a.unlock = () => {
    if (a.unlocked) {
      if (a.ctx && a.ctx.state === 'suspended' && !a.suspendedByApp) a.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      // iOS: Ton auch bei Stummschalter (Safari 16.4+)
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch { /* nicht unterstützt */ }
    a.ctx = new AC({ latencyHint: 'interactive' });
    build(a);
    a.unlocked = true;
    // stiller Puffer: weckt iOS auf
    const src = a.ctx.createBufferSource();
    src.buffer = a.ctx.createBuffer(1, 1, 22050);
    src.connect(a.ctx.destination);
    src.start(0);
    if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
    a.music = createMusic(a);
    a.music.setIntensity(a.intensity);
    applyVolumes(a);
  };

  a.play = (name, p1, p2) => playSound(a, name, p1, p2);
  a.setIntensity = (level) => {
    a.intensity = level;
    if (a.music) a.music.setIntensity(level);
  };
  a.applyVolumes = () => applyVolumes(a);
  a.stopCharge = () => {
    if (a.charge) {
      try {
        const t = a.ctx.currentTime;
        a.charge.gain.gain.cancelScheduledValues(t);
        a.charge.gain.gain.setTargetAtTime(0, t, 0.02);
        a.charge.osc.stop(t + 0.1);
      } catch { /* schon gestoppt */ }
      a.charge = null;
    }
  };
  // App im Hintergrund: alles stumm
  a.suspend = () => {
    a.suspendedByApp = true;
    if (a.ctx && a.ctx.state === 'running') a.ctx.suspend().catch(() => {});
  };
  a.resume = () => {
    a.suspendedByApp = false;
    if (a.ctx && a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
  };
  // Herzschlag bei wenig Leben (pro Bild aufrufen)
  a.heartbeat = (dt, active) => {
    if (!active) {
      a.heartT = 0;
      return;
    }
    a.heartT -= dt;
    if (a.heartT <= 0) {
      a.heartT = 0.85;
      playSound(a, 'heart');
    }
  };
  a.now = () => (a.ctx ? a.ctx.currentTime : 0);
  return a;
}

function build(a) {
  const ctx = a.ctx;
  a.master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  a.master.connect(comp);
  comp.connect(ctx.destination);
  a.sfx = ctx.createGain();
  a.sfx.connect(a.master);
  a.musicBus = ctx.createGain();
  a.musicBus.connect(a.master);
  // zwei Sekunden weißes Rauschen für alle Geräusche
  const len = ctx.sampleRate * 2;
  a.noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = a.noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

function applyVolumes(a) {
  if (!a.ctx) return;
  const s = a.settings;
  const t = a.ctx.currentTime;
  a.master.gain.setTargetAtTime(0.9, t, 0.02);
  a.sfx.gain.setTargetAtTime(s.sfxMuted ? 0 : s.sfxVolume, t, 0.02);
  a.musicBus.gain.setTargetAtTime(s.musicMuted ? 0 : s.musicVolume * 0.7, t, 0.05);
}

function playSound(a, name, p1, p2) {
  if (!a.ctx || a.ctx.state !== 'running') return;
  const fn = SOUNDS[name];
  if (!fn) return;
  const now = a.ctx.currentTime;
  // derselbe Ton frühestens nach 30 ms
  const last = a.last[name];
  if (last !== undefined && now - last < CONFIG.audio.minRepeat) return;
  // höchstens 12 Töne gleichzeitig
  let slot = -1;
  for (let i = 0; i < MAX_VOICES; i++) {
    if (a.voiceEnds[i] <= now) {
      slot = i;
      break;
    }
  }
  if (slot < 0 && !PRIORITY.has(name)) return;
  a.last[name] = now;
  const dur = fn(a, now, p1, p2) || 0.2;
  if (slot >= 0) a.voiceEnds[slot] = now + dur;
}
