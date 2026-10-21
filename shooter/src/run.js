// Eine Spielrunde: alle Spielobjekte und ein Logikschritt. Reine Logik, läuft auch in node.
// Ereignisse (Schuss, Treffer, Explosion …) gehen über run.emit an Zuhörer (Partikel, Ton, Kamera).

import { CONFIG } from './config.js';
import { mulberry32, hashSeed } from './utils.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayer } from './player.js';

export function defaultMods() {
  return {
    speedMult: 1,
    dmgMult: 1,
    rateMult: 1,
    pierce: 0,
    bounce: 0,
    vamp: 0,
    dashExtra: 0,
    dashBoom: false,
    dashBoomRadius: 0,
    dashBoomDamage: 0,
    luck: 0,
    ammoMult: 1,
    crit: 0,
  };
}

export function createStats() {
  return {
    time: 0,
    kills: 0,
    killsByType: {},
    killsByWeapon: {},
    shots: 0,
    hits: 0,
    maxCombo: 0,
    damageTaken: 0,
    damageDealt: 0,
    dashes: 0,
    upgrades: [],
    bossesKilled: 0,
  };
}

// opts: { seed, layout, demo }
export function createRun(opts = {}) {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const rng = mulberry32(hashSeed(seed, 1));
  const layout = opts.layout ?? Math.floor(rng() * 4);
  const world = createWorld(layout);
  const run = {
    seed,
    rng,
    demo: !!opts.demo,
    world,
    player: createPlayer(world.startX, world.startY),
    time: 0,
    god: false,
    mods: defaultMods(),
    stats: createStats(),
    power: { shield: { amount: 0, t: 0 }, rapid: 0, multi: 0, slow: 0 },
    waves: { number: 0, hitThisWave: false },
    listeners: [],
    over: false,
  };
  run.emit = (type, a, b, c, d, e) => {
    const ls = run.listeners;
    for (let i = 0; i < ls.length; i++) ls[i](type, a, b, c, d, e);
  };
  run.onPlayerHit = () => {};
  run.explodeAt = () => {};
  return run;
}

// Ein Logikschritt mit Zeit dt und den Aktionen des Spielers
export function stepRun(run, dt, act) {
  run.time += dt;
  if (!run.player.dead) run.stats.time += dt;
  const p = run.player;
  p.px = p.x;
  p.py = p.y;
  updatePlayer(run, dt, act);
}

export const RUN_CFG = CONFIG;
