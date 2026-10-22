// Eine Spielrunde: alle Spielobjekte und ein Logikschritt. Reine Logik, läuft auch in node.
// Ereignisse (Schuss, Treffer, Explosion …) gehen über run.emit an Zuhörer (Partikel, Ton, Kamera).

import { CONFIG } from './config.js';
import { mulberry32, hashSeed } from './utils.js';
import { SpatialHash } from './collision.js';
import { createWorld } from './world.js';
import { createNav, updateNav } from './nav.js';
import { createPlayer, updatePlayer } from './player.js';
import { createArsenal, updateWeapons } from './weapons.js';
import { createProjectilePools, updatePlayerProjectiles, updateEnemyProjectiles } from './projectiles.js';
import { updateEnemies, rebuildHash, compactEnemies } from './enemies.js';
import { createWaveState, startWave, updateWaves } from './wave_director.js';
import { maybeDrop, updatePickups } from './pickups.js';
import { computeMods } from './upgrades.js';
import { explodeAt, updateHazards } from './hazards.js';
import { createScore, registerKill, comboOnHit, updateCombo } from './scoring.js';

export function defaultMods() {
  return computeMods({});
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
    noWaves: !!opts.noWaves,
    seed,
    rng,
    demo: !!opts.demo,
    world,
    nav: createNav(world),
    player: createPlayer(world.startX, world.startY),
    arsenal: createArsenal(),
    projectiles: createProjectilePools(),
    enemies: [],
    hazards: [],
    pickups: [],
    hash: new SpatialHash(world.width, world.height, 100),
    score: createScore(),
    time: 0,
    god: false,
    mods: defaultMods(),
    upgrades: {},          // Stufen der Upgrade-Karten
    stats: createStats(),
    power: { shield: { amount: 0, t: 0 }, rapid: 0, multi: 0, slow: 0 },
    waves: createWaveState(),
    pendingUpgrade: 0,     // Welle, nach der Karten gewählt werden dürfen
    listeners: [],
  };
  run.emit = (type, a, b, c, d, e) => {
    const ls = run.listeners;
    for (let i = 0; i < ls.length; i++) ls[i](type, a, b, c, d, e);
  };
  run.onPlayerHit = () => comboOnHit(run.score);
  run.explodeAt = (x, y, radius, damage, team, source, exclude) =>
    explodeAt(run, x, y, radius, damage, team, source, exclude);
  run.scoreKill = (e) => {
    const res = registerKill(run.score, e.points);
    if (run.score.combo > run.stats.maxCombo) run.stats.maxCombo = run.score.combo;
    run.emit('score', res.gained, e.x, e.y);
    if (res.tierUp) run.emit('comboTier', res.tier);
  };
  run.dropFrom = (e) => maybeDrop(run, e);
  run.requestUpgrade = () => {
    run.pendingUpgrade = run.waves.number;
  };
  if (!opts.noWaves) startWave(run, opts.startWave || 1);
  return run;
}

// Ein Logikschritt mit Zeit dt und den Aktionen des Spielers
export function stepRun(run, dt, act) {
  run.time += dt;
  const p = run.player;
  if (!p.dead) run.stats.time += dt;
  // Zeitlupe (Power-up): Gegner und ihre Kugeln halb so schnell
  const enemyDt = run.power.slow > 0 ? dt * CONFIG.powerups.slow.factor : dt;

  p.px = p.x;
  p.py = p.y;
  updatePlayer(run, dt, act);
  if (!run.noWaves) updateWaves(run, dt);

  updateNav(run);
  rebuildHash(run);
  updateEnemies(run, enemyDt);
  rebuildHash(run);
  updateWeapons(run, dt, act);
  updatePlayerProjectiles(run, dt);
  updateEnemyProjectiles(run, enemyDt);
  updateHazards(run, dt, enemyDt);
  updatePickups(run, dt);
  updateCombo(run.score, dt);
  updatePowerups(run, dt);
  compactEnemies(run);
}

function updatePowerups(run, dt) {
  const pw = run.power;
  if (pw.rapid > 0) pw.rapid = Math.max(0, pw.rapid - dt);
  if (pw.multi > 0) pw.multi = Math.max(0, pw.multi - dt);
  if (pw.slow > 0) pw.slow = Math.max(0, pw.slow - dt);
  if (pw.shield.t > 0) {
    pw.shield.t -= dt;
    if (pw.shield.t <= 0) {
      pw.shield.t = 0;
      pw.shield.amount = 0;
    }
  }
}
