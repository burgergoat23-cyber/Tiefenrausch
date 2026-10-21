// Zeichnet Partikel und Schadenszahlen (Weltmaßstab).

import { PK } from './particles.js';
import { drawSprite, drawSpriteSized } from './sprites.js';
import { FONT } from './ui.js';
import { TAU } from './utils.js';

// Ebene 0: Boden (Hülsen, Rauch) – vor den Figuren
export function drawParticlesFloor(ctx, ps, view) {
  const pool = ps.pool;
  for (let i = 0; i < pool.count; i++) {
    const p = pool.items[i];
    if (p.kind !== PK.CASING && p.kind !== PK.SMOKE) continue;
    if (p.x < view.left || p.x > view.right || p.y < view.top || p.y > view.bottom) continue;
    if (p.kind === PK.CASING) {
      const a = p.stay > 0 ? Math.min(1, p.stay / 0.4) : 1;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
      ctx.restore();
    } else {
      const t = 1 - p.life / p.max;
      const r = p.size + (p.size2 - p.size) * t;
      ctx.globalAlpha = 0.45 * (p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Ebene 1: leuchtende Effekte (additiv)
export function drawParticlesTop(ctx, ps, view) {
  const pool = ps.pool;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < pool.count; i++) {
    const p = pool.items[i];
    const k = p.kind;
    if (k === PK.CASING || k === PK.SMOKE) continue;
    if (k !== PK.BEAM && (p.x < view.left || p.x > view.right || p.y < view.top || p.y > view.bottom)) continue;
    const life = p.life / p.max;
    switch (k) {
      case PK.SPARK: {
        ctx.globalAlpha = life;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
        break;
      }
      case PK.TRAIL: {
        ctx.globalAlpha = life * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * (0.4 + 0.6 * life);
        ctx.beginPath();
        ctx.moveTo(p.x2, p.y2);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        break;
      }
      case PK.DOT:
      case PK.IMPLODE: {
        ctx.globalAlpha = Math.min(1, life * 1.4);
        ctx.fillStyle = p.color;
        const r = Math.max(0.5, p.size * life);
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        break;
      }
      case PK.RING: {
        const t = 1 - life;
        const r = p.size + (p.size2 - p.size) * t;
        ctx.globalAlpha = life * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1 + 5 * life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.stroke();
        break;
      }
      case PK.FLASH: {
        ctx.globalAlpha = life;
        drawSpriteSized(ctx, 'glow_white', p.x, p.y, p.size * 2.2);
        ctx.globalAlpha = life * 0.35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.7, 0, TAU);
        ctx.fill();
        break;
      }
      case PK.DEBRIS: {
        ctx.globalAlpha = life;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        const c = Math.cos(p.rot) * p.size;
        const s = Math.sin(p.rot) * p.size;
        ctx.beginPath();
        ctx.moveTo(p.x - c, p.y - s);
        ctx.lineTo(p.x + c, p.y + s);
        ctx.stroke();
        break;
      }
      case PK.BEAM: {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = life * 0.35;
        ctx.lineWidth = p.size * 2.5 * life;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        ctx.globalAlpha = life;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, p.size * 0.5 * life);
        ctx.stroke();
        break;
      }
      case PK.MUZZLE: {
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(p.size * 0.35, -p.size * 0.32);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(p.size * 0.35, p.size * 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        drawSpriteSized(ctx, 'glow_white', p.x, p.y, p.size * 1.4);
        break;
      }
      case PK.AFTER: {
        ctx.globalAlpha = life * 0.45;
        drawSprite(ctx, 'player', p.x, p.y, p.rot);
        break;
      }
      case PK.CONFETTI: {
        ctx.globalAlpha = Math.min(1, life * 2);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
        break;
      }
      default:
        break;
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// Schadenszahlen und Punkte
export function drawTexts(ctx, ps) {
  const texts = ps.texts;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < texts.count; i++) {
    const t = texts.items[i];
    const life = t.life / t.max;
    const pop = t.pop > 0 ? 1 + t.pop * 3 : 1;
    ctx.globalAlpha = Math.min(1, life * 2.5);
    ctx.font = `800 ${Math.round(t.size * pop)}px ${FONT}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
