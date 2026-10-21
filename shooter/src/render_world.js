// Zeichnet Boden, Gitter, Brandflecken, Wände und Hindernisse.

import { CONFIG } from './config.js';
import { hexAlpha } from './sprites.js';
import { TAU, clamp } from './utils.js';

// Boden-Canvas für Brandflecken (halbe Auflösung der Welt)
const FLOOR_SCALE = 0.5;
let floor = null;
let floorCtx = null;
let floorFadeAcc = 0;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function resetFloor(world) {
  const w = Math.ceil(world.width * FLOOR_SCALE);
  const h = Math.ceil(world.height * FLOOR_SCALE);
  if (!floor || floor.width !== w || floor.height !== h) {
    floor = makeCanvas(w, h);
    floorCtx = floor.getContext('2d');
  }
  floorCtx.clearRect(0, 0, w, h);
  floorFadeAcc = 0;
}

// Brandfleck auf den Boden malen (bleibt dort und verblasst)
export function paintBurn(x, y, radius, strength = 1) {
  if (!floorCtx) return;
  const fx = x * FLOOR_SCALE;
  const fy = y * FLOOR_SCALE;
  const r = radius * FLOOR_SCALE;
  const g = floorCtx.createRadialGradient(fx, fy, 0, fx, fy, r);
  g.addColorStop(0, `rgba(10,6,4,${0.9 * strength})`);
  g.addColorStop(0.55, `rgba(40,16,6,${0.55 * strength})`);
  g.addColorStop(0.8, `rgba(120,50,10,${0.18 * strength})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  floorCtx.fillStyle = g;
  floorCtx.beginPath();
  floorCtx.arc(fx, fy, r, 0, TAU);
  floorCtx.fill();
  // Glutpunkte
  floorCtx.fillStyle = `rgba(255,120,40,${0.35 * strength})`;
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * TAU;
    const d = (0.3 + Math.random() * 0.6) * r;
    floorCtx.fillRect(fx + Math.cos(a) * d, fy + Math.sin(a) * d, 1.5, 1.5);
  }
}

// Brandflecken verblassen lassen (in burnFade Sekunden auf fast 0)
export function fadeFloor(dt) {
  if (!floorCtx) return;
  floorFadeAcc += dt;
  const stepTime = 0.5;
  if (floorFadeAcc < stepTime) return;
  floorFadeAcc -= stepTime;
  const steps = CONFIG.arena.burnFade / stepTime;
  const a = 1 - Math.pow(0.03, 1 / steps);
  floorCtx.save();
  floorCtx.globalCompositeOperation = 'destination-out';
  floorCtx.fillStyle = `rgba(0,0,0,${a})`;
  floorCtx.fillRect(0, 0, floor.width, floor.height);
  floorCtx.restore();
}

// Gitter, pulsierend im Takt (pulse 0..1)
export function drawGrid(ctx, world, view, pulse) {
  const C = CONFIG.colors;
  const gs = CONFIG.arena.gridSize;
  const x0 = clamp(Math.floor(view.left / gs) * gs, 0, world.width);
  const x1 = clamp(Math.ceil(view.right / gs) * gs, 0, world.width);
  const y0 = clamp(Math.floor(view.top / gs) * gs, 0, world.height);
  const y1 = clamp(Math.ceil(view.bottom / gs) * gs, 0, world.height);

  // Bodenfläche leicht heller als der Hintergrund außerhalb
  ctx.fillStyle = '#090a16';
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.lineWidth = 1.4;
  ctx.strokeStyle = C.grid;
  ctx.globalAlpha = 0.75 + 0.25 * pulse;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += gs) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let y = y0; y <= y1; y += gs) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
  // Jede vierte Linie etwas heller; beim Takt kurz aufleuchten
  ctx.strokeStyle = C.gridBright;
  ctx.globalAlpha = 0.18 + 0.32 * pulse;
  ctx.beginPath();
  const big = gs * 4;
  for (let x = Math.ceil(x0 / big) * big; x <= x1; x += big) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let y = Math.ceil(y0 / big) * big; y <= y1; y += big) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawFloor(ctx, world) {
  if (!floor) return;
  ctx.drawImage(floor, 0, 0, world.width, world.height);
}

// Leuchtende Kontur ohne shadowBlur: mehrere Striche mit abnehmender Breite
function glowStroke(ctx, color, width, glow) {
  ctx.strokeStyle = color;
  if (glow) {
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = width * 5;
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = width * 2.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function drawWalls(ctx, world, glow) {
  const C = CONFIG.colors;
  ctx.beginPath();
  ctx.rect(0, 0, world.width, world.height);
  glowStroke(ctx, C.wall, 4, glow);
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawObstacles(ctx, world, view, glow) {
  const C = CONFIG.colors;
  for (const o of world.obstacles) {
    const r = o.shape === 'rect' ? Math.max(o.w, o.h) : o.r;
    const cx = o.shape === 'rect' ? o.x + o.w / 2 : o.x;
    const cy = o.shape === 'rect' ? o.y + o.h / 2 : o.y;
    if (cx + r < view.left || cx - r > view.right || cy + r < view.top || cy - r > view.bottom) continue;
    ctx.beginPath();
    if (o.shape === 'rect') ctx.rect(o.x, o.y, o.w, o.h);
    else ctx.arc(o.x, o.y, o.r, 0, TAU);
    ctx.fillStyle = '#0d1030';
    ctx.fill();
    glowStroke(ctx, C.obstacle, 3, glow);
    // innere Linie für Tiefe
    ctx.beginPath();
    if (o.shape === 'rect') ctx.rect(o.x + 8, o.y + 8, Math.max(0, o.w - 16), Math.max(0, o.h - 16));
    else ctx.arc(o.x, o.y, Math.max(0, o.r - 10), 0, TAU);
    ctx.strokeStyle = hexAlpha(C.obstacle, 0.35);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
