// Arena und Hindernisse. Reine Logik: Layouts, Kollision mit Wänden, Sichtlinien, Spawnpunkte.

import { CONFIG } from './config.js';
import {
  pushCircleOutOfRect, pushCircleOutOfCircle, segmentRect, segmentCircle, circleRect, circleCircle,
} from './collision.js';
import { clamp, dist2, randRange, TAU } from './utils.js';

// Hindernisse: { shape: 'rect', x, y, w, h } (linke obere Ecke) oder { shape: 'circle', x, y, r }
const R = (x, y, w, h) => ({ shape: 'rect', x, y, w, h });
const C = (x, y, r) => ({ shape: 'circle', x, y, r });

// Vier Vorlagen für 2400 × 1600. Um die Mitte (1200, 800) bleiben 300 Einheiten frei.
export const LAYOUTS = [
  {
    name: 'Säulenhalle',
    obstacles: [
      C(520, 420, 52), C(1880, 420, 52), C(520, 1180, 52), C(1880, 1180, 52),
      C(1200, 320, 46), C(1200, 1280, 46), C(740, 800, 42), C(1660, 800, 42),
    ],
  },
  {
    name: 'Blöcke',
    obstacles: [
      R(300, 300, 230, 80), R(1870, 300, 230, 80), R(300, 1220, 230, 80), R(1870, 1220, 230, 80),
      R(690, 620, 80, 360), R(1630, 620, 80, 360), R(1050, 230, 300, 70), R(1050, 1300, 300, 70),
    ],
  },
  {
    name: 'Ecken',
    obstacles: [
      R(520, 420, 260, 60), R(520, 480, 60, 200),
      R(1620, 420, 260, 60), R(1820, 480, 60, 200),
      R(520, 1120, 260, 60), R(520, 920, 60, 200),
      R(1620, 1120, 260, 60), R(1820, 920, 60, 200),
      C(1200, 330, 48), C(1200, 1270, 48),
    ],
  },
  {
    name: 'Ring',
    obstacles: [
      C(1720, 800, 56), C(1460, 1160, 56), C(940, 1160, 56),
      C(680, 800, 56), C(940, 440, 56), C(1460, 440, 56),
      R(230, 600, 60, 400), R(2110, 600, 60, 400),
    ],
  },
];

export function createWorld(layoutIndex, cfg = CONFIG.arena) {
  const layout = LAYOUTS[layoutIndex % LAYOUTS.length];
  const obstacles = layout.obstacles.map((o) => ({ ...o }));
  return {
    width: cfg.width,
    height: cfg.height,
    layoutIndex: layoutIndex % LAYOUTS.length,
    layoutName: layout.name,
    obstacles,
    startX: cfg.width / 2,
    startY: cfg.height / 2,
    coverPoints: buildCoverPoints(obstacles),
  };
}

// Punkte direkt neben jedem Hindernis (für Spawns "hinter Hindernissen")
function buildCoverPoints(obstacles) {
  const pts = [];
  const pad = 55;
  for (const o of obstacles) {
    if (o.shape === 'rect') {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      pts.push({ x: o.x - pad, y: cy, ox: cx, oy: cy });
      pts.push({ x: o.x + o.w + pad, y: cy, ox: cx, oy: cy });
      pts.push({ x: cx, y: o.y - pad, ox: cx, oy: cy });
      pts.push({ x: cx, y: o.y + o.h + pad, ox: cx, oy: cy });
    } else {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        pts.push({ x: o.x + Math.cos(a) * (o.r + pad), y: o.y + Math.sin(a) * (o.r + pad), ox: o.x, oy: o.y });
      }
    }
  }
  return pts;
}

const tmpNormal = { nx: 0, ny: 0 };

// Kreis-Objekt (mit x, y) aus Wänden und Hindernissen schieben.
// Rückgabe: 0 = frei, 1 = Wand/Hindernis berührt. Normale der letzten Kollision in out.
export function resolveCircle(world, e, r, out) {
  let hit = 0;
  let nx = 0;
  let ny = 0;
  if (e.x < r) { e.x = r; hit = 1; nx = 1; }
  else if (e.x > world.width - r) { e.x = world.width - r; hit = 1; nx = -1; }
  if (e.y < r) { e.y = r; hit = 1; ny = 1; }
  else if (e.y > world.height - r) { e.y = world.height - r; hit = 1; ny = -1; }
  const obs = world.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    const pushed = o.shape === 'rect'
      ? pushCircleOutOfRect(e, r, o, tmpNormal)
      : pushCircleOutOfCircle(e, r, o, tmpNormal);
    if (pushed) { hit = 1; nx = tmpNormal.nx; ny = tmpNormal.ny; }
  }
  if (out) { out.nx = nx; out.ny = ny; }
  return hit;
}

