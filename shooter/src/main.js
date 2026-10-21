// Einstieg: verbindet Canvas, Eingabe, Spielzustände, Effekte und Zeichnen.

import { CONFIG } from './config.js';
import { createInput, pollActions, consumeEdges, takeUiKeys } from './input.js';
import { createGame, startRun, setState, frame, resolveAim } from './game.js';
import { setViewport } from './camera.js';
import { createRenderer, resizeRenderer, renderWorld } from './render.js';
import { resetFloor, fadeFloor } from './render_world.js';
import { createParticles, updateParticles, clearParticles } from './particles.js';
import { createFx, attachFx } from './fx.js';
import { createHudState, updateHud, drawHud, drawDamageVignette, drawWaveInfo, drawBossBars } from './hud.js';
import { bossBars } from './boss.js';
import { createMenus, showMenu, hideMenu, menuOpen } from './menus.js';
import { upgradePage } from './screens_game.js';
import { pickCards, applyUpgrade } from './upgrades.js';
import { healPlayer } from './player.js';
import { drawOffscreen } from './render_overlay.js';
import { drawCrosshair, drawDebug, drawCenterText } from './ui.js';
import { formatScore } from './utils.js';
import { killAll, nextWave, bossNow } from './cheats.js';
import { createEnemy, addEnemy } from './enemies.js';
import { startWave } from './waves.js';
import { spawnPickup } from './pickups.js';
import { giveWeapon } from './weapons.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const game = createGame();
const settings = {
  aimLine: true, showFps: false, damageNumbers: true, vibration: true, colorFx: true, aimAssist: true,
};
const particles = createParticles();
const fx = createFx(particles, game, settings);
let hud = createHudState();
const menus = createMenus(document.getElementById('ui'));
const safe = { top: 0, right: 0, bottom: 0, left: 0 };

game.getActions = (g) => resolveAim(pollActions(input), g.cam, g.run.player);
game.afterStep = () => consumeEdges(input);

// Sichere Bereiche (Notch) aus CSS lesen
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;'
  + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.appendChild(safeProbe);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  setViewport(game.cam, w, h);
  resizeRenderer(renderer, w, h, game.cam.zoom);
  const cs = getComputedStyle(safeProbe);
  safe.top = parseFloat(cs.paddingTop) || 0;
  safe.right = parseFloat(cs.paddingRight) || 0;
  safe.bottom = parseFloat(cs.paddingBottom) || 0;
  safe.left = parseFloat(cs.paddingLeft) || 0;
}
window.addEventListener('resize', resize);
resize();

// Fester Seed über die Adresse (?seed=123), z. B. für Tests
const urlSeed = new URLSearchParams(location.search).get('seed');

function newGame() {
  const run = startRun(game, urlSeed ? { seed: Number(urlSeed) } : {});
  attachFx(fx, run);
  clearParticles(particles);
  resetFloor(run.world);
  hud = createHudState();
  setState(game, 'playing');
}
newGame();

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
    if ((code === 'Enter' || code === 'Space') && game.state === 'gameover') newGame();
    if (game.debug && game.state === 'playing') {
      if (code === 'KeyG') game.run.god = !game.run.god;
      if (code === 'KeyK') killAll(game.run);
      if (code === 'KeyN') nextWave(game.run);
      if (code === 'KeyB') bossNow(game.run);
    }
  }
}
canvas.addEventListener('pointerdown', () => {
  if (game.state === 'gameover' && game.time - deathTime > 1) newGame();
});
let deathTime = 0;
game.onStateChange = (s) => {
  input.enabled = s === 'playing';
  if (s === 'gameover') deathTime = game.time;
  if (s === 'upgrade') openUpgrade();
};

// Upgrade-Auswahl nach bestimmten Wellen
function openUpgrade() {
  const run = game.run;
  const cards = pickCards(run.rng, run.upgrades);
  if (!cards.length) {
    // alles voll ausgebaut: stattdessen heilen
    healPlayer(run, 25);
    run.pendingUpgrade = 0;
    setState(game, 'playing');
    return;
  }
  input.releaseAll();
  showMenu(menus, upgradePage(cards, run.upgrades, (id) => {
    applyUpgrade(run, id);
    run.pendingUpgrade = 0;
    hideMenu(menus);
    setState(game, 'playing');
  }));
}

// FPS messen (gleitender Mittelwert)
let fps = 60;
let darkness = 0;
let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  handleUiKeys();
  const alpha = frame(game, dt);
  const run = game.run;
  const simDt = game.state === 'playing' || game.state === 'dying' ? (game.hitStop > 0 ? 0 : dt) : 0;
  const visDt = game.state === 'dying' ? simDt * CONFIG.juice.deathSlowmo : simDt;
  updateParticles(particles, visDt);
  fadeFloor(visDt);
  updateHud(hud, run, dt);
  fx.hurt = Math.max(0, fx.hurt - dt * 2.5);
  fx.comboFlash = Math.max(0, fx.comboFlash - dt * 3);

  darkness += ((run.waves.darkness ? 1 : 0) - darkness) * Math.min(1, dt * 2);
  renderWorld(renderer, {
    run, cam: game.cam, alpha, time: game.time, pulse: 0, settings, particles, darkness,
  });
  const ctx = renderer.ctx;
  const w = renderer.w;
  const h = renderer.h;
  const lowHp = !run.player.dead && run.player.hp / run.player.maxHp < CONFIG.player.lowHpFraction;
  drawDamageVignette(ctx, w, h, fx.hurt, lowHp, game.time, settings.colorFx);
  const layout = { w, h, safe };
  if (game.state !== 'gameover') {
    drawOffscreen(ctx, run, game.cam, alpha, layout, game.time);
    drawHud(ctx, hud, run, layout, game.time, fx);
    if (!menuOpen(menus)) drawWaveInfo(ctx, run, layout, game.time);
    drawBossBars(ctx, run, layout, bossBars, game.time);
  }
  if (game.state === 'paused') drawCenterText(ctx, w, h, 'PAUSE', 'P oder Esc: weiter');
  if (game.state === 'gameover') {
    drawCenterText(ctx, w, h, 'GAME OVER',
      `${formatScore(run.score.score)} Punkte · Kills ${run.stats.kills} · Enter oder Tippen: nochmal`);
  }
  if (input.device === 'mouse' && input.mouseInside && game.state !== 'gameover' && !menuOpen(menus)) {
    drawCrosshair(ctx, input.mouseX, input.mouseY, game.time);
  }
  if (game.debug || settings.showFps) {
    const p = run.player;
    drawDebug(ctx, [
      `FPS ${fps.toFixed(0)}  Schritte ${game.stepsLastFrame}`,
      `Gegner ${run.enemies.length}  Kugeln ${run.projectiles.player.count}/${run.projectiles.enemy.count}`,
      `Partikel ${particles.pool.count}  Gefahren ${run.hazards.length}`,
      `Spieler ${p.x.toFixed(0)}, ${p.y.toFixed(0)}  HP ${p.hp}${run.god ? ' (G)' : ''}`,
    ], safe.left + 8, h - safe.bottom - 80);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Für Tests im Browser
window.__game = game;
window.__api = { createEnemy, addEnemy, startWave, spawnPickup, giveWeapon, CONFIG };
