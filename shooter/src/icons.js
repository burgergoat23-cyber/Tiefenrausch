// Symbole für Drops, Power-ups, Waffen und Upgrade-Karten – als Vektorpfade im Code gezeichnet.
// Alle Symbole passen in einen Kreis mit Radius 10 um (0, 0). Strich und Füllung setzt der Aufrufer.

import { TAU } from './utils.js';

function line(ctx, x1, y1, x2, y2) {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

export const ICONS = {
  heal(ctx) {
    ctx.beginPath();
    ctx.rect(-3, -9, 6, 18);
    ctx.rect(-9, -3, 18, 6);
    ctx.fill();
  },
  heart(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-12, -1, -6, -10, 0, -4);
    ctx.bezierCurveTo(6, -10, 12, -1, 0, 8);
    ctx.fill();
  },
  shield(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(8, -5);
    ctx.lineTo(7, 3);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 3);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.stroke();
  },
  rapid(ctx) {
    ctx.beginPath();
    ctx.moveTo(-8, -7); ctx.lineTo(-1, 0); ctx.lineTo(-8, 7);
    ctx.moveTo(0, -7); ctx.lineTo(7, 0); ctx.lineTo(0, 7);
    ctx.stroke();
  },
  multi(ctx) {
    ctx.beginPath();
    line(ctx, -7, 7, 0, -8);
    line(ctx, 0, 8, 0, -8);
    line(ctx, 7, 7, 0, -8);
    ctx.stroke();
  },
  slow(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    line(ctx, 0, 0, 0, -5);
    line(ctx, 0, 0, 4, 2);
    ctx.stroke();
  },
  magnet(ctx) {
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.lineTo(-7, 1);
    ctx.arc(0, 1, 7, Math.PI, 0, true);
    ctx.lineTo(7, -8);
    ctx.stroke();
    ctx.beginPath();
    line(ctx, -9, -6, -5, -6);
    line(ctx, 5, -6, 9, -6);
    ctx.stroke();
  },
  pistol(ctx) {
    ctx.beginPath();
    ctx.moveTo(-8, -4); ctx.lineTo(8, -4); ctx.lineTo(8, 0); ctx.lineTo(-2, 0);
    ctx.lineTo(-3, 6); ctx.lineTo(-8, 6); ctx.closePath();
    ctx.stroke();
  },
  shotgun(ctx) {
    ctx.beginPath();
    line(ctx, -9, 0, 9, -8);
    line(ctx, -9, 0, 9, -3);
    line(ctx, -9, 0, 9, 3);
    line(ctx, -9, 0, 9, 8);
    ctx.stroke();
  },
  mg(ctx) {
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      ctx.rect(-8, i * 6 - 1.5, 13, 3);
    }
    ctx.fill();
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) ctx.arc(7, i * 6, 1.5, 0, TAU);
    ctx.fill();
  },
  rocket(ctx) {
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(3, -4); ctx.lineTo(-6, -4); ctx.lineTo(-9, -8);
    ctx.lineTo(-9, 8); ctx.lineTo(-6, 4); ctx.lineTo(3, 4); ctx.closePath();
    ctx.stroke();
  },
  rail(ctx) {
    ctx.beginPath();
    line(ctx, -9, 0, 9, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, -5); ctx.lineTo(-4, -5);
    ctx.moveTo(-9, 5); ctx.lineTo(-4, 5);
    ctx.moveTo(2, -6); ctx.lineTo(9, -2);
    ctx.moveTo(2, 6); ctx.lineTo(9, 2);
    ctx.stroke();
  },
  // Upgrade-Karten
  boot(ctx) {
    ctx.beginPath();
    ctx.moveTo(-4, -9); ctx.lineTo(2, -9); ctx.lineTo(2, 2); ctx.lineTo(9, 4); ctx.lineTo(9, 8);
    ctx.lineTo(-4, 8); ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    line(ctx, -10, -2, -6, -2);
    line(ctx, -10, 3, -6, 3);
    ctx.stroke();
  },
  cross(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    line(ctx, 0, -10, 0, -3);
    line(ctx, 0, 3, 0, 10);
    line(ctx, -10, 0, -3, 0);
    line(ctx, 3, 0, 10, 0);
    ctx.stroke();
  },
  bolt(ctx) {
    ctx.beginPath();
    ctx.moveTo(2, -10); ctx.lineTo(-6, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 10);
    ctx.lineTo(6, -2); ctx.lineTo(0, -2); ctx.closePath();
    ctx.fill();
  },
  pierce(ctx) {
    ctx.beginPath();
    line(ctx, -10, 0, 10, 0);
    ctx.moveTo(6, -4); ctx.lineTo(10, 0); ctx.lineTo(6, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-3, 0, 4, 0, TAU);
    ctx.arc(4, 0, 3, 0, TAU);
    ctx.stroke();
  },
  bounce(ctx) {
    ctx.beginPath();
    ctx.moveTo(-9, -8); ctx.lineTo(0, 6); ctx.lineTo(9, -8);
    ctx.stroke();
    ctx.beginPath();
    line(ctx, -10, 8, 10, 8);
    ctx.stroke();
  },
  drop(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(7, -2, 8, 3, 0, 9);
    ctx.bezierCurveTo(-8, 3, -7, -2, 0, -10);
    ctx.fill();
  },
  dash2(ctx) {
    ctx.beginPath();
    ctx.moveTo(-9, -6); ctx.lineTo(-3, 0); ctx.lineTo(-9, 6);
    ctx.moveTo(-2, -6); ctx.lineTo(4, 0); ctx.lineTo(-2, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, 0, 2, 0, TAU);
    ctx.fill();
  },
  boom(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const r = i % 2 ? 4.5 : 10;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
  },
  clover(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      ctx.moveTo(0, 0);
      ctx.arc(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 4, 0, TAU);
    }
    ctx.fill();
  },
  ammo(ctx) {
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      const x = i * 6;
      ctx.moveTo(x - 2, 9);
      ctx.lineTo(x - 2, -3);
      ctx.lineTo(x, -8);
      ctx.lineTo(x + 2, -3);
      ctx.lineTo(x + 2, 9);
      ctx.closePath();
    }
    ctx.fill();
  },
  star(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const r = i % 2 ? 4 : 10;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  },
};

// Symbol zeichnen: Mittelpunkt (x, y), Größe = Durchmesser
export function drawIcon(ctx, id, x, y, size, color, lineWidth = 2.2) {
  const f = ICONS[id];
  if (!f) return;
  ctx.save();
  ctx.translate(x, y);
  const s = size / 20;
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth / s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  f(ctx);
  ctx.restore();
}
