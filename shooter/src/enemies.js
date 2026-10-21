// Gegner: Erzeugen, Bewegung, Separation, Kontaktschaden, Schaden und Tod.
// Das Verhalten der einzelnen Typen steht in enemy_ai.js, die Bosse in boss.js.

import { CONFIG } from './config.js';
import { resolveCircle } from './world.js';
import { hurtPlayer, isPlayerInvulnerable } from './player.js';
import { ENEMY_AI } from './enemy_ai.js';
import { updateBoss, onBossDamaged, onBossKilled } from './boss.js';
import { angleDiff, DEG, TAU } from './utils.js';

let nextId = 1;

// defOverride: eigene Werte (für Bosse), dann ohne Wellen-Skalierung
export function createEnemy(run, type, x, y, defOverride) {
  const def = defOverride || CONFIG.enemies[type];
  const hpScale = defOverride ? 1 : run.waves.hpScale || 1;
  const speedScale = defOverride ? 1 : run.waves.speedScale || 1;
  const hp = def.hp * hpScale;
  const e = {
    id: nextId++,
    type,
    def,
    x, y, px: x, py: y,
    vx: 0, vy: 0,
    kx: 0, ky: 0,             // Rückstoß-Geschwindigkeit (klingt ab)
    r: def.radius,
    hp, maxHp: hp,
    speed: def.speed * speedScale,
    damage: def.damage,
    points: def.points,
    mass: def.big ? 3 : 1,
    knockResist: def.knockResist || 0,
    angle: Math.atan2(run.player.y - y, run.player.x - x),
    flash: 0, squash: 0, popIn: 0.25,
    dead: false, spawning: false, noReward: false, noDrop: false,
    state: '', stateT: 0, t: 0, timerA: 0, timerB: 0, side: run.rng() < 0.5 ? -1 : 1,
    avoidSide: run.rng() < 0.5 ? -1 : 1, avoidT: 0,
    lockX: 0, lockY: 0,
    charging: false,
    hitWall: false, wallNX: 0, wallNY: 0,
    marked: false,
    boss: null,
    _t: 0,
  };
  const init = !defOverride && ENEMY_AI[type] && ENEMY_AI[type].init;
  if (init) init(run, e);
  return e;
}

export function addEnemy(run, e) {
  run.enemies.push(e);
  return e;
}

// Schildträger: blockt Treffer von vorne
export function shieldBlocks(e, hx, hy) {
  if (e.type !== 'shield') return false;
  const a = Math.atan2(hy - e.y, hx - e.x);
  return Math.abs(angleDiff(e.angle, a)) < (e.def.shieldArc / 2) * DEG;
}

// opts: { crit, weapon, knock, kx, ky, ignoreShield }
export function damageEnemy(run, e, amount, opts) {
  if (e.dead || e.spawning || amount <= 0) return 0;
  if (e.boss && e.boss.invuln > 0) {
    run.emit('immune', e.x, e.y);
    return 0;
  }
  const dealt = Math.min(e.hp, amount);
  e.hp -= amount;
  e.flash = CONFIG.juice.flashTime;
  e.squash = 1;
  run.stats.damageDealt += dealt;
  // Vampir: Anteil des Schadens heilt
  if (run.mods.vamp > 0 && !run.player.dead) {
    const p = run.player;
    p.healAcc += dealt * run.mods.vamp;
    if (p.healAcc >= 1) {
      const h = Math.floor(p.healAcc);
      p.healAcc -= h;
      p.hp = Math.min(p.maxHp, p.hp + h);
    }
  }
  if (opts && opts.knock) {
    const k = opts.knock * (1 - e.knockResist);
    e.kx += opts.kx * k;
    e.ky += opts.ky * k;
  }
  run.emit('enemyHit', e.x, e.y, amount, opts && opts.crit, e);
  if (e.boss) onBossDamaged(run, e);
  if (e.hp <= 0) killEnemy(run, e, opts ? opts.weapon : '');
  return dealt;
}

