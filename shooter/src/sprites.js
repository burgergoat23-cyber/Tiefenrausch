// Leucht-Sprites: Formen werden einmal mit Glow auf Offscreen-Canvases gezeichnet
// und danach nur noch als Bild verwendet. Neu gebaut, wenn sich der Maßstab ändert.

import { CONFIG } from './config.js';
import { TAU } from './utils.js';
import { drawIcon } from './icons.js';

const sprites = new Map();
let builtScale = 0;
let glowEnabled = true;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function poly(ctx, n, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function pathPoints(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

// Zeichenvorschriften der Formen (Blick nach rechts, Welteinheiten)
const SHAPES = {
  player(ctx) {
    pathPoints(ctx, [24, 0, -13, -15, -6, 0, -13, 15]);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1, 0, 4.5, 0, TAU);
    ctx.stroke();
  },
  triangle(ctx) {
    poly(ctx, 3, 19, 0);
    ctx.fill();
    ctx.stroke();
  },
  arrow(ctx) {
    pathPoints(ctx, [17, 0, -11, -10, -4, 0, -11, 10]);
    ctx.fill();
    ctx.stroke();
  },
  square(ctx) {
    ctx.beginPath();
    ctx.rect(-16, -16, 32, 32);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(4, -5, 14, 10);
    ctx.stroke();
  },
  bomb(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, -12);
    ctx.quadraticCurveTo(18, -22, 24, -18);
    ctx.stroke();
  },
  hexagon(ctx) {
    poly(ctx, 6, 34, 0);
    ctx.fill();
    ctx.stroke();
    poly(ctx, 6, 18, TAU / 12);
    ctx.stroke();
  },
  pentagon(ctx, r = 23) {
    poly(ctx, 5, r, 0);
    ctx.fill();
    ctx.stroke();
    if (r > 15) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      }
      ctx.stroke();
    }
  },
  mini(ctx) {
    SHAPES.pentagon(ctx, 12);
  },
  shield(ctx) {
    ctx.beginPath();
    ctx.rect(-14, -18, 24, 36);
    ctx.fill();
    ctx.stroke();
    // Schild vorne
    ctx.save();
    ctx.lineWidth *= 2.4;
    ctx.beginPath();
    ctx.arc(-4, 0, 28, -Math.PI / 3, Math.PI / 3);
    ctx.stroke();
    ctx.restore();
  },
  egg(ctx) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 16, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  },
  guardianRing(ctx) {
    // Ring mit Lücken
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, 60, a + 0.08, a + TAU / 8 - 0.08);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, TAU);
    ctx.stroke();
  },
  guardianCore(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.stroke();
  },
};

// Radius (Welteinheiten), den eine Form mit Glow höchstens braucht
const EXTENT = {
  player: 28, triangle: 22, arrow: 20, square: 26, bomb: 28, hexagon: 38, pentagon: 26, mini: 15,
  shield: 34, egg: 19, guardianRing: 66, guardianCore: 26,
};

function buildShape(name, color, scale, white) {
  const glow = glowEnabled ? 10 : 0;
  const ext = EXTENT[name] + glow * 0.9;
  const size = Math.ceil(ext * 2 * scale);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = white ? '#ffffff' : color;
  ctx.fillStyle = white ? 'rgba(255,255,255,0.85)' : hexAlpha(color, 0.18);
  if (glow) {
    ctx.shadowColor = white ? '#ffffff' : color;
    ctx.shadowBlur = glow * scale;
  }
  SHAPES[name](ctx);
  // zweiter Durchgang ohne Schatten für eine klare Kontur
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = white ? '#ffffff' : lighten(color, 0.45);
  SHAPES[name](ctx);
  return { canvas: c, size: size / scale };
}

// Weicher Leuchtpunkt (für Kugeln und Partikel)
function buildDot(color, radius, scale, core = true) {
  const ext = radius * 3;
  const size = Math.max(4, Math.ceil(ext * 2 * scale));
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, core ? '#ffffff' : color);
  g.addColorStop(0.22, color);
  g.addColorStop(0.45, hexAlpha(color, 0.35));
  g.addColorStop(1, hexAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return { canvas: c, size: size / scale };
}

