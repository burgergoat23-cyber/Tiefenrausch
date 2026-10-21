// Zeichnet Spieler, Gegner, Projektile und Drops (im Weltmaßstab).

import { CONFIG } from './config.js';
import { drawSprite, hexAlpha } from './sprites.js';
import { TAU, lerp } from './utils.js';
import { dashMaxCharges } from './player.js';

export function drawPlayer(ctx, run, alpha, time, settings) {
  const p = run.player;
  if (p.dead) return;
  const x = lerp(p.px, p.x, alpha);
  const y = lerp(p.py, p.y, alpha);

  // Ziellinie (dünn, halbtransparent)
  if (settings.aimLine) {
    const len = 240;
    const g = ctx.createLinearGradient(x, y, x + Math.cos(p.aim) * len, y + Math.sin(p.aim) * len);
    g.addColorStop(0, hexAlpha(CONFIG.colors.player, 0.35));
    g.addColorStop(1, hexAlpha(CONFIG.colors.player, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(p.aim) * 26, y + Math.sin(p.aim) * 26);
    ctx.lineTo(x + Math.cos(p.aim) * len, y + Math.sin(p.aim) * len);
    ctx.stroke();
  }

  // Schild-Blase
  const sh = run.power.shield;
  if (sh.amount > 0) {
    const wob = 1 + Math.sin(time * 6) * 0.03;
    ctx.strokeStyle = hexAlpha(CONFIG.powerups.shield.color, 0.8);
    ctx.fillStyle = hexAlpha(CONFIG.powerups.shield.color, 0.1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 30 * wob, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // Dash-Abklingzeit als Ring
  const maxC = dashMaxCharges(run);
  if (p.dashCharges < maxC) {
    const prog = p.dashRecharge / CONFIG.dash.cooldown;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(63,243,255,0.15)';
    ctx.beginPath();
    ctx.arc(x, y, 27, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(63,243,255,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, 27, -Math.PI / 2, -Math.PI / 2 + prog * TAU);
    ctx.stroke();
  }
  if (maxC > 1) {
    for (let i = 0; i < maxC; i++) {
      ctx.fillStyle = i < p.dashCharges ? '#3ff3ff' : 'rgba(63,243,255,0.2)';
      ctx.beginPath();
      ctx.arc(x - 6 + i * 12, y + 34, 3, 0, TAU);
      ctx.fill();
    }
  }

  // Blinken nach Treffer
  if (p.invuln > 0 && Math.floor(time * 18) % 2 === 0) return;
  const white = p.invuln > CONFIG.player.invulnAfterHit - 0.08;

  // Streckung in Bewegungsrichtung
  const st = CONFIG.player.stretch * p.moving;
  const va = Math.atan2(p.vy, p.vx);
  ctx.save();
  ctx.translate(x, y);
  if (st > 0.01) {
    ctx.rotate(va);
    ctx.scale(1 + st, 1 - st * 0.6);
    ctx.rotate(p.aim - va);
  } else {
    ctx.rotate(p.aim);
  }
  if (p.dashT > 0) ctx.globalAlpha = 0.85;
  drawSprite(ctx, white ? 'player_white' : 'player', 0, 0);
  ctx.globalAlpha = 1;
  ctx.restore();
}
