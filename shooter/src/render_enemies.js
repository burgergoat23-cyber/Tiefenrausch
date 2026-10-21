// Zeichnet Gegner mit ihren Vorwarnungen sowie Projektile und Bodengefahren (Weltmaßstab).

import { CONFIG } from './config.js';
import { drawSprite, drawSpriteSized, hexAlpha } from './sprites.js';
import { TAU, lerp } from './utils.js';
import { SQUASH_TIME } from './enemies.js';

// Drehung: Formen mit Blickrichtung drehen sich mit, runde/vieleckige langsam von selbst
const SPIN = { hexagon: 0.4, pentagon: 1.2, bomb: 0, egg: 0 };

function enemyAngle(e, time) {
  const shape = e.def.shape;
  if (shape in SPIN) return SPIN[shape] ? time * SPIN[shape] + e.id : 0;
  return e.angle;
}

export function drawEnemies(ctx, run, alpha, time, view) {
  const list = run.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead || e.boss) continue;
    const x = lerp(e.px, e.x, alpha);
    const y = lerp(e.py, e.y, alpha);
    if (x + 120 < view.left || x - 120 > view.right || y + 120 < view.top || y - 120 > view.bottom) continue;
    drawTelegraph(ctx, e, x, y, time);
    let sx = 1;
    let sy = 1;
    if (e.squash > 0) {
      // Stauchen und zurückfedern (gedämpfte Schwingung)
      const k = e.squash / SQUASH_TIME;
      const s = CONFIG.juice.squash * k * Math.cos((1 - k) * Math.PI * 3);
      sx = 1 - s;
      sy = 1 + s * 0.8;
    }
    if (e.popIn > 0) {
      const k = 1 - e.popIn / 0.25;
      sx *= k;
      sy *= k;
    }
    let ox = 0;
    let oy = 0;
    if (e.state === 'pause' || e.state === 'windup') {
      ox = (Math.random() - 0.5) * 3;
      oy = (Math.random() - 0.5) * 3;
    }
    const white = e.flash > 0 || (e.state === 'fuse' && Math.floor(time * (6 + 18 * (1 - e.stateT))) % 2 === 0);
    const name = 'enemy_' + e.type + (white ? '_white' : '');
    drawSprite(ctx, name, x + ox, y + oy, enemyAngle(e, time), sx, sy);
    if (e.marked) drawMarker(ctx, x, y - e.r - 22, time, e.def.color);
  }
}

