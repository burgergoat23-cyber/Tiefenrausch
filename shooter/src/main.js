// Einstieg: baut alles zusammen, steuert die Bildschleife (requestAnimationFrame) und zeichnet HUD-Ebenen.

import { CONFIG } from './config.js';
import { createInput, pollActions, consumeEdges, takeUiKeys } from './input.js';
import { createGame, setState, frame, resolveAim } from './game.js';
import { setViewport } from './camera.js';
import { createRenderer, resizeRenderer, renderWorld } from './render.js';
import { fadeFloor } from './render_world.js';
import { createParticles, updateParticles } from './particles.js';
import { createFx, updateFx } from './fx.js';
import { createHudState, updateHud, drawHud, drawDamageVignette, drawWaveInfo, drawBossBars, drawSlowTint } from './hud.js';
import { bossBars } from './boss.js';
import { createMenus, menuOpen, menuKey } from './menus.js';
import { createTouch } from './touch.js';
import { createGamepad } from './gamepad.js';
import { drawTouchControls } from './render_touch.js';
import { drawOffscreen } from './render_overlay.js';
import { drawCrosshair, drawDebug } from './ui.js';
import { createAudio } from './audio.js';
import { killAll, nextWave, bossNow } from './cheats.js';
import { botActions, createBot } from './bot.js';
import { loadSettings, saveSettings, loadHighscores, loadTotals } from './storage.js';
import {
  showStart, tickDemo, pauseGame, openUpgrade, demoUpgrade, showGameOver, toast,
} from './flow.js';
import { createEnemy, addEnemy } from './enemies.js';
import { startWave } from './wave_director.js';
import { spawnPickup } from './pickups.js';
import { giveWeapon } from './weapons.js';
import { spawnEnemyProjectile } from './projectiles.js';

const canvas = document.getElementById('game');
const settings = loadSettings();
const game = createGame();
const particles = createParticles();
const audio = createAudio(settings);
const fx = createFx(particles, game, settings);
// Ton erst nach der ersten Berührung / dem ersten Klick / der ersten Taste starten (iPhone, Safari).
// Capture-Phase und vor den Menüs angemeldet: Menü-Tasten stoppen das Ereignis sonst vorher.
const unlockAudio = () => audio.unlock();
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) {
  window.addEventListener(ev, unlockAudio, { capture: true, passive: true });
}
fx.audio = audio;

const app = {
  canvas,
  renderer: createRenderer(canvas),
  input: createInput(canvas),
  game,
  settings,
  audio,
  particles,
  fx,
  hud: createHudState(),
  menus: createMenus(document.getElementById('ui'), (name) => audio.play(name)),
  safe: { top: 0, right: 0, bottom: 0, left: 0 },
  highscores: loadHighscores(),
  totals: loadTotals(),
  fps: 60,
  perf: { low: 0, level: 0 },
  timing: { logic: 0, draw: 0 },   // gleitende Mittel in ms (Debug-Anzeige)
};
const layout = { w: 1, h: 1, safe: app.safe, touch: false };
const touch = createTouch(canvas, app.input, () => layout);
const pad = createGamepad(app.input);

// Einstellungen anwenden (Lautstärke, Screenshake, Effekt-Menge)
app.applySettings = () => {
  game.cam.shakeLevel = CONFIG.shake.levels[settings.shake] ?? 1;
  particles.quality = CONFIG.particles.quality[settings.effects] ?? 1;
  audio.applyVolumes();
};
app.applySettings();

// Aktionen: im Menü spielt der Bot die Demo, sonst der Spieler
game.getActions = (g) => {
  if (g.state === 'menu') return botActions(g.demoBot, g.run, CONFIG.loop.step);
  const a = resolveAim(pollActions(app.input), g.cam, g.run.player);
  a.assist = a.assist && settings.aimAssist;
  return a;
};
game.afterStep = (g) => {
  if (g.state !== 'menu') consumeEdges(app.input);
};
game.onDemoUpgrade = demoUpgrade;
game.onStateChange = (s) => {
  app.input.enabled = s === 'playing';
  if (s === 'upgrade') openUpgrade(app);
  if (s === 'gameover') showGameOver(app);
};

