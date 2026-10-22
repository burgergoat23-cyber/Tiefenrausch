// Projektile mit Object Pooling: Spieler-Kugeln, Raketen, gegnerische Kugeln, Railgun-Strahl.

import { CONFIG } from './config.js';
import { Pool } from './utils.js';
import { segmentCircle } from './collision.js';
import { segmentObstacles, raycast } from './world.js';
import { hurtPlayer, isPlayerInvulnerable } from './player.js';
import { damageEnemy, shieldBlocks } from './enemies.js';
import { rollDamage } from './scoring.js';

function makeProjectile() {
  return {
    team: 0, kind: '', weapon: '', x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 4,
    damage: 0, life: 0, age: 0, pierce: 0, bounce: 0, knock: 0, accel: 0, maxSpeed: 0,
    hits: [0, 0, 0, 0, 0, 0], hitCount: 0, counted: false, source: '',
  };
}

export function createProjectilePools() {
  return {
    player: new Pool(makeProjectile, 500),
    enemy: new Pool(makeProjectile, 400),
  };
}

export function spawnPlayerProjectile(run, weaponId, x, y, angle, speed) {
  const w = CONFIG.weapons[weaponId];
  const b = run.projectiles.player.spawn();
  if (!b) return null;
  b.team = 0;
  b.kind = weaponId === 'rocket' ? 'rocket' : 'bullet';
  b.weapon = weaponId;
  b.x = b.px = x;
  b.y = b.py = y;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.r = w.radius;
  b.damage = w.damage;
  b.life = w.life;
  b.age = 0;
  b.pierce = run.mods.pierce;
  b.bounce = run.mods.bounce;
  b.knock = w.knockback;
  b.accel = w.accel || 0;
  b.maxSpeed = w.maxSpeed || speed;
  b.hitCount = 0;
  b.counted = false;
  return b;
}

// Gegnerische Kugel (kind: 'orb' normal, 'boss' groß)
export function spawnEnemyProjectile(run, kind, x, y, angle, speed, radius, damage, life, source) {
  const b = run.projectiles.enemy.spawn();
  if (!b) return null;
  b.team = 1;
  b.kind = kind;
  b.weapon = '';
  b.x = b.px = x;
  b.y = b.py = y;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.r = radius;
  b.damage = damage;
  b.life = life;
  b.age = 0;
  b.pierce = 0;
  b.bounce = 0;
  b.knock = 0;
  b.accel = 0;
  b.hitCount = 0;
  b.source = source;
  return b;
}

const wallHit = { nx: 0, ny: 0 };
const candidates = [];
const order = [];
const dmgOut = { amount: 0, crit: false };

// Strecke gegen Arena-Rand und Hindernisse. Rückgabe: t (0..1) oder -1, Normale in wallHit.
function segmentWorld(world, x1, y1, x2, y2) {
  let best = -1;
  if (x2 < 0 && x1 >= 0) { best = x1 / (x1 - x2); wallHit.nx = 1; wallHit.ny = 0; }
  else if (x2 > world.width && x1 <= world.width) { best = (world.width - x1) / (x2 - x1); wallHit.nx = -1; wallHit.ny = 0; }
  if (y2 < 0 && y1 >= 0) {
    const t = y1 / (y1 - y2);
    if (best < 0 || t < best) { best = t; wallHit.nx = 0; wallHit.ny = 1; }
  } else if (y2 > world.height && y1 <= world.height) {
    const t = (world.height - y1) / (y2 - y1);
    if (best < 0 || t < best) { best = t; wallHit.nx = 0; wallHit.ny = -1; }
  }
  const t = segmentObstacles(world, x1, y1, x2, y2, obstacleHit);
  if (t >= 0 && (best < 0 || t < best)) { best = t; wallHit.nx = obstacleHit.nx; wallHit.ny = obstacleHit.ny; }
  return best;
}
const obstacleHit = { nx: 0, ny: 0 };

