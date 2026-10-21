// Zeichnet die Bosse mit ihren Ankündigungen (Weltmaßstab).

import { CONFIG } from './config.js';
import { drawSprite, drawSpriteSized, hexAlpha } from './sprites.js';
import { TAU, lerp, clamp } from './utils.js';

export function drawBosses(ctx, run, alpha, time) {
  for (const e of run.enemies) {
    if (e.dead || !e.boss) continue;
    const x = lerp(e.px, e.x, alpha);
    const y = lerp(e.py, e.y, alpha);
    const b = e.boss;
    let scale = 1;
    let a = 1;
    if (b.intro > 0) {
      // Erscheinen: Ringe ziehen sich zusammen, Boss blendet ein
      const k = 1 - b.intro / CONFIG.bosses.introTime;
      scale = 0.3 + 0.7 * k * k;
      a = 0.3 + 0.7 * k;
      for (let i = 0; i < 3; i++) {
        const r = e.r * (1 + (1 - ((k + i / 3) % 1)) * 3);
        ctx.strokeStyle = hexAlpha(b.color, 0.5 * a);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
      }
    }
    if (b.roar > 0) scale *= 1 + Math.sin(time * 40) * 0.05;
    if (e.squash > 0) scale *= 1 + (e.squash / 0.28) * 0.05 * Math.cos((1 - e.squash / 0.28) * Math.PI * 3);
    ctx.globalAlpha = a;
    if (b.kind === 'guardian') drawGuardian(ctx, e, x, y, scale, time);
    else drawBrood(ctx, e, x, y, scale, time);
    ctx.globalAlpha = 1;
  }
}

function drawGuardian(ctx, e, x, y, scale, time) {
  const b = e.boss;
  // Warnlinie des Ansturms (1 s vorher): ganzer Weg inklusive Abpraller
  if (b.charge === 'warn' && b.path.length >= 4) {
    const blink = 0.55 + 0.45 * Math.sin(time * 25);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexAlpha(CONFIG.colors.warning, 0.13);
    ctx.lineWidth = e.r * 2;
    ctx.beginPath();
    ctx.moveTo(b.path[0], b.path[1]);
    for (let i = 2; i < b.path.length; i += 2) ctx.lineTo(b.path[i], b.path[i + 1]);
    ctx.stroke();
    ctx.strokeStyle = hexAlpha(CONFIG.colors.warning, 0.8 * blink);
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -time * 120;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
  }
  const white = e.flash > 0;
  const shake = b.charge === 'warn' || b.roar > 0 ? 3 : 0;
  const ox = shake ? (Math.random() - 0.5) * shake * 2 : 0;
  const oy = shake ? (Math.random() - 0.5) * shake * 2 : 0;
  drawSprite(ctx, white ? 'guardian_ring_white' : 'guardian_ring', x + ox, y + oy, b.rot, scale, scale);
  // Kern leuchtet vor einem Angriff auf
  if (e.charging || b.charge === 'warn') {
    const k = 0.6 + 0.4 * Math.sin(time * 30);
    ctx.globalCompositeOperation = 'lighter';
    drawSpriteSized(ctx, 'glow_red', x, y, 120 * k * scale);
    ctx.globalCompositeOperation = 'source-over';
  }
  const core = 1 + Math.sin(time * 4) * 0.06 + (b.phase - 1) * 0.08;
  drawSprite(ctx, white ? 'guardian_core_white' : 'guardian_core', x + ox, y + oy, -b.rot * 2, core * scale, core * scale);
  // Phase 3: Funkenkranz
  if (b.phase >= 3) {
    ctx.strokeStyle = hexAlpha('#ffd23f', 0.6);
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = b.rot * 3 + (i / 6) * TAU;
      ctx.beginPath();
      ctx.arc(x, y, e.r + 12, a, a + 0.3);
      ctx.stroke();
    }
  }
}

function drawBrood(ctx, e, x, y, scale, time) {
  const c = CONFIG.bosses.brood;
  const b = e.boss;
  const r = e.r * scale;
  const n = 16;
  const pulse = 1 + Math.sin(time * 3.2 + b.wobble) * 0.05;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const wob = 1 + 0.08 * Math.sin(time * 3 + i * 1.7) + 0.05 * Math.sin(time * 5.3 + i * 2.9);
    const rr = r * wob * pulse;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const white = e.flash > 0;
  if (white) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
  } else {
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, hexAlpha(c.color, 0.55));
    g.addColorStop(0.6, hexAlpha(c.color2, 0.35));
    g.addColorStop(1, hexAlpha(c.color2, 0.15));
    ctx.fillStyle = g;
  }
  ctx.fill();
  // leuchtende Kontur (zwei Striche statt shadowBlur)
  ctx.strokeStyle = hexAlpha(c.color, 0.25);
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = white ? '#ffffff' : c.color;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Flecken / Augen
  ctx.fillStyle = hexAlpha(c.color2, 0.9);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3 + time * 0.4;
    const d = r * (0.3 + 0.25 * Math.sin(i * 2.1 + time));
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.09 * (1 + 0.3 * Math.sin(time * 4 + i)), 0, TAU);
    ctx.fill();
  }
  // Ankündigung der Säure: Klumpen bläht sich auf
  if (b.phase >= 2 && b.acidT < 0.6) {
    const k = clamp(1 - b.acidT / 0.6, 0, 1);
    ctx.strokeStyle = hexAlpha('#c9ff5a', 0.8 * k);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.15 + 0.15 * k), 0, TAU);
    ctx.stroke();
  }
}