// Sichere Bereiche (Notch) aus CSS lesen
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;'
  + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.appendChild(safeProbe);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  setViewport(game.cam, w, h);
  resizeRenderer(app.renderer, w, h, game.cam.zoom);
  const cs = getComputedStyle(safeProbe);
  app.safe.top = parseFloat(cs.paddingTop) || 0;
  app.safe.right = parseFloat(cs.paddingRight) || 0;
  app.safe.bottom = parseFloat(cs.paddingBottom) || 0;
  app.safe.left = parseFloat(cs.paddingLeft) || 0;
  layout.w = w;
  layout.h = h;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
resize();

// Automatische Pause und Ton aus, wenn der Tab unsichtbar wird (App-Wechsel, Anruf, Bildschirm aus)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame(app);
    audio.suspend();
  } else {
    audio.resume();
  }
});
window.addEventListener('pagehide', () => audio.suspend());
// iOS: Pinch- und Doppeltipp-Zoom verhindern
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// Leistungs-Automatik: 3 s unter 50 FPS -> weniger Partikel, dann ohne Glow, dann geringere Auflösung
function autoQuality(dt) {
  const perf = app.perf;
  if (game.state !== 'playing' || dt > 0.2) return;
  if (app.fps < CONFIG.perf.lowFps) perf.low += dt;
  else perf.low = Math.max(0, perf.low - dt * 0.5);
  if (perf.low < CONFIG.perf.lowFpsTime || perf.level >= 3) return;
  perf.level++;
  perf.low = 0;
  particles.auto = perf.level === 1 ? 0.6 : 0.4;
  if (perf.level >= 2) app.renderer.glow = false;
  if (perf.level >= 3) app.renderer.qualityScale = 0.75;
  if (perf.level >= 2) resize();
}

function handleUiKeys() {
  for (const code of takeUiKeys(app.input)) {
    if (code === 'F3' && CONFIG.debug.enabled) game.debug = !game.debug;
    if (code === 'KeyM') {
      settings.musicMuted = !settings.musicMuted;
      saveSettings(settings);
      audio.applyVolumes();
      toast(settings.musicMuted ? 'Musik aus (M)' : 'Musik an (M)', 1500);
    }
    if ((code === 'KeyP' || code === 'Escape') && game.state === 'playing') pauseGame(app);
    if (game.debug && game.state === 'playing') {
      if (code === 'KeyG') game.run.god = !game.run.god;
      if (code === 'KeyK') killAll(game.run);
      if (code === 'KeyN') nextWave(game.run);
      if (code === 'KeyB') bossNow(game.run);
    }
  }
}

function lowHpNow(run) {
  return !run.player.dead && run.player.hp / run.player.maxHp < CONFIG.player.lowHpFraction;
}

let darkness = 0;
let slowTint = 0;
let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (dt > 0) app.fps += (1 / dt - app.fps) * 0.05;
  pad.poll(dt, menuOpen(app.menus), (code) => menuKey(app.menus, code));
  handleUiKeys();
  tickDemo(app);
  autoQuality(dt);
  const t0 = performance.now();
  const alpha = frame(game, dt);
  const t1 = performance.now();
  const run = game.run;
  const st = game.state;
  const moving = st === 'playing' || st === 'dying' || st === 'menu';
  const simDt = moving && game.hitStop <= 0 ? dt : 0;
  const visDt = st === 'dying' ? simDt * CONFIG.juice.deathSlowmo : simDt;
  updateParticles(particles, visDt);
  updateFx(fx, visDt);
  fadeFloor(visDt);
  updateHud(app.hud, run, dt);
  fx.hurt = Math.max(0, fx.hurt - dt * 2.5);
  fx.comboFlash = Math.max(0, fx.comboFlash - dt * 3);
  darkness += ((run.waves.darkness ? 1 : 0) - darkness) * Math.min(1, dt * 2);
  slowTint += ((run.power.slow > 0 ? 1 : 0) - slowTint) * Math.min(1, dt * 4);
  audio.heartbeat(dt, lowHpNow(run) && st === 'playing');

  const pulse = audio.music ? audio.music.pulse() : Math.exp(-((game.time * 2) % 1) * 7);
  renderWorld(app.renderer, {
    run, cam: game.cam, alpha, time: game.time, pulse, settings, particles, darkness,
  });
  drawScreen(alpha, st, run);
  const t2 = performance.now();
  app.timing.logic += (t1 - t0 - app.timing.logic) * 0.05;
  app.timing.draw += (t2 - t1 - app.timing.draw) * 0.05;
  requestAnimationFrame(loop);
}

