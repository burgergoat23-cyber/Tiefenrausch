// Ablauf zwischen den Zuständen: Startbildschirm mit Demo, Spiel, Pause, Upgrade, Game Over.
// Verbindet die Zustandsmaschine aus game.js mit den Menüseiten.

import { startRun, setState } from './game.js';
import { attachFx } from './fx.js';
import { clearParticles } from './particles.js';
import { resetFloor } from './render_world.js';
import { createHudState } from './hud.js';
import { showMenu, hideMenu } from './menus.js';
import { startPage, controlsPage, settingsPage, highscoresPage, isTouchDevice } from './screens_main.js';
import { upgradePage, pausePage } from './screens_game.js';
import { gameOverPage } from './screens_over.js';
import { pickCards, applyUpgrade } from './upgrades.js';
import { healPlayer } from './player.js';
import { createBot } from './bot.js';
import { runSummary } from './scoring.js';
import {
  saveSettings, insertHighscore, saveHighscores, loadHighscores, loadTotals, saveTotals, addRunToTotals,
  qualifies, resetAll, DEFAULT_SETTINGS,
} from './storage.js';

// Fester Seed über die Adresse (?seed=123), z. B. für Tests
const urlSeed = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('seed') : null;

function prepareRun(app, opts) {
  const run = startRun(app.game, opts);
  attachFx(app.fx, run);
  clearParticles(app.particles);
  app.fx.queue.length = 0;
  // Welle 1 startete schon vor dem Anhängen der Zuhörer: Gong und Musik nachholen
  const w = run.waves;
  if (!run.demo && w.number > 0) run.emit('waveStart', w.number, w.special, w.boss ? 'boss' : '');
  resetFloor(run.world);
  app.hud = createHudState();
  return run;
}

// --- Startbildschirm mit Demo im Hintergrund ----------------------------------------

export function startDemo(app) {
  const run = prepareRun(app, { demo: true, startWave: 2 + Math.floor(Math.random() * 3) });
  run.god = true;
  app.game.demoBot = createBot(Math.floor(Math.random() * 1e6));
  return run;
}

// Kurzer Hinweis unten
export function toast(text, ms = 3500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}

export function showStart(app) {
  startDemo(app);
  // Hochformat auf dem Handy: einmal zum Drehen raten
  const s = app.settings;
  if (!s.rotateHintShown && isTouchDevice() && window.innerHeight > window.innerWidth) {
    s.rotateHintShown = true;
    saveSettings(s);
    toast('Für das beste Erlebnis drehen ↻', 4500);
  }
  setState(app.game, 'menu');
  if (app.audio) app.audio.setIntensity(0);
  const totals = app.totals;
  showMenu(app.menus, startPage({
    play: () => startGame(app),
    controls: () => showMenu(app.menus, controlsPage(() => showStart(app))),
    settings: () => openSettings(app, () => showStart(app)),
    highscores: () => openHighscores(app, () => showStart(app)),
  }, { bestScore: totals.bestScore, bestWave: totals.bestWave }));
}

// Demo neu starten, wenn sie zu lange läuft
export function tickDemo(app) {
  const run = app.game.run;
  if (app.game.state !== 'menu' || !run || !run.demo) return;
  if (run.time > 75 || run.waves.number > 8) startDemo(app);
}

// --- Spiel -----------------------------------------------------------------------

export function startGame(app) {
  hideMenu(app.menus, true);
  prepareRun(app, urlSeed ? { seed: Number(urlSeed) } : {});
  app.input.releaseAll();
  setState(app.game, 'playing');
}

export function pauseGame(app) {
  if (app.game.state !== 'playing') return;
  setState(app.game, 'paused');
  app.input.releaseAll();
  showPause(app);
}

function showPause(app) {
  showMenu(app.menus, pausePage(app.game.run, {
    resume: () => resumeGame(app),
    settings: () => openSettings(app, () => showPause(app)),
    controls: () => showMenu(app.menus, controlsPage(() => showPause(app))),
    quit: () => quitRun(app),
  }));
}

export function resumeGame(app) {
  if (app.game.state !== 'paused') return;
  hideMenu(app.menus);
  app.input.releaseAll();
  setState(app.game, 'playing');
}

function quitRun(app) {
  const run = app.game.run;
  run.player.lastHitBy = '';
  run.quit = true;
  setState(app.game, 'gameover');
}

// Upgrade-Auswahl nach bestimmten Wellen
export function openUpgrade(app) {
  const run = app.game.run;
  const cards = pickCards(run.rng, run.upgrades);
  if (!cards.length) {
    healPlayer(run, 25); // alles voll ausgebaut: stattdessen heilen
    run.pendingUpgrade = 0;
    setState(app.game, 'playing');
    return;
  }
  app.input.releaseAll();
  showMenu(app.menus, upgradePage(cards, run.upgrades, (id) => {
    applyUpgrade(run, id);
    run.pendingUpgrade = 0;
    hideMenu(app.menus);
    setState(app.game, 'playing');
  }));
}

// Demo: Bot nimmt einfach die erste Karte
export function demoUpgrade(run) {
  const cards = pickCards(run.rng, run.upgrades);
  if (cards.length) applyUpgrade(run, cards[0]);
  run.pendingUpgrade = 0;
}

// --- Game Over -------------------------------------------------------------------

export function showGameOver(app) {
  const run = app.game.run;
  if (run.demo) return;
  if (app.audio) app.audio.setIntensity(0);
  const summary = runSummary(run);
  if (run.quit) summary.deathBy = 'Aufgegeben';
  // Gesamtstatistik und Highscore speichern
  const prevBest = app.totals.bestScore;
  app.totals = addRunToTotals(app.totals, run);
  saveTotals(app.totals);
  let hs = null;
  if (qualifies(app.highscores, summary.score)) {
    const entry = { name: app.settings.lastName || 'AAA', score: summary.score, wave: summary.wave, date: Date.now() };
    const res = insertHighscore(app.highscores, entry);
    app.highscores = res.list;
    saveHighscores(app.highscores);
    hs = { rank: res.rank, isBest: res.rank === 0 && summary.score > prevBest, entry };
  }
  showMenu(app.menus, gameOverPage(summary, hs, run.upgrades, {
    again: () => startGame(app),
    menu: () => showStart(app),
    sound: (n) => app.audio && app.audio.play(n),
    rename: (name) => {
      if (!hs) return;
      hs.entry.name = name;
      saveHighscores(app.highscores);
      app.settings.lastName = name;
      saveSettings(app.settings);
    },
  }));
}

// --- Einstellungen, Highscores ---------------------------------------------------

export function openSettings(app, back) {
  showMenu(app.menus, settingsPage(app.settings, () => {
    saveSettings(app.settings);
    app.applySettings();
  }, () => {
    resetAll();
    Object.assign(app.settings, DEFAULT_SETTINGS);
    app.highscores = loadHighscores();
    app.totals = loadTotals();
    app.applySettings();
    openSettings(app, back);
  }, back));
}

export function openHighscores(app, back) {
  showMenu(app.menus, highscoresPage(app.highscores, app.totals, back));
}

