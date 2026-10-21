// Kamera: weiches Folgen, Vorausschau, Boss-Schwenk, Trauma-Screenshake, Umrechnung Bildschirm/Welt.
// Reine Logik (zeichnet nicht).

import { CONFIG } from './config.js';
import { clamp, damp, lerp, noise1, smoothstep } from './utils.js';

export function createCamera() {
  return {
    x: CONFIG.arena.width / 2, y: CONFIG.arena.height / 2,
    px: CONFIG.arena.width / 2, py: CONFIG.arena.height / 2,
    zoom: 1,
    screenW: 1, screenH: 1,   // CSS-Pixel
    viewW: 1, viewH: 1,       // Welteinheiten
    trauma: 0,
    time: 0,
    shakeX: 0, shakeY: 0, shakeA: 0,
    shakeLevel: 1,
    pan: null,
  };
}

// Zoom so, dass die lange Bildschirmseite immer gleich viel Welt zeigt
export function setViewport(cam, cssW, cssH) {
  cam.screenW = cssW;
  cam.screenH = cssH;
  cam.zoom = Math.max(cssW, cssH) / CONFIG.view.visibleLongSide;
  cam.viewW = cssW / cam.zoom;
  cam.viewH = cssH / cam.zoom;
}

export function snapCamera(cam, x, y, world) {
  cam.x = x;
  cam.y = y;
  clampCamera(cam, world);
  cam.px = cam.x;
  cam.py = cam.y;
}

export function addTrauma(cam, amount) {
  cam.trauma = clamp(cam.trauma + amount, 0, 1);
}

// Kurzer Schwenk auf einen Punkt (Boss-Auftritt)
export function panTo(cam, x, y) {
  cam.pan = { x, y, t: 0, dur: CONFIG.camera.bossPanTime + 2 * CONFIG.camera.bossPanBlend };
}

function clampCamera(cam, world) {
  const margin = 30;
  const halfW = cam.viewW / 2;
  const halfH = cam.viewH / 2;
  if (cam.viewW >= world.width + margin * 2) cam.x = world.width / 2;
  else cam.x = clamp(cam.x, halfW - margin, world.width - halfW + margin);
  if (cam.viewH >= world.height + margin * 2) cam.y = world.height / 2;
  else cam.y = clamp(cam.y, halfH - margin, world.height - halfH + margin);
}

// Ein Logikschritt. aimReach = wie weit gezielt wird (Welteinheiten).
export function updateCamera(cam, run, act, dt) {
  const cc = CONFIG.camera;
  const p = run.player;
  cam.px = cam.x;
  cam.py = cam.y;

  let tx = p.x;
  let ty = p.y;
  if (act && act.aimValid && !p.dead) {
    const reach = Math.min(act.aimReach || 0, Math.min(cam.viewW, cam.viewH) * 0.7);
    tx += Math.cos(p.aim) * reach * cc.lookAhead;
    ty += Math.sin(p.aim) * reach * cc.lookAhead;
  }

  if (cam.pan) {
    const pan = cam.pan;
    pan.t += dt;
    const blend = cc.bossPanBlend;
    let w;
    if (pan.t < blend) w = pan.t / blend;
    else if (pan.t > pan.dur - blend) w = (pan.dur - pan.t) / blend;
    else w = 1;
    w = smoothstep(clamp(w, 0, 1));
    tx = lerp(tx, pan.x, w);
    ty = lerp(ty, pan.y, w);
    if (pan.t >= pan.dur) cam.pan = null;
  }

  const f = damp(cc.follow, dt);
  cam.x += (tx - cam.x) * f;
  cam.y += (ty - cam.y) * f;
  clampCamera(cam, run.world);

  // Screenshake: Stärke = Trauma², weiches Rauschen statt reinem Zufall
  const sc = CONFIG.shake;
  cam.time += dt;
  cam.trauma = Math.max(0, cam.trauma - sc.decay * dt);
  const s = cam.trauma * cam.trauma * cam.shakeLevel;
  const t = cam.time * sc.frequency;
  cam.shakeX = sc.maxOffset * s * noise1(1, t);
  cam.shakeY = sc.maxOffset * s * noise1(2, t);
  cam.shakeA = sc.maxAngle * s * noise1(3, t);
}

// Interpolierte Kameraposition für das Zeichnen
export function cameraView(cam, alpha, out) {
  out.x = lerp(cam.px, cam.x, alpha) + cam.shakeX;
  out.y = lerp(cam.py, cam.y, alpha) + cam.shakeY;
  out.a = cam.shakeA;
  out.zoom = cam.zoom;
  return out;
}

// Bildschirm (CSS-Pixel) -> Welt, ohne Shake (damit das Zielen ruhig bleibt)
export function screenToWorld(cam, sx, sy, out) {
  out.x = cam.x + (sx - cam.screenW / 2) / cam.zoom;
  out.y = cam.y + (sy - cam.screenH / 2) / cam.zoom;
  return out;
}

export function worldToScreen(cam, wx, wy, out) {
  out.x = (wx - cam.x) * cam.zoom + cam.screenW / 2;
  out.y = (wy - cam.y) * cam.zoom + cam.screenH / 2;
  return out;
}