// Bildschirm-Ebenen über der Welt: Ränder, Pfeile, HUD, Fadenkreuz, Debug
function drawScreen(alpha, st, run) {
  const ctx = app.renderer.ctx;
  const { w, h } = app.renderer;
  layout.touch = app.input.device === 'touch';
  if (st === 'menu') return;
  drawSlowTint(ctx, w, h, slowTint);
  drawDamageVignette(ctx, w, h, fx.hurt, lowHpNow(run), game.time, settings.colorFx);
  if (st !== 'gameover') {
    drawOffscreen(ctx, run, game.cam, alpha, layout, game.time);
    drawHud(ctx, app.hud, run, layout, game.time, fx);
    if (!menuOpen(app.menus)) drawWaveInfo(ctx, run, layout, game.time);
    drawBossBars(ctx, run, layout, bossBars, game.time);
    if (layout.touch && (st === 'playing' || st === 'dying')) drawTouchControls(ctx, touch, run, layout, game.time);
  }
  const input = app.input;
  if (input.device === 'mouse' && input.mouseInside && !menuOpen(app.menus)) {
    drawCrosshair(ctx, input.mouseX, input.mouseY, game.time);
  }
  if (game.debug || settings.showFps) {
    const p = run.player;
    const lines = [`FPS ${app.fps.toFixed(0)}  Schritte ${game.stepsLastFrame}`];
    if (game.debug) {
      lines.push(
        `Logik ${app.timing.logic.toFixed(1)} ms  Zeichnen ${app.timing.draw.toFixed(1)} ms`,
        `Qualität ${app.perf.level}  Gerät ${app.input.device}`,
        `Gegner ${run.enemies.length}  Kugeln ${run.projectiles.player.count}/${run.projectiles.enemy.count}`,
        `Partikel ${particles.pool.count}  Gefahren ${run.hazards.length}  Drops ${run.pickups.length}`,
        `Spieler ${p.x.toFixed(0)}, ${p.y.toFixed(0)}  HP ${Math.ceil(p.hp)}${run.god ? ' (G)' : ''}`,
        'G unverwundbar · N Welle · K töten · B Boss',
      );
    }
    drawDebug(ctx, lines, app.safe.left + 8, h - app.safe.bottom - 20 - lines.length * 15);
  }
}

showStart(app);
requestAnimationFrame(loop);

// Für Tests im Browser: Zeitraffer (Logik + Partikel, jedes n-te Bild zeichnen)
window.__fastForward = (seconds, drawEvery = 20) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    frame(game, 1 / 60);
    updateParticles(particles, 1 / 60);
    updateFx(fx, 1 / 60);
    fadeFloor(1 / 60);
    updateHud(app.hud, game.run, 1 / 60);
    if (i % drawEvery === 0) {
      renderWorld(app.renderer, { run: game.run, cam: game.cam, alpha: 1, time: game.time, pulse: 0, settings, particles, darkness });
      drawScreen(1, game.state, game.run);
    }
  }
};
window.__game = game;
window.__app = app;
window.__audio = audio;
window.__api = {
  createEnemy, addEnemy, startWave, spawnPickup, giveWeapon, spawnEnemyProjectile, CONFIG, setState, createBot, botActions,
};