// Liegt ein Kreis in einem Hindernis oder außerhalb der Arena?
export function circleBlocked(world, x, y, r) {
  if (x < r || y < r || x > world.width - r || y > world.height - r) return true;
  const obs = world.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.shape === 'rect' ? circleRect(x, y, r, o.x, o.y, o.w, o.h) : circleCircle(x, y, r, o.x, o.y, o.r)) {
      return true;
    }
  }
  return false;
}

// Strecke gegen alle Hindernisse (nicht gegen die Außenwand). Rückgabe: kleinstes t oder -1.
export function segmentObstacles(world, x1, y1, x2, y2, out) {
  let best = -1;
  const obs = world.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    let t;
    if (o.shape === 'rect') {
      t = segmentRect(x1, y1, x2, y2, o.x, o.y, o.w, o.h, tmpNormal);
    } else {
      t = segmentCircle(x1, y1, x2, y2, o.x, o.y, o.r);
      if (t >= 0) {
        const hx = x1 + (x2 - x1) * t - o.x;
        const hy = y1 + (y2 - y1) * t - o.y;
        const d = Math.sqrt(hx * hx + hy * hy) || 1;
        tmpNormal.nx = hx / d;
        tmpNormal.ny = hy / d;
      }
    }
    if (t >= 0 && (best < 0 || t < best)) {
      best = t;
      if (out) { out.nx = tmpNormal.nx; out.ny = tmpNormal.ny; }
    }
  }
  return best;
}

export function lineOfSight(world, x1, y1, x2, y2) {
  return segmentObstacles(world, x1, y1, x2, y2, null) < 0;
}

// Strahl bis zur ersten Wand oder zum ersten Hindernis. Rückgabe: Entfernung.
export function raycast(world, ox, oy, dx, dy, maxLen, out) {
  let len = maxLen;
  let nx = 0;
  let ny = 0;
  // Außenwand
  if (dx > 1e-9) { const t = (world.width - ox) / dx; if (t < len) { len = t; nx = -1; ny = 0; } }
  else if (dx < -1e-9) { const t = -ox / dx; if (t < len) { len = t; nx = 1; ny = 0; } }
  if (dy > 1e-9) { const t = (world.height - oy) / dy; if (t < len) { len = t; nx = 0; ny = -1; } }
  else if (dy < -1e-9) { const t = -oy / dy; if (t < len) { len = t; nx = 0; ny = 1; } }
  const t = segmentObstacles(world, ox, oy, ox + dx * len, oy + dy * len, tmpNormal);
  if (t >= 0) { len *= t; nx = tmpNormal.nx; ny = tmpNormal.ny; }
  if (out) { out.nx = nx; out.ny = ny; }
  return Math.max(0, len);
}

// Zufälliger freier Punkt am Arena-Rand
export function edgePoint(world, rng, inset = 70) {
  const w = world.width;
  const h = world.height;
  const perim = 2 * (w + h);
  let p = rng() * perim;
  if (p < w) return { x: p, y: inset };
  p -= w;
  if (p < h) return { x: w - inset, y: p };
  p -= h;
  if (p < w) return { x: w - p, y: h - inset };
  p -= w;
  return { x: inset, y: h - p };
}

// Freier Punkt irgendwo in der Arena
export function anyPoint(world, rng, margin = 80) {
  return {
    x: randRange(rng, margin, world.width - margin),
    y: randRange(rng, margin, world.height - margin),
  };
}

// Deckungspunkt, der vom Spieler aus hinter einem Hindernis liegt
export function coverPoint(world, rng, px, py, minDist) {
  const cands = [];
  for (const c of world.coverPoints) {
    // Punkt muss auf der dem Spieler abgewandten Seite liegen
    const toObsX = c.ox - px;
    const toObsY = c.oy - py;
    const toPtX = c.x - c.ox;
    const toPtY = c.y - c.oy;
    if (toObsX * toPtX + toObsY * toPtY <= 0) continue;
    if (dist2(px, py, c.x, c.y) < minDist * minDist) continue;
    cands.push(c);
  }
  if (cands.length === 0) return null;
  const c = cands[Math.floor(rng() * cands.length)];
  return { x: c.x, y: c.y };
}

// Schiebt einen Punkt in die Arena und aus Hindernissen heraus
export function clampToFree(world, p, r) {
  p.x = clamp(p.x, r + 4, world.width - r - 4);
  p.y = clamp(p.y, r + 4, world.height - r - 4);
  resolveCircle(world, p, r + 4, null);
  return p;
}
