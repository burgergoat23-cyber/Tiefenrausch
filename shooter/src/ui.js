// HUD und Bildschirm-Anzeigen auf dem Canvas (Bildschirm-Koordinaten in CSS-Pixeln).

import { CONFIG } from './config.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function drawCrosshair(ctx, x, y, time) {
  const r = 11;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(63,243,255,0.25)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#bfffff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + time * 0.6;
    ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
    ctx.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6));
  }
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// Debug-Anzeige (F3): FPS und Objektzahlen
export function drawDebug(ctx, lines, x, y) {
  ctx.font = `12px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const w = 230;
  const h = lines.length * 15 + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#9fffb0';
  lines.forEach((l, i) => ctx.fillText(l, x + 6, y + 5 + i * 15));
}

export function drawCenterText(ctx, w, h, text, sub) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.font = `800 ${Math.round(Math.min(w, h) * 0.09)}px ${FONT}`;
  ctx.fillStyle = CONFIG.colors.hud;
  ctx.fillText(text, w / 2, h / 2);
  if (sub) {
    ctx.font = `600 ${Math.round(Math.min(w, h) * 0.03)}px ${FONT}`;
    ctx.fillStyle = CONFIG.colors.hudDim;
    ctx.fillText(sub, w / 2, h / 2 + Math.min(w, h) * 0.08);
  }
}