// Drop: Kreis in Power-up-Farbe mit weißem Rand und Symbol
function buildPickup(id, color, scale) {
  const r = 15;
  const ext = r + 12;
  const size = Math.ceil(ext * 2 * scale);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.shadowColor = color;
  ctx.shadowBlur = glowEnabled ? 12 * scale : 0;
  ctx.fillStyle = hexAlpha(color, 0.28);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, 0, TAU);
  ctx.stroke();
  drawIcon(ctx, id, 0, 0, 17, color === '#ffffff' ? '#ffffff' : lighten(color, 0.35), 2.2);
  return { canvas: c, size: size / scale };
}

export function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function lighten(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * t);
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * t);
  const b = Math.round((n & 255) + (255 - (n & 255)) * t);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Alle Sprites für den Maßstab (Pixel pro Welteinheit) bauen
export function buildSprites(scale, glow = true) {
  if (Math.abs(scale - builtScale) < 0.01 && glow === glowEnabled && sprites.size) return;
  builtScale = scale;
  glowEnabled = glow;
  sprites.clear();
  const C = CONFIG.colors;
  sprites.set('player', buildShape('player', C.player, scale, false));
  sprites.set('player_white', buildShape('player', C.player, scale, true));
  for (const [id, def] of Object.entries(CONFIG.enemies)) {
    const shape = id === 'mini' ? 'mini' : def.shape;
    sprites.set('enemy_' + id, buildShape(shape, def.color, scale, false));
    sprites.set('enemy_' + id + '_white', buildShape(shape, def.color, scale, true));
  }
  const gc = CONFIG.bosses.guardian.color;
  sprites.set('guardian_ring', buildShape('guardianRing', gc, scale, false));
  sprites.set('guardian_ring_white', buildShape('guardianRing', gc, scale, true));
  sprites.set('guardian_core', buildShape('guardianCore', '#ffd23f', scale, false));
  sprites.set('guardian_core_white', buildShape('guardianCore', '#ffd23f', scale, true));
  sprites.set('bullet_player', buildDot(C.playerBullet, 4, scale));
  sprites.set('bullet_enemy', buildDot(C.enemyBullet, 9, scale));
  sprites.set('bullet_boss', buildDot(C.enemyBullet, 11, scale));
  sprites.set('rocket_glow', buildDot('#ff9a2f', 9, scale));
  sprites.set('glow_white', buildDot('#ffffff', 10, scale, false));
  sprites.set('glow_player', buildDot(C.player, 12, scale, false));
  sprites.set('glow_red', buildDot('#ff3b4d', 10, scale, false));
  for (const [id, def] of Object.entries(CONFIG.powerups)) {
    if (!def.color) continue;
    sprites.set('glow_' + id, buildDot(def.color, 12, scale, false));
    sprites.set('pickup_' + id, buildPickup(id, def.color, scale));
  }
  for (const id of CONFIG.weapons.order) sprites.set('pickup_' + id, buildPickup(id, '#ffffff', scale));
}

export function getSprite(name) {
  return sprites.get(name);
}

export function spriteScale() {
  return builtScale;
}

// Sprite zentriert zeichnen (ctx steht im Weltmaßstab)
export function drawSprite(ctx, name, x, y, angle = 0, sx = 1, sy = 1) {
  const s = sprites.get(name);
  if (!s) return;
  const half = s.size / 2;
  if (angle === 0 && sx === 1 && sy === 1) {
    ctx.drawImage(s.canvas, x - half, y - half, s.size, s.size);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.drawImage(s.canvas, -half, -half, s.size, s.size);
  ctx.restore();
}

// Sprite mit eigener Größe (z. B. Kugeln mit Radius r)
export function drawSpriteSized(ctx, name, x, y, size) {
  const s = sprites.get(name);
  if (!s) return;
  ctx.drawImage(s.canvas, x - size / 2, y - size / 2, size, size);
}