function drawTelegraph(ctx, e, x, y, time) {
  if (e.type === 'shooter' && e.charging) {
    // leuchtet vor dem Schuss auf
    const k = 1 - Math.max(0, e.timerA) / e.def.telegraph;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4 + 0.6 * k;
    drawSpriteSized(ctx, 'glow_red', x, y, 40 + 40 * k);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  } else if (e.type === 'bomber' && e.state === 'fuse') {
    // Explosionsradius als Warnkreis, füllt sich
    const k = 1 - Math.max(0, e.stateT) / e.def.fuse;
    const r = e.def.blastRadius;
    ctx.fillStyle = hexAlpha(CONFIG.colors.warning, 0.08 + 0.12 * k);
    ctx.beginPath();
    ctx.arc(x, y, r * k, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexAlpha(CONFIG.colors.warning, 0.5 + 0.4 * Math.sin(time * 30));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  } else if (e.type === 'tank' && e.state === 'windup') {
    const k = 1 - Math.max(0, e.stateT) / e.def.stompWindup;
    ctx.strokeStyle = hexAlpha(e.def.color, 0.3 + 0.6 * k);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, e.r + 6 + 20 * (1 - k), 0, TAU);
    ctx.stroke();
  } else if (e.type === 'sprinter' && e.state === 'pause') {
    // kurze Linie in Sprint-Richtung
    const len = 70;
    ctx.strokeStyle = hexAlpha(e.def.color, 0.55);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(e.angle) * len, y + Math.sin(e.angle) * len);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (e.type === 'egg') {
    const k = 1 - Math.max(0, e.stateT) / e.def.hatchTime;
    const pulse = 0.5 + 0.5 * Math.sin(time * (4 + 16 * k));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2 + 0.5 * k * pulse;
    drawSpriteSized(ctx, 'glow_white', x, y, 30 + 20 * k);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// Pfeil über den letzten Gegnern einer Welle
export function drawMarker(ctx, x, y, time, color) {
  const bob = Math.sin(time * 6) * 4;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + 8 + bob);
  ctx.lineTo(x - 8, y - 4 + bob);
  ctx.lineTo(x + 8, y - 4 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawPlayerProjectiles(ctx, run, alpha, view) {
  const pool = run.projectiles.player;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < pool.count; i++) {
    const b = pool.items[i];
    const x = lerp(b.px, b.x, alpha);
    const y = lerp(b.py, b.y, alpha);
    if (x < view.left || x > view.right || y < view.top || y > view.bottom) continue;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
    if (b.kind === 'rocket') {
      const a = Math.atan2(b.vy, b.vx);
      drawSpriteSized(ctx, 'rocket_glow', x - Math.cos(a) * 8, y - Math.sin(a) * 8, 34);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#ffe0b0';
      ctx.fillRect(-9, -3.5, 16, 7);
      ctx.restore();
      continue;
    }
    // heller Streifen in Flugrichtung
    const len = Math.min(26, sp * 0.022);
    ctx.strokeStyle = 'rgba(160,255,255,0.55)';
    ctx.lineWidth = b.r * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (b.vx / sp) * len, y - (b.vy / sp) * len);
    ctx.stroke();
    drawSpriteSized(ctx, 'bullet_player', x, y, b.r * 6);
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function drawEnemyProjectiles(ctx, run, alpha, time, view) {
  const pool = run.projectiles.enemy;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < pool.count; i++) {
    const b = pool.items[i];
    const x = lerp(b.px, b.x, alpha);
    const y = lerp(b.py, b.y, alpha);
    if (x < view.left - 30 || x > view.right + 30 || y < view.top - 30 || y > view.bottom + 30) continue;
    const pulse = 1 + Math.sin(time * 20 + i) * 0.08;
    drawSpriteSized(ctx, b.kind === 'boss' ? 'bullet_boss' : 'bullet_enemy', x, y, b.r * 6 * pulse);
  }
  ctx.globalCompositeOperation = 'source-over';
  // klarer weißer Kern über dem Glühen
  ctx.fillStyle = '#ffe8ef';
  for (let i = 0; i < pool.count; i++) {
    const b = pool.items[i];
    const x = lerp(b.px, b.x, alpha);
    const y = lerp(b.py, b.y, alpha);
    if (x < view.left || x > view.right || y < view.top || y > view.bottom) continue;
    ctx.beginPath();
    ctx.arc(x, y, b.r * 0.45, 0, TAU);
    ctx.fill();
  }
}

// Bodengefahren: Schockwellen, Säure, Säure-Geschosse
export function drawHazards(ctx, run, time) {
  for (const h of run.hazards) {
    if (h.kind === 'wave') {
      const fade = 1 - h.r / h.maxR;
      ctx.strokeStyle = hexAlpha('#7dff3a', 0.25 * fade + 0.15);
      ctx.lineWidth = h.thickness * 1.8;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = hexAlpha('#e0ffd0', 0.6 * fade + 0.3);
      ctx.lineWidth = h.thickness * 0.5;
      ctx.stroke();
    } else if (h.kind === 'acid') {
      const k = Math.min(1, h.t / 0.25) * Math.min(1, (h.life - h.t) / 0.5);
      ctx.fillStyle = hexAlpha('#8dff3a', 0.22 * k);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * (0.95 + 0.05 * Math.sin(time * 5)), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = hexAlpha('#c9ff5a', 0.7 * k);
      ctx.lineWidth = 2;
      ctx.stroke();
      // Blasen
      ctx.fillStyle = hexAlpha('#e6ffb0', 0.6 * k);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7 + time * 0.7;
        const r = ((time * 0.5 + i * 0.37) % 1) * h.radius * 0.8;
        ctx.beginPath();
        ctx.arc(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, 3, 0, TAU);
        ctx.fill();
      }
    } else if (h.kind === 'glob') {
      // Zielkreis am Boden (Vorwarnung) und fliegendes Geschoss
      const k = h.t / h.flight;
      const r = CONFIG.bosses.brood.acidRadius;
      ctx.strokeStyle = hexAlpha(CONFIG.colors.warning, 0.5 + 0.4 * Math.sin(time * 20));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = hexAlpha(CONFIG.colors.warning, 0.12 * k);
      ctx.beginPath();
      ctx.arc(h.x, h.y, r * k, 0, TAU);
      ctx.fill();
      const gx = lerp(h.x0, h.x, k);
      const gy = lerp(h.y0, h.y, k) - Math.sin(k * Math.PI) * 140;
      ctx.globalCompositeOperation = 'lighter';
      drawSpriteSized(ctx, 'glow_heal', gx, gy, 46);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