function alreadyHit(b, id) {
  for (let i = 0; i < b.hitCount; i++) if (b.hits[i] === id) return true;
  return false;
}

// Treffer eines Spieler-Projektils an einem Gegner. Rückgabe: true, wenn das Projektil weiterfliegt.
function hitEnemy(run, b, e) {
  if (!b.counted) {
    b.counted = true;
    run.stats.hits++;
  }
  if (b.kind === 'rocket') {
    explodeRocket(run, b, e);
    return false;
  }
  if (shieldBlocks(e, b.x, b.y)) {
    run.emit('shieldBlock', b.x, b.y, Math.atan2(b.vy, b.vx));
    return false;
  }
  rollDamage(b.damage, run.mods, run.rng, dmgOut);
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
  damageEnemy(run, e, dmgOut.amount, {
    crit: dmgOut.crit, weapon: b.weapon, knock: b.knock, kx: b.vx / sp, ky: b.vy / sp,
  });
  if (b.hitCount < b.hits.length) b.hits[b.hitCount++] = e.id;
  if (b.pierce > 0) {
    b.pierce--;
    return true;
  }
  return false;
}

function explodeRocket(run, b, direct) {
  const w = CONFIG.weapons.rocket;
  if (direct && !direct.dead) {
    rollDamage(w.damage, run.mods, run.rng, dmgOut);
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
    damageEnemy(run, direct, dmgOut.amount, {
      crit: dmgOut.crit, weapon: 'rocket', knock: w.knockback, kx: b.vx / sp, ky: b.vy / sp, ignoreShield: true,
    });
  }
  // Volltreffer bekommt Direkt- und Flächenschaden (60 + 40)
  const hits = run.explodeAt(b.x, b.y, w.splashRadius, w.splash, 'player', 'rocket', null);
  if (hits > 0 && !b.counted) {
    b.counted = true;
    run.stats.hits++;
  }
}

export function updatePlayerProjectiles(run, dt) {
  const pool = run.projectiles.player;
  const world = run.world;
  for (let i = pool.count - 1; i >= 0; i--) {
    const b = pool.items[i];
    b.px = b.x;
    b.py = b.y;
    b.age += dt;
    if (b.accel) {
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const ns = Math.min(b.maxSpeed, sp + b.accel * dt);
      b.vx *= ns / sp;
      b.vy *= ns / sp;
      run.emit('rocketTrail', b.x, b.y, b.vx, b.vy);
    }
    let alive = true;
    let x1 = b.x;
    let y1 = b.y;
    let x2 = b.x + b.vx * dt;
    let y2 = b.y + b.vy * dt;
    // bis zu zwei Abpraller pro Schritt auswerten
    for (let pass = 0; pass < 3 && alive; pass++) {
      const tw = segmentWorld(world, x1, y1, x2, y2);
      // Gegner entlang der Strecke sammeln und nach Entfernung ordnen
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const half = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / 2 + b.r;
      run.hash.query(mx, my, half, candidates);
      order.length = 0;
      for (let k = 0; k < candidates.length; k++) {
        const e = candidates[k];
        if (e.dead || e.spawning || alreadyHit(b, e.id)) continue;
        const t = segmentCircle(x1, y1, x2, y2, e.x, e.y, e.r + b.r);
        if (t < 0 || (tw >= 0 && t > tw)) continue;
        e._t = t;
        order.push(e);
      }
      order.sort((a, c) => a._t - c._t);
      for (let k = 0; k < order.length && alive; k++) {
        const e = order[k];
        b.x = x1 + (x2 - x1) * e._t;
        b.y = y1 + (y2 - y1) * e._t;
        alive = hitEnemy(run, b, e);
      }
      if (!alive) break;
      if (tw >= 0) {
        // Wand oder Hindernis
        const hx = x1 + (x2 - x1) * tw;
        const hy = y1 + (y2 - y1) * tw;
        if (b.kind !== 'rocket' && b.bounce > 0) {
          b.bounce--;
          const dot = b.vx * wallHit.nx + b.vy * wallHit.ny;
          b.vx -= 2 * dot * wallHit.nx;
          b.vy -= 2 * dot * wallHit.ny;
          const rest = 1 - tw;
          x1 = hx + wallHit.nx * 0.5;
          y1 = hy + wallHit.ny * 0.5;
          x2 = x1 + b.vx * dt * rest;
          y2 = y1 + b.vy * dt * rest;
          run.emit('bounce', hx, hy);
          continue;
        }
        b.x = hx;
        b.y = hy;
        if (b.kind === 'rocket') explodeRocket(run, b, null);
        else run.emit('bulletWall', hx, hy, Math.atan2(wallHit.ny, wallHit.nx));
        alive = false;
        break;
      }
      b.x = x2;
      b.y = y2;
      break;
    }
    if (alive) {
      b.life -= dt;
      if (b.life <= 0) {
        if (b.kind === 'rocket') explodeRocket(run, b, null);
        else run.emit('bulletFade', b.x, b.y);
        alive = false;
      }
    }
    if (!alive) pool.release(i);
  }
}

