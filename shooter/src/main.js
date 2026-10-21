// Einstieg: verbindet Canvas, Eingabe, Spielzustände und Zeichnen.

import { CONFIG } from './config.js';
import { createInput, pollActions, consumeEdges, takeUiKeys } from './input.js';
import { createGame, startRun, setState, frame, resolveAim } from './game.js';
import { setViewport } from './camera.js';
import { createRenderer, resizeRenderer, renderWorld } from './render.js';
import { drawCrosshair, drawDebug, drawCenterText } from './ui.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const game = createGame();
const settings = { aimLine: true, showFps: false };

game.getActions = (g) => resolveAim(pollActions(input), g.cam, g.run.player);
game.afterStep = () => consumeEdges(input);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  setViewport(game.cam, w, h);
  resizeRenderer(renderer, w, h, game.cam.zoom);
}
window.addEventListener('resize', resize);
resize();

startRun(game, {});
setState(game, 'playing');

// Automatische Pause, wenn der Tab unsichtbar wird
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') setState(game, 'paused');
});

function handleUiKeys() {
  for (const code of takeUiKeys(input)) {
    if (code === 'F3' && CONFIG.debug.enabled) game.debug = !game.debug;
    if (code === 'KeyP' || code === 'Escape') {
      if (game.state === 'playing') setState(game, 'paused');
      else if (game.state === 'paused') setState(game, 'playing');
    }
  }
}

// FPS messen (gleitender Mittelwert)
let fps = 60;
let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  handleUiKeys();
  const alpha = frame(game, dt);
  renderWorld(renderer, {
    run: game.run, cam: game.cam, alpha, time: game.time, pulse: 0, settings,
  });
  const ctx = renderer.ctx;
  if (game.state === 'paused') drawCenterText(ctx, renderer.w, renderer.h, 'PAUSE', 'P oder Esc: weiter');
  if (input.device === 'mouse' && input.mouseInside) drawCrosshair(ctx, input.mouseX, input.mouseY, game.time);
  if (game.debug || settings.showFps) {
    const p = game.run.player;
    drawDebug(ctx, [
      `FPS ${fps.toFixed(0)}  Schritte ${game.stepsLastFrame}`,
      `Spieler ${p.x.toFixed(0)}, ${p.y.toFixed(0)}  HP ${p.hp}`,
      `Dash ${p.dashCharges}  Zustand ${game.state}`,
    ], 8, 8);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Für Tests im Browser
window.__game = game;
