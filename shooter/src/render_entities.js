// Zeichnet Spieler, Gegner, Projektile und Drops (im Weltmaßstab).

import { CONFIG } from './config.js';
import { drawSprite, drawSpriteSized, hexAlpha } from './sprites.js';
import { raycast } from './world.js';
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

// Drops: schweben, drehen sich langsam, pulsieren, blinken kurz vor dem Verschwinden
export function drawPickups(ctx, run, alpha, time, view) {
  const blinkTime = CONFIG.drops.blinkTime;
  for (const pk of run.pickups) {
    const x = lerp(pk.px, pk.x, alpha);
    const y = lerp(pk.py, pk.y, alpha) + Math.sin(time * 3 + pk.seed) * 3;
    if (x < view.left || x > view.right || y < view.top || y > view.bottom) continue;
    const left = pk.life - pk.age;
    if (left < blinkTime && !pk.magnet && Math.floor(time * (left < 1 ? 14 : 7)) % 2 === 0) continue;
    const pulse = 1 + Math.sin(time * 5 + pk.seed) * 0.08;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    drawSpriteSized(ctx, pk.kind === 'weapon' ? 'glow_white' : 'glow_' + pk.id, x, y, 60 * pulse);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSprite(ctx, 'pickup_' + pk.id, x, y, pk.kind === 'weapon' ? Math.sin(time * 1.2 + pk.seed) * 0.4 : 0, pulse, pulse);
  }
}

// Railgun: dünne Linie zeigt beim Aufladen, wohin der Strahl geht
export function drawRailPreview(ctx, run, alpha) {
  const ars = run.arsenal;
  const p = run.player;
  if (ars.current !== 'rail' || ars.railCharge <= 0 || p.dead) return;
  const x = lerp(p.px, p.x, alpha);
  const y = lerp(p.py, p.y, alpha);
  const dx = Math.cos(p.aim);
  const dy = Math.sin(p.aim);
  const len = raycast(run.world, x, y, dx, dy, CONFIG.weapons.rail.range, null);
  const k = Math.min(1, ars.railCharge / CONFIG.weapons.rail.charge);
  ctx.strokeStyle = `rgba(159,252,255,${0.25 + 0.6 * k})`;
  ctx.lineWidth = 1 + k * 1.5;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -k * 60;
  ctx.beginPath();
  ctx.moveTo(x + dx * 24, y + dy * 24);
  ctx.lineTo(x + dx * len, y + dy * len);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalCompositeOperation = 'lighter';
  drawSpriteSized(ctx, 'glow_white', x + dx * 24, y + dy * 24, 10 + 30 * k);
  ctx.globalCompositeOperation = 'source-over';
}
