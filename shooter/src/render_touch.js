// Zeichnet die Touch-Steuerung (Sticks und Knöpfe) halbtransparent über das Spiel.

import { CONFIG } from './config.js';
import { FONT } from './ui.js';
import { dashMaxCharges } from './player.js';

function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function drawStick(ctx, s, R, color) {
  circle(ctx, s.ox, s.oy, R, 'rgba(255,255,255,0.06)', color, 2);
  circle(ctx, s.x, s.y, R * 0.42, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.6)', 2);
}

export function drawTouchControls(ctx, t, run, layout, time) {
  const R = Math.min(CONFIG.touch.stickRadius, 60);
  const { w, h, safe } = layout;
  ctx.save();
  // Sticks: aktiv dort, wo der Daumen ist; sonst ein schwacher Hinweis
  if (t.move.id !== -1) drawStick(ctx, t.move, R, 'rgba(63,243,255,0.45)');
  else circle(ctx, safe.left + 30 + R, h - safe.bottom - 30 - R, R, null, 'rgba(63,243,255,0.12)', 2);
  if (t.aim.id !== -1) {
    const firing = t.aim.mag > CONFIG.touch.fireThreshold;
    drawStick(ctx, t.aim, R, firing ? 'rgba(255,59,107,0.6)' : 'rgba(255,59,107,0.3)');
  } else {
    circle(ctx, w - safe.right - 30 - R, h - safe.bottom - 30 - R, R, null, 'rgba(255,59,107,0.12)', 2);
  }
  // Knöpfe
  t.layoutButtons();
  const p = run.player;
  for (const b of t.buttons) {
    const down = t.pressed.has(b.id);
    let ready = true;
    if (b.id === 'dash') ready = p.dashCharges >= 1;
    circle(ctx, b.x, b.y, b.r, down ? 'rgba(63,243,255,0.35)' : 'rgba(10,20,40,0.45)',
      ready ? 'rgba(63,243,255,0.75)' : 'rgba(127,147,184,0.4)', 2);
    if (b.id === 'dash') {
      // Abklingzeit als Ring, Ladungen als Punkte
      const max = dashMaxCharges(run);
      if (p.dashCharges < max) {
        const prog = p.dashRecharge / CONFIG.dash.cooldown;
        ctx.strokeStyle = 'rgba(63,243,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }
      if (max > 1) {
        for (let i = 0; i < max; i++) circle(ctx, b.x - 6 + i * 12, b.y + b.r * 0.55, 3, i < p.dashCharges ? '#3ff3ff' : 'rgba(63,243,255,0.2)');
      }
    }
    ctx.fillStyle = ready ? '#eaffff' : 'rgba(234,255,255,0.4)';
    ctx.font = `800 ${Math.round(b.id === 'dash' ? b.r * 0.42 : b.r * 0.7)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + (b.id === 'dash' ? -2 : 1));
  }
  ctx.restore();
  void time;
}
