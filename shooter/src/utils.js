// Mathe, Zufall, Rauschen und Objekt-Pools. Kein DOM, kein Canvas.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const sign = (v) => (v < 0 ? -1 : 1);

export function length(x, y) {
  return Math.sqrt(x * x + y * y);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

// Kürzeste Winkeldifferenz von a nach b im Bereich -PI..PI
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

// Winkel a höchstens um maxStep in Richtung b drehen
export function turnTowards(a, b, maxStep) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

// Wert v mit fester Rate auf Ziel t zubewegen
export function approach(v, t, step) {
  if (v < t) return Math.min(v + step, t);
  return Math.max(v - step, t);
}

// Ein von dt unabhängiger Glättungsfaktor (Faktor f gilt pro 1/60 s)
export function damp(f, dt) {
  return 1 - Math.pow(1 - f, dt * 60);
}

// --- Zufall mit Seed (mulberry32) ---------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mehrere Zahlen zu einem Seed vermischen (FNV-artig)
export function hashSeed(...nums) {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    h ^= n >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

export const randRange = (rng, a, b) => a + (b - a) * rng();
export const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const randSigned = (rng, spread) => (rng() * 2 - 1) * spread;
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Gewichtete Auswahl aus einem Objekt {schluessel: gewicht}
export function weightedKey(rng, weights, keys = Object.keys(weights)) {
  let total = 0;
  for (const k of keys) total += weights[k];
  let r = rng() * total;
  for (const k of keys) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1];
}

export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// --- Weiches 1D-Rauschen für Screenshake ------------------------------------------

function hash1(n) {
  let x = Math.imul(n | 0, 374761393) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// Wertrauschen -1..1, stetig in t
export function noise1(seed, t) {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash1(i * 31 + seed * 7919);
  const b = hash1((i + 1) * 31 + seed * 7919);
  return (a + (b - a) * smoothstep(f)) * 2 - 1;
}

// --- Objekt-Pool ------------------------------------------------------------------
// Die ersten `count` Einträge sind aktiv. Freigeben tauscht mit dem letzten aktiven,
// darum beim Durchlaufen mit Freigabe rückwärts zählen.

export class Pool {
  constructor(factory, capacity) {
    this.items = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.items[i] = factory();
    this.count = 0;
  }

  spawn() {
    if (this.count >= this.items.length) return null;
    return this.items[this.count++];
  }

  release(index) {
    const last = --this.count;
    if (index !== last) {
      const tmp = this.items[index];
      this.items[index] = this.items[last];
      this.items[last] = tmp;
    }
  }

  clear() {
    this.count = 0;
  }
}

// Zeit hübsch formatieren (m:ss)
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// Tausenderpunkte
export function formatScore(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