export function updateEnemyProjectiles(run, dt) {
  const pool = run.projectiles.enemy;
  const world = run.world;
  const p = run.player;
  const playerSafe = isPlayerInvulnerable(run);
  for (let i = pool.count - 1; i >= 0; i--) {
    const b = pool.items[i];
    b.px = b.x;
    b.py = b.y;
    b.age += dt;
    const x2 = b.x + b.vx * dt;
    const y2 = b.y + b.vy * dt;
    let alive = true;
    // Spieler (während Dash/Unverwundbarkeit fliegen Kugeln durch)
    if (!p.dead && !playerSafe && segmentCircle(b.x, b.y, x2, y2, p.x, p.y, p.r + b.r) >= 0) {
      hurtPlayer(run, b.damage, b.source, b.x, b.y);
      run.emit('enemyBulletHit', b.x, b.y);
      alive = false;
    } else {
      const tw = segmentWorld(world, b.x, b.y, x2, y2);
      if (tw >= 0) {
        b.x += (x2 - b.x) * tw;
        b.y += (y2 - b.y) * tw;
        run.emit('enemyBulletWall', b.x, b.y);
        alive = false;
      } else {
        b.x = x2;
        b.y = y2;
        b.life -= dt;
        if (b.life <= 0) {
          run.emit('enemyBulletFade', b.x, b.y);
          alive = false;
        }
      }
    }
    if (!alive) pool.release(i);
  }
}

// Railgun: sofortiger Strahl, durchschlägt alle Gegner auf der Linie bis zur Wand
const railNormal = { nx: 0, ny: 0 };
export function fireRail(run, x, y, angle, count = run.enemies.length) {
  const w = CONFIG.weapons.rail;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const len = raycast(run.world, x, y, dx, dy, w.range, railNormal);
  const ex = x + dx * len;
  const ey = y + dy * len;
  let hitAny = false;
  const list = run.enemies;
  // feste Anzahl: Gegner, die erst durch diesen Schuss entstehen (Mini-Teiler), trifft er nicht
  const n = Math.min(count, list.length);
  for (let i = 0; i < n; i++) {
    const e = list[i];
    if (e.dead || e.spawning) continue;
    if (segmentCircle(x, y, ex, ey, e.x, e.y, e.r + w.beamWidth / 2) < 0) continue;
    rollDamage(w.damage, run.mods, run.rng, dmgOut);
    damageEnemy(run, e, dmgOut.amount, {
      crit: dmgOut.crit, weapon: 'rail', knock: w.knockback, kx: dx, ky: dy, ignoreShield: true,
    });
    hitAny = true;
  }
  run.stats.shots++;
  if (hitAny) run.stats.hits++;
  run.emit('rail', x, y, ex, ey, angle);
}
