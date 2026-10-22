// Die einzelnen Geräusche. Jede Funktion bekommt (audio, startzeit, p1, p2) und gibt ihre Dauer zurück.
// Jeder Ton hat eine leichte zufällige Tonhöhe, damit Wiederholungen nicht nerven.

const vary = (amount = 0.05) => 1 + (Math.random() * 2 - 1) * amount;

// Oszillator mit Tonhöhen-Verlauf und Hüllkurve
function tone(a, t, type, f0, f1, dur, vol, attack = 0.004, out = a.sfx) {
  const ctx = a.ctx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
  return { o, g };
}

// Rauschen durch einen Filter, dessen Frequenz wandert
function noise(a, t, dur, type, f0, f1, vol, q = 1, attack = 0.003, out = a.sfx) {
  const ctx = a.ctx;
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  src.playbackRate.value = vary(0.1);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  const off = Math.random() * Math.max(0, 1.9 - dur);
  src.start(t, off, dur + 0.05);
  return src;
}

let curve = null;
function distortion(a) {
  if (!curve) {
    const n = 256;
    curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 4);
    }
  }
  const w = a.ctx.createWaveShaper();
  w.curve = curve;
  return w;
}

function chord(a, t, freqs, dur, vol, type = 'triangle') {
  for (const f of freqs) tone(a, t, type, f, f, dur, vol / freqs.length, 0.01);
}

