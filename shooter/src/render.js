// Setzt ein Bild zusammen: Welt (mit Kamera), danach Bildschirm-Ebenen (HUD zeichnet main.js).

import { CONFIG } from './config.js';
import { cameraView } from './camera.js';
import { buildSprites } from './sprites.js';
import { drawGrid, drawFloor, drawWalls, drawObstacles } from './render_world.js';
import { drawPlayer, drawPickups, drawRailPreview } from './render_entities.js';
import { drawEnemies, drawPlayerProjectiles, drawEnemyProjectiles, drawHazards } from './render_enemies.js';
import { drawParticlesFloor, drawParticlesTop, drawTexts } from './render_fx.js';
import { drawSpawnWarnings, drawDarkness } from './render_overlay.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  return {
    canvas,
    ctx,
    dpr: 1,
    w: 1,
    h: 1,
    glow: true,
    qualityScale: 1,
    view: { x: 0, y: 0, a: 0, zoom: 1, left: 0, right: 0, top: 0, bottom: 0 },
  };
}

// Canvas an Fenstergröße anpassen (scharf mit devicePixelRatio, höchstens 2)
export function resizeRenderer(r, cssW, cssH, zoom) {
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.view.dprMax) * r.qualityScale;
  r.dpr = dpr;
  r.w = cssW;
  r.h = cssH;
  r.canvas.width = Math.round(cssW * dpr);
  r.canvas.height = Math.round(cssH * dpr);
  r.canvas.style.width = cssW + 'px';
  r.canvas.style.height = cssH + 'px';
  buildSprites(zoom * dpr, r.glow);
}

// Weltmaßstab setzen und sichtbaren Bereich (mit Rand) berechnen
function beginWorld(r, cam, alpha) {
  const v = cameraView(cam, alpha, r.view);
  const ctx = r.ctx;
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  ctx.translate(r.w / 2, r.h / 2);
  if (v.a) ctx.rotate(v.a);
  ctx.scale(v.zoom, v.zoom);
  ctx.translate(-v.x, -v.y);
  const pad = 80;
  const halfW = r.w / 2 / v.zoom + pad;
  const halfH = r.h / 2 / v.zoom + pad;
  v.left = v.x - halfW;
  v.right = v.x + halfW;
  v.top = v.y - halfH;
  v.bottom = v.y + halfH;
  return v;
}

// Ganzes Weltbild zeichnen. scene = { run, cam, alpha, time, pulse, settings, particles }
export function renderWorld(r, scene) {
  const ctx = r.ctx;
  const { run, cam, alpha, time, settings, particles } = scene;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = CONFIG.colors.background;
  ctx.fillRect(0, 0, r.canvas.width, r.canvas.height);

  const view = beginWorld(r, cam, alpha);
  drawGrid(ctx, run.world, view, scene.pulse);
  drawFloor(ctx, run.world);
  drawWalls(ctx, run.world, r.glow);
  drawHazards(ctx, run, time);
  if (particles) drawParticlesFloor(ctx, particles, view);
  drawObstacles(ctx, run.world, view, r.glow);
  drawPickups(ctx, run, alpha, time, view);
  drawEnemies(ctx, run, alpha, time, view);
  drawPlayerProjectiles(ctx, run, alpha, view);
  if (particles) drawParticlesTop(ctx, particles, view);
  // Dunkelheit verdeckt alles außer Gefahren und Spieler
  if (scene.darkness > 0.01) {
    drawDarkness(ctx, run, view, alpha, scene.darkness);
    // Hindernisse schwach sichtbar lassen, damit man sich orientieren kann
    ctx.globalAlpha = 0.3 * scene.darkness;
    drawObstacles(ctx, run.world, view, false);
    ctx.globalAlpha = 1;
  }
  drawSpawnWarnings(ctx, run, time);
  drawEnemyProjectiles(ctx, run, alpha, time, view);
  drawRailPreview(ctx, run, alpha);
  drawPlayer(ctx, run, alpha, time, settings);
  if (particles && settings.damageNumbers !== false) drawTexts(ctx, particles);

  // zurück in Bildschirm-Koordinaten (CSS-Pixel)
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  return view;
}
