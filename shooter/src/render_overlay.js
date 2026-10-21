// Warnkreise beim Spawnen, Dunkelheit (Spezialwelle) und Pfeile für Gegner außerhalb des Bildschirms.

import { CONFIG } from './config.js';
import { hexAlpha } from './sprites.js';
import { TAU, clamp, lerp } from './utils.js';

// Roter blinkender Kreis am Spawnpunkt (Weltmaßstab)
export function drawSpawnWarnings(ctx, run, time) {
  const list = run.waves.warnings;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const def = CONFIG.enemies[s.type];
    const k = 1 - Math.max(0, s.t) / s.max;
    const blink = Math.floor(time * (8 + 10 * k)) % 2 === 0;
    const r = def.radius + 10;
    ctx.fillStyle = hexAlpha(CONFIG.colors.warning, blink ? 0.22 : 0.08);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexAlpha(CONFIG.colors.warning, blink ? 0.95 : 0.5);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, TAU);
    ctx.stroke();
    // Fortschritt als innerer Kreis in Gegnerfarbe
    ctx.strokeStyle = hexAlpha(def.color, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 0.55, -Math.PI / 2, -Math.PI / 2 + k * TAU);
    ctx.stroke();
  }
}

// Dunkelheit: nur ein Lichtkreis um den Spieler (Weltmaßstab). amount 0..1
export function drawDarkness(ctx, run, view, alpha, amount) {
  if (amount <= 0.01) return;
  const p = run.player;
  const x = lerp(p.px, p.x, alpha);
  const y = lerp(p.py, p.y, alpha);
  const r = CONFIG.waves.darknessRadius;
  const g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r);
  g.addColorStop(0, 'rgba(2,2,8,0)');
  g.addColorStop(1, `rgba(2,2,8,${0.95 * amount})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(2,2,8,${0.95 * amount})`;
  ctx.beginPath();
  ctx.rect(view.left - 50, view.top - 50, view.right - view.left + 100, view.bottom - view.top + 100);
  ctx.arc(x, y, r - 0.5, 0, TAU, true);
  ctx.fill('evenodd');
  // Gegner bleiben als glühende Augen erkennbar
  ctx.fillStyle = `rgba(255,60,80,${0.75 * amount})`;
  for (const e of run.enemies) {
    if (e.dead) continue;
    const ex = lerp(e.px, e.x, alpha);
    const ey = lerp(e.py, e.y, alpha);
    const dx = ex - x;
    const dy = ey - y;
    if (dx * dx + dy * dy < r * r * 0.5) continue;
    const s = Math.max(2, e.r * 0.18);
    ctx.fillRect(ex - s * 2, ey - s / 2, s, s);
    ctx.fillRect(ex + s, ey - s / 2, s, s);
  }
}

// --- Bildschirm-Ebene: Pfeile am Rand ---------------------------------------------

function edgePos(cx, cy, dx, dy, halfW, halfH, out) {
  const tx = Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  out.x = cx + dx * t;
  out.y = cy + dy * t;
  return out;
}

const pos = { x: 0, y: 0 };

function arrow(ctx, x, y, angle, size, color, outline) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, -size * 0.7);
  ctx.lineTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.7, size * 0.7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

// cam: Kamera (ohne Shake), layout: { w, h, safe }
export function drawOffscreen(ctx, run, cam, alpha, layout, time) {
  const { w, h, safe } = layout;
  const margin = 16;
  const cx = (safe.left + w - safe.right) / 2;
  const cy = (safe.top + h - safe.bottom) / 2;
  const halfW = (w - safe.left - safe.right) / 2 - margin;
  const halfH = (h - safe.top - safe.bottom) / 2 - margin;
  const camX = lerp(cam.px, cam.x, alpha);
  const camY = lerp(cam.py, cam.y, alpha);
  const z = cam.zoom;
  for (const e of run.enemies) {
    if (e.dead) continue;
    const sx = (lerp(e.px, e.x, alpha) - camX) * z + w / 2;
    const sy = (lerp(e.py, e.y, alpha) - camY) * z + h / 2;
    const rr = e.r * z;
    if (sx > -rr && sx < w + rr && sy > -rr && sy < h + rr) continue;
    const dx = sx - cx;
    const dy = sy - cy;
    const a = Math.atan2(dy, dx);
    edgePos(cx, cy, dx, dy, halfW, halfH, pos);
    if (e.boss) {
      const pulse = 1 + 0.25 * Math.sin(time * 8);
      arrow(ctx, pos.x, pos.y, a, 16 * pulse, e.boss.color, '#ffffff');
    } else if (e.marked) {
      arrow(ctx, pos.x, pos.y, a, 11, e.def.color, '#ffffff');
    } else {
      ctx.globalAlpha = 0.85;
      arrow(ctx, pos.x, pos.y, a, 7, e.def.color, null);
      ctx.globalAlpha = 1;
    }
  }
  // Gegnerische Kugeln, die gleich von außen hereinkommen: kurzer Warnstrich
  const pool = run.projectiles.enemy;
  ctx.strokeStyle = CONFIG.colors.enemyBullet;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < pool.count; i++) {
    const b = pool.items[i];
    const sx = (b.x - camX) * z + w / 2;
    const sy = (b.y - camY) * z + h / 2;
    if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
    const fx = sx + b.vx * 0.8 * z;
    const fy = sy + b.vy * 0.8 * z;
    if (!(fx > 0 && fx < w && fy > 0 && fy < h)) continue;
    const ex = clamp(sx, safe.left + 6, w - safe.right - 6);
    const ey = clamp(sy, safe.top + 6, h - safe.bottom - 6);
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
    const blink = 0.6 + 0.4 * Math.sin(time * 30);
    ctx.globalAlpha = blink;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + (b.vx / sp) * 18, ey + (b.vy / sp) * 18);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
