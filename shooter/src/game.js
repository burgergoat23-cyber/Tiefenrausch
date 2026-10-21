// Spielzustände und Game Loop mit festem Zeitschritt (Akkumulator-Prinzip).
// Kein DOM: main.js verbindet Eingabe, Zeichnen, Ton und Menüs über Rückruffunktionen.

import { CONFIG } from './config.js';
import { createRun, stepRun } from './run.js';
import { createCamera, updateCamera, snapCamera, screenToWorld } from './camera.js';

// Fester Zeitschritt: sammelt echte Zeit und führt so viele Logikschritte aus, wie hineinpassen.
export class FixedStepper {
  constructor(step = CONFIG.loop.step, maxFrame = CONFIG.loop.maxFrame, maxSteps = CONFIG.loop.maxStepsPerFrame) {
    this.step = step;
    this.maxFrame = maxFrame;
    this.maxSteps = maxSteps;
    this.acc = 0;
  }

  // Rückgabe: Anzahl ausgeführter Schritte. fn(step) wird pro Schritt aufgerufen.
  advance(frameDt, fn) {
    this.acc += Math.min(Math.max(frameDt, 0), this.maxFrame);
    let n = 0;
    while (this.acc >= this.step && n < this.maxSteps) {
      const go = fn(this.step);
      this.acc -= this.step;
      n++;
      if (go === false) break; // z. B. Zustand gewechselt (Upgrade-Auswahl)
    }
    if (n >= this.maxSteps) this.acc = 0; // zu langsam: Rest verwerfen
    return n;
  }

  get alpha() {
    return this.acc / this.step;
  }

  reset() {
    this.acc = 0;
  }
}

// Mauszeiger-Position (Bildschirm) in Zielrichtung umrechnen
const tmpWorld = { x: 0, y: 0 };
export function resolveAim(act, cam, player) {
  if (act.aimMode === 'mouse' && act.aimValid) {
    screenToWorld(cam, act.aimScreenX, act.aimScreenY, tmpWorld);
    const dx = tmpWorld.x - player.x;
    const dy = tmpWorld.y - player.y;
    if (dx * dx + dy * dy > 4) act.aimAngle = Math.atan2(dy, dx);
    act.aimReach = Math.sqrt(dx * dx + dy * dy);
  }
  return act;
}

export function createGame() {
  const game = {
    state: 'menu',          // menu, playing, paused, upgrade, dying, gameover
    run: null,
    cam: createCamera(),
    stepper: new FixedStepper(),
    time: 0,                // echte Zeit seit Start
    hitStop: 0,
    dyingT: 0,
    debug: false,
    getActions: null,       // liefert die Aktionen des Spielers (von main.js gesetzt)
    afterStep: null,        // Rückruf nach jedem Logikschritt
    onStateChange: null,
    stepsLastFrame: 0,
  };
  return game;
}

export function setState(game, state) {
  if (game.state === state) return;
  const prev = game.state;
  game.state = state;
  if (game.onStateChange) game.onStateChange(state, prev);
}

export function startRun(game, opts = {}) {
  game.run = createRun(opts);
  snapCamera(game.cam, game.run.player.x, game.run.player.y, game.run.world);
  game.stepper.reset();
  game.hitStop = 0;
  game.dyingT = 0;
  return game.run;
}

// Zeitlupe/Hit-Stop: echte Zeit -> Spielzeit
function timeScale(game) {
  return game.state === 'dying' ? CONFIG.juice.deathSlowmo : 1;
}

function simulating(game) {
  return game.state === 'playing' || game.state === 'dying' || game.state === 'menu';
}

// Ein Bild: Logikschritte ausführen. Rückgabe: Interpolationsfaktor fürs Zeichnen.
export function frame(game, realDt) {
  game.time += realDt;
  game.stepsLastFrame = 0;
  if (!game.run || !simulating(game)) return game.stepper.alpha;

  if (game.hitStop > 0) {
    game.hitStop -= realDt;
    return game.stepper.alpha;
  }

  if (game.state === 'dying') {
    game.dyingT += realDt;
    if (game.dyingT >= CONFIG.juice.deathSlowmoTime) {
      setState(game, 'gameover');
      return game.stepper.alpha;
    }
  }

  const scale = timeScale(game);
  game.stepsLastFrame = game.stepper.advance(realDt, (step) => {
    const run = game.run;
    const act = game.getActions(game);
    stepRun(run, step * scale, act);
    updateCamera(game.cam, run, act, step * scale);
    if (game.afterStep) game.afterStep(game, act);
    if (game.state === 'playing' && run.player.dead) {
      setState(game, 'dying');
    }
    if (run.pendingUpgrade) {
      if (game.state === 'playing') {
        setState(game, 'upgrade');
        return false;
      }
      if (game.state === 'menu' && game.onDemoUpgrade) game.onDemoUpgrade(run);
    }
    return true;
  });
  return game.stepper.alpha;
}