export const SOUNDS = {
  // Waffen
  pistol(a, t) {
    const v = vary(0.06);
    tone(a, t, 'square', 560 * v, 170 * v, 0.09, 0.16);
    noise(a, t, 0.04, 'highpass', 3000, 3000, 0.12);
    return 0.1;
  },
  shotgun(a, t) {
    noise(a, t, 0.32, 'lowpass', 2200 * vary(), 260, 0.75, 0.7);
    tone(a, t, 'sine', 110 * vary(), 45, 0.22, 0.6);
    return 0.33;
  },
  mg(a, t) {
    const v = vary(0.08);
    tone(a, t, 'square', 900 * v, 260 * v, 0.04, 0.12, 0.002);
    noise(a, t, 0.03, 'highpass', 4000, 4000, 0.1);
    return 0.05;
  },
  rocket(a, t) {
    noise(a, t, 0.35, 'bandpass', 400, 1600, 0.75, 2);
    tone(a, t, 'sawtooth', 120 * vary(), 60, 0.25, 0.2);
    return 0.36;
  },
  railCharge(a, t) {
    a.stopCharge();
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.35);
    const f = a.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    o.connect(f);
    f.connect(g);
    g.connect(a.sfx);
    o.start(t);
    o.stop(t + 0.6);
    a.charge = { osc: o, gain: g };
    return 0.45;
  },
  rail(a, t) {
    a.stopCharge();
    noise(a, t, 0.08, 'highpass', 2500, 2500, 0.5);
    tone(a, t, 'square', 1900 * vary(), 160, 0.18, 0.2);
    tone(a, t, 'sine', 90, 40, 0.3, 0.45);
    return 0.3;
  },
  // Treffer und Tod
  hit(a, t, crit) {
    const f = (crit ? 1700 : 1200) * vary(0.08);
    tone(a, t, 'sine', f, f * 0.8, crit ? 0.07 : 0.045, crit ? 0.14 : 0.07);
    return 0.05;
  },
  death(a, t, big) {
    const v = vary(0.1);
    tone(a, t, 'square', (big ? 320 : 640) * v, (big ? 50 : 110) * v, big ? 0.4 : 0.18, 0.12);
    noise(a, t, big ? 0.35 : 0.15, 'lowpass', 2500, 400, 0.18);
    return big ? 0.4 : 0.18;
  },
  explosion(a, t, radius = 100) {
    const k = Math.min(1.6, Math.max(0.6, radius / 110));
    noise(a, t, 0.7 * k, 'lowpass', 1600 * vary(), 70, 0.7, 0.8, 0.005);
    tone(a, t, 'sine', 80 * vary(), 32, 0.55 * k, 0.6);
    return 0.7 * k;
  },
  playerHit(a, t) {
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    const d = distortion(a);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.28);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(d);
    d.connect(g);
    g.connect(a.sfx);
    o.start(t);
    o.stop(t + 0.32);
    noise(a, t, 0.15, 'lowpass', 1200, 300, 0.3);
    return 0.32;
  },
  playerDeath(a, t) {
    SOUNDS.explosion(a, t, 180);
    tone(a, t, 'sawtooth', 400, 30, 1.4, 0.2, 0.01);
    return 1.4;
  },
  dash(a, t) {
    noise(a, t, 0.2, 'bandpass', 300, 3200, 0.7, 1.5, 0.02);
    return 0.2;
  },
  pickup(a, t) {
    const v = vary(0.03);
    tone(a, t, 'sine', 660 * v, 660 * v, 0.07, 0.2);
    tone(a, t + 0.07, 'sine', 990 * v, 990 * v, 0.1, 0.2);
    return 0.18;
  },
  combo(a, t, tier = 1) {
    const base = 440 * Math.pow(2, (tier - 1) / 4);
    [1, 1.25, 1.5, 2].forEach((m, i) => tone(a, t + i * 0.06, 'square', base * m, base * m, 0.12, 0.11));
    return 0.3;
  },
  waveStart(a, t) {
    // Gong: tiefe Teiltöne mit langem Ausklingen
    [[110, 0.35], [165, 0.18], [231, 0.12], [297, 0.08]].forEach(([f, v]) => tone(a, t, 'sine', f, f * 0.99, 2.2, v, 0.01));
    noise(a, t, 0.08, 'bandpass', 2000, 2000, 0.15, 3);
    return 2.2;
  },
  bossWave(a, t) {
    [[55, 0.4], [82, 0.25], [110, 0.18]].forEach(([f, v]) => tone(a, t, 'sine', f, f * 0.98, 2.6, v, 0.02));
    return 2.6;
  },
  waveClear(a, t) {
    chord(a, t, [523, 659, 784], 0.7, 0.3);
    chord(a, t + 0.12, [1047], 0.6, 0.12);
    return 0.8;
  },
  bossAppear(a, t) {
    // tiefes Dröhnen, das langsam lauter wird
    const o = a.ctx.createOscillator();
    const o2 = a.ctx.createOscillator();
    const f = a.ctx.createBiquadFilter();
    const g = a.ctx.createGain();
    o.type = 'sawtooth';
    o2.type = 'sawtooth';
    o.frequency.value = 55;
    o2.frequency.value = 55.8;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(200, t);
    f.frequency.linearRampToValueAtTime(900, t + 1.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(a.sfx);
    o.start(t);
    o2.start(t);
    o.stop(t + 2.5);
    o2.stop(t + 2.5);
    return 2.5;
  },
  roar(a, t) {
    noise(a, t, 1.0, 'lowpass', 700, 150, 0.6, 1, 0.05);
    const o = tone(a, t, 'sawtooth', 70, 45, 1.0, 0.25, 0.05);
    void o;
    return 1.0;
  },
  bossDeath(a, t) {
    SOUNDS.explosion(a, t, 200);
    chord(a, t + 0.3, [262, 330, 392, 523], 1.5, 0.35);
    return 1.8;
  },
  heart(a, t) {
    tone(a, t, 'sine', 62, 45, 0.14, 0.4, 0.01);
    tone(a, t + 0.2, 'sine', 55, 40, 0.16, 0.3, 0.01);
    return 0.4;
  },
  // Gegner
  enemyShot(a, t) {
    tone(a, t, 'sine', 720 * vary(), 380, 0.12, 0.13);
    return 0.12;
  },
  charge(a, t, boss) {
    tone(a, t, 'triangle', boss ? 180 : 500, boss ? 520 : 1100, boss ? 0.5 : 0.3, boss ? 0.12 : 0.05, 0.05);
    return boss ? 0.5 : 0.3;
  },
  fuse(a, t) {
    for (let i = 0; i < 4; i++) tone(a, t + i * 0.22, 'square', 1500, 1500, 0.035, 0.1, 0.002);
    return 0.9;
  },
  windup(a, t) {
    tone(a, t, 'sawtooth', 60, 110, 0.5, 0.15, 0.1);
    return 0.5;
  },
  stomp(a, t) {
    tone(a, t, 'sine', 90, 35, 0.35, 0.55);
    noise(a, t, 0.25, 'lowpass', 600, 100, 0.35);
    return 0.35;
  },
  block(a, t) {
    tone(a, t, 'triangle', 1500 * vary(), 1300, 0.08, 0.12);
    return 0.08;
  },
  shieldHit(a, t) {
    tone(a, t, 'sine', 900, 1400, 0.12, 0.12);
    return 0.12;
  },
  shieldBreak(a, t) {
    noise(a, t, 0.3, 'highpass', 3000, 6000, 0.25);
    tone(a, t, 'triangle', 1200, 300, 0.3, 0.15);
    return 0.3;
  },
  spawn(a, t) {
    tone(a, t, 'sine', 300 * vary(0.1), 520, 0.1, 0.03);
    return 0.1;
  },
  hatch(a, t) {
    noise(a, t, 0.15, 'bandpass', 800, 300, 0.25, 3);
    return 0.15;
  },
  sprint(a, t) {
    noise(a, t, 0.15, 'bandpass', 1200, 2600, 0.12, 2);
    return 0.15;
  },
  bonus(a, t) {
    [784, 988, 1175, 1568].forEach((f, i) => tone(a, t + i * 0.07, 'square', f, f, 0.1, 0.11));
    return 0.4;
  },
  fanfare(a, t) {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => tone(a, t + i * 0.12, 'square', f, f, i === notes.length - 1 ? 0.6 : 0.14, 0.13));
    return 1.3;
  },
  // Menüs
  hover(a, t) {
    tone(a, t, 'sine', 1800, 1800, 0.02, 0.025, 0.002);
    return 0.02;
  },
  click(a, t) {
    tone(a, t, 'square', 700, 1100, 0.05, 0.05, 0.002);
    return 0.05;
  },
  bounce(a, t) {
    tone(a, t, 'triangle', 2200 * vary(), 1800, 0.04, 0.05);
    return 0.04;
  },
};