export function killEnemy(run, e, weapon) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  if (!e.noReward) {
    run.stats.kills++;
    run.stats.killsByType[e.type] = (run.stats.killsByType[e.type] || 0) + 1;
    if (weapon && CONFIG.weapons[weapon]) {
      run.stats.killsByWeapon[weapon] = (run.stats.killsByWeapon[weapon] || 0) + 1;
    }
    run.scoreKill(e);
    run.dropFrom(e);
  }
  const ai = ENEMY_AI[e.type];
  if (ai && ai.onDeath) ai.onDeath(run, e);
  if (e.boss) onBossKilled(run, e);
  run.emit('enemyDeath', e.x, e.y, e.type, e.r, e);
  if (e.def.big && !e.boss) run.emit('hitStop', CONFIG.juice.hitStopBigKill);
}

// Entfernt ein Objekt ohne Belohnung (z. B. selbst gesprengter Bomber, geschlüpftes Ei)
export function removeEnemy(e) {
  e.dead = true;
  e.noReward = true;
}

const near = [];
const KNOCK_DECAY = 9;

export function updateEnemies(run, dt) {
  const list = run.enemies;
  const world = run.world;
  const decay = Math.exp(-KNOCK_DECAY * dt);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    e.px = e.x;
    e.py = e.y;
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.squash > 0) e.squash = Math.max(0, e.squash - dt * 6);
    if (e.popIn > 0) e.popIn -= dt;
    if (e.boss) updateBoss(run, e, dt);
    else ENEMY_AI[e.type].update(run, e, dt);
    if (e.dead) continue;
    e.x += (e.vx + e.kx) * dt;
    e.y += (e.vy + e.ky) * dt;
    e.kx *= decay;
    e.ky *= decay;
    if (resolveCircle(world, e, e.r, wallNormal)) {
      e.hitWall = true;
      e.wallNX = wallNormal.nx;
      e.wallNY = wallNormal.ny;
    } else {
      e.hitWall = false;
    }
  }
  separate(run);
  contactDamage(run);
}
const wallNormal = { nx: 0, ny: 0 };

// Gegner schieben sich gegenseitig weg, damit sie nicht verklumpen
function separate(run) {
  const list = run.enemies;
  const hash = run.hash;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    hash.query(e.x, e.y, e.r + 4, near);
    for (let k = 0; k < near.length; k++) {
      const o = near[k];
      if (o.id <= e.id || o.dead) continue;
      let dx = o.x - e.x;
      let dy = o.y - e.y;
      const minD = e.r + o.r + 2;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) {
        const a = (e.id * 2.39996) % TAU;
        dx = Math.cos(a);
        dy = Math.sin(a);
        d = 1;
      } else {
        dx /= d;
        dy /= d;
      }
      const overlap = (minD - d) * 0.5;
      const total = e.mass + o.mass;
      e.x -= dx * overlap * (o.mass / total) * 2;
      e.y -= dy * overlap * (o.mass / total) * 2;
      o.x += dx * overlap * (e.mass / total) * 2;
      o.y += dy * overlap * (e.mass / total) * 2;
    }
  }
}

// Berührung mit dem Spieler
function contactDamage(run) {
  const p = run.player;
  if (p.dead) return;
  const safe = isPlayerInvulnerable(run);
  const list = run.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead || e.spawning || e.damage <= 0) continue;
    const rr = e.r * 0.85 + p.r;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    if (dx * dx + dy * dy >= rr * rr) continue;
    if (safe) continue;
    hurtPlayer(run, e.damage, e.boss ? e.boss.name : e.def.name, e.x, e.y);
    // Gegner prallt etwas zurück
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = 240 * (1 - e.knockResist);
    e.kx -= (dx / d) * push;
    e.ky -= (dy / d) * push;
    return;
  }
}

// Räumliches Raster mit allen lebenden Gegnern neu füllen
export function rebuildHash(run) {
  const hash = run.hash;
  hash.clear();
  const list = run.enemies;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) hash.insert(list[i]);
}

// Tote Gegner aus der Liste entfernen (an Ort und Stelle)
export function compactEnemies(run) {
  const list = run.enemies;
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    if (!list[i].dead) list[w++] = list[i];
  }
  list.length = w;
}

export function aliveCount(run) {
  let n = 0;
  for (const e of run.enemies) if (!e.dead) n++;
  return n;
}
