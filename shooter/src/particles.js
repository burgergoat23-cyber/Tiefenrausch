// Partikel und Schadenszahlen mit Object Pooling. Nur Daten und Bewegung – gezeichnet wird in render_fx.js.

import { CONFIG } from './config.js';
import { Pool, TAU } from './utils.js';

export const PK = {
  SPARK: 1,     // kurze Linie in Flugrichtung
  DOT: 2,       // Leuchtpunkt, schrumpft
  RING: 3,      // Ring, der sich ausbreitet
  SMOKE: 4,     // Rauch (nicht additiv)
  FLASH: 5,     // heller Blitz
  CASING: 6,    // Patronenhülse, bleibt kurz liegen
  AFTER: 7,     // Nachbild des Spielers
  DEBRIS: 8,    // Trümmerstück, dreht sich
  TRAIL: 9,     // Spur (Rakete, Sprinter)
  IMPLODE: 10,  // saugt sich zum Spawnpunkt
  CONFETTI: 11, // Feier-Effekt
  BEAM: 12,     // Railgun-Strahl
  MUZZLE: 13,   // Mündungsfeuer-Kegel
};

function makeParticle() {
  return {
    kind: 0, layer: 1, x: 0, y: 0, x2: 0, y2: 0, vx: 0, vy: 0, life: 0, max: 1,
    size: 1, size2: 1, color: '#fff', drag: 0, gravity: 0, rot: 0, spin: 0, alpha: 1, stay: 0,
  };
}

function makeText() {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, text: '', size: 14, color: '#fff', pop: 0, owner: 0, value: 0 };
}

export function createParticles() {
  return {
    pool: new Pool(makeParticle, CONFIG.particles.max),
    texts: new Pool(makeText, CONFIG.particles.damageNumbers),
    quality: 1,         // Effekt-Menge aus den Einstellungen
    auto: 1,            // Leistungs-Automatik
  };
}

// Anzahl gemäß Effekt-Menge
export function amount(ps, n) {
  const v = n * ps.quality * ps.auto;
  return Math.max(1, Math.floor(v + Math.random()));
}

export function emit(ps, kind, x, y, vx, vy, life, size, color, layer = 1) {
  const p = ps.pool.spawn();
  if (!p) return null;
  p.kind = kind;
  p.layer = layer;
  p.x = x;
  p.y = y;
  p.x2 = x;
  p.y2 = y;
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.max = life;
  p.size = size;
  p.size2 = size;
  p.color = color;
  p.drag = 0;
  p.gravity = 0;
  p.rot = 0;
  p.spin = 0;
  p.alpha = 1;
  p.stay = 0;
  return p;
}

// Funken in alle Richtungen (oder in einen Kegel um angle)
export function burst(ps, kind, x, y, n, speedMin, speedMax, life, size, color, angle = null, cone = TAU, drag = 4) {
  const count = amount(ps, n);
  for (let i = 0; i < count; i++) {
    const a = angle === null ? Math.random() * TAU : angle + (Math.random() - 0.5) * cone;
    const s = speedMin + Math.random() * (speedMax - speedMin);
    const p = emit(ps, kind, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size, color);
    if (p) p.drag = drag;
  }
}

const textCache = new Map();
function numText(n) {
  let s = textCache.get(n);
  if (!s) {
    s = String(n);
    if (textCache.size < 2000) textCache.set(n, s);
  }
  return s;
}

export function emitText(ps, x, y, value, color, size, prefix = '', owner = 0) {
  const t = ps.texts.spawn();
  if (!t) return null;
  t.owner = owner;
  t.value = value;
  t.x = x + (Math.random() - 0.5) * 10;
  t.y = y;
  t.vx = (Math.random() - 0.5) * 60;
  t.vy = -90 - Math.random() * 40;
  t.life = 0.8;
  t.max = 0.8;
  t.text = prefix ? prefix + numText(value) : numText(value);
  t.size = size;
  t.color = color;
  t.pop = 0.12;
  return t;
}

// Schnelle Treffer am selben Gegner zu einer Zahl zusammenfassen (weniger Gewusel beim MG)
export function addDamageText(ps, e, x, y, amount, crit) {
  const last = e.lastNum;
  if (last && last.owner === e.id && last.life > last.max - 0.3 && !crit && last.size < 20) {
    last.value += amount;
    last.text = numText(Math.round(last.value));
    last.pop = 0.08;
    last.life = Math.max(last.life, last.max - 0.1);
    return;
  }
  e.lastNum = emitText(ps, x, y, Math.round(amount), crit ? '#ffe23f' : '#ffffff', crit ? 20 : 14, '', e.id);
}

// Schwebender Text (z. B. Name eines Drops)
export function emitLabel(ps, x, y, text, color, size) {
  const t = ps.texts.spawn();
  if (!t) return;
  t.x = x;
  t.y = y;
  t.vx = 0;
  t.vy = -60;
  t.life = 1.1;
  t.max = 1.1;
  t.text = text;
  t.size = size;
  t.color = color;
  t.pop = 0.1;
  t.owner = 0;
}

export function updateParticles(ps, dt) {
  const pool = ps.pool;
  for (let i = pool.count - 1; i >= 0; i--) {
    const p = pool.items[i];
    if (p.stay > 0) {
      // Hülse liegt am Boden
      p.stay -= dt;
      if (p.stay <= 0) pool.release(i);
      continue;
    }
    p.life -= dt;
    if (p.life <= 0) {
      if (p.kind === PK.CASING) {
        p.stay = CONFIG.particles.casingStay;
        p.life = 0;
        continue;
      }
      pool.release(i);
      continue;
    }
    if (p.drag) {
      const f = Math.exp(-p.drag * dt);
      p.vx *= f;
      p.vy *= f;
    }
    if (p.gravity) p.vy += p.gravity * dt;
    if (p.kind === PK.TRAIL || p.kind === PK.BEAM) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.spin) p.rot += p.spin * dt;
  }
  const texts = ps.texts;
  for (let i = texts.count - 1; i >= 0; i--) {
    const t = texts.items[i];
    t.life -= dt;
    if (t.life <= 0) {
      texts.release(i);
      continue;
    }
    if (t.pop > 0) t.pop -= dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.vy *= Math.exp(-3 * dt);
  }
}

export function clearParticles(ps) {
  ps.pool.clear();
  ps.texts.clear();
}
