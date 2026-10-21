// Verhalten der normalen Gegnertypen. Jeder Typ: { init?, update, onDeath? }.

import { obstacleAt, lineOfSight, raycast } from './world.js';
import { spawnEnemyProjectile } from './projectiles.js';
import { createEnemy, addEnemy, removeEnemy } from './enemies.js';
import { addShockwave, addDelayedExplosion } from './hazards.js';
import { DEG, randRange, turnTowards, TAU } from './utils.js';

// --- Lenkhilfen --------------------------------------------------------------------

function approachVel(e, tx, ty, step) {
  const dx = tx - e.vx;
  const dy = ty - e.vy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= step || d < 1e-6) {
    e.vx = tx;
    e.vy = ty;
  } else {
    e.vx += (dx / d) * step;
    e.vy += (dy / d) * step;
  }
}

const AVOID_ANGLE = 55 * DEG;

// Richtung zum Ziel mit einfachem Ausweichen um Hindernisse
export function steerTo(run, e, tx, ty, speed, dt) {
  let dx = tx - e.x;
  let dy = ty - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 2) {
    approachVel(e, 0, 0, e.def.accel * dt);
    return;
  }
  dx /= d;
  dy /= d;
  const look = e.r + 55;
  if (e.avoidT > 0) {
    e.avoidT -= dt;
    const a = Math.atan2(dy, dx) + e.avoidSide * AVOID_ANGLE;
    dx = Math.cos(a);
    dy = Math.sin(a);
  } else if (d > look && obstacleAt(run.world, e.x + dx * look, e.y + dy * look, e.r * 0.9)) {
    // Block im Weg: nach links oder rechts ablenken
    const base = Math.atan2(dy, dx);
    let chosen = false;
    for (const side of [e.avoidSide, -e.avoidSide]) {
      const a = base + side * AVOID_ANGLE;
      if (!obstacleAt(run.world, e.x + Math.cos(a) * look, e.y + Math.sin(a) * look, e.r * 0.9)) {
        e.avoidSide = side;
        dx = Math.cos(a);
        dy = Math.sin(a);
        chosen = true;
        break;
      }
    }
    if (!chosen) {
      const a = base + e.avoidSide * Math.PI / 2;
      dx = Math.cos(a);
      dy = Math.sin(a);
    }
    e.avoidT = 0.3;
  }
  approachVel(e, dx * speed, dy * speed, e.def.accel * dt);
}

function brake(e, dt) {
  approachVel(e, 0, 0, e.def.accel * 1.5 * dt);
}

function distToPlayer(run, e) {
  const p = run.player;
  return Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
}

function facePlayer(run, e) {
  e.angle = Math.atan2(run.player.y - e.y, run.player.x - e.x);
}

function faceVelocity(e) {
  if (e.vx * e.vx + e.vy * e.vy > 25) e.angle = Math.atan2(e.vy, e.vx);
}

// Gegner bewegen sich zum Spieler (auch wenn er tot ist, laufen sie weiter zur letzten Stelle)
function chase(run, e, dt, speed = e.speed) {
  steerTo(run, e, run.player.x, run.player.y, speed, dt);
  faceVelocity(e);
}

// --- Typen -------------------------------------------------------------------------

const runner = {
  update(run, e, dt) {
    chase(run, e, dt);
  },
};

const sprinter = {
  init(run, e) {
    e.state = 'zig';
    e.stateT = randRange(run.rng, e.def.zigMin, e.def.zigMax);
    e.timerA = e.def.zigInterval;
  },
  update(run, e, dt) {
    const d = e.def;
    const p = run.player;
    e.stateT -= dt;
    if (e.state === 'zig') {
      e.timerA -= dt;
      if (e.timerA <= 0) {
        e.timerA = d.zigInterval;
        e.side = -e.side;
      }
      const base = Math.atan2(p.y - e.y, p.x - e.x) + e.side * d.zigAngle * DEG;
      steerTo(run, e, e.x + Math.cos(base) * 120, e.y + Math.sin(base) * 120, e.speed, dt);
      faceVelocity(e);
      const dist = distToPlayer(run, e);
      if ((e.stateT <= 0 || dist < d.sprintRange) && lineOfSight(run.world, e.x, e.y, p.x, p.y)) {
        e.state = 'pause';
        e.stateT = d.pauseTime;
        e.charging = true;
      }
    } else if (e.state === 'pause') {
      brake(e, dt);
      facePlayer(run, e);
      if (e.stateT <= 0) {
        e.state = 'sprint';
        e.stateT = d.sprintTime;
        e.charging = false;
        e.lockX = Math.cos(e.angle);
        e.lockY = Math.sin(e.angle);
        run.emit('sprint', e.x, e.y, e.angle);
      }
    } else if (e.state === 'sprint') {
      const sp = e.speed * d.sprintMult;
      e.vx = e.lockX * sp;
      e.vy = e.lockY * sp;
      run.emit('trail', e.x, e.y, e.vx, e.vy, e.def.color);
      if (e.stateT <= 0 || e.hitWall) {
        e.state = 'recover';
        e.stateT = d.recoverTime;
      }
    } else {
      brake(e, dt);
      if (e.stateT <= 0) {
        e.state = 'zig';
        e.stateT = randRange(run.rng, d.zigMin, d.zigMax);
      }
    }
  },
};

const shooter = {
  init(run, e) {
    e.timerA = randRange(run.rng, 0.8, e.def.fireEvery);
    e.timerB = randRange(run.rng, 1.5, 3);
  },
  update(run, e, dt) {
    const d = e.def;
    const p = run.player;
    const dist = distToPlayer(run, e);
    if (dist > d.maxDist) {
      steerTo(run, e, p.x, p.y, e.speed, dt);
    } else if (dist < d.minDist) {
      steerTo(run, e, e.x + (e.x - p.x), e.y + (e.y - p.y), e.speed, dt);
    } else {
      // seitlich ausweichen, Richtung ab und zu wechseln
      e.timerB -= dt;
      if (e.timerB <= 0 || e.hitWall) {
        e.side = -e.side;
        e.timerB = randRange(run.rng, 1.5, 3);
      }
      const a = Math.atan2(p.y - e.y, p.x - e.x) + e.side * Math.PI / 2;
      steerTo(run, e, e.x + Math.cos(a) * 100, e.y + Math.sin(a) * 100, e.speed * 0.6, dt);
    }
    facePlayer(run, e);
    if (p.dead) return;
    e.timerA -= dt;
    if (!e.charging && e.timerA <= d.telegraph) {
      // nur aufladen, wenn ein Schuss Sinn ergibt
      if (dist < d.fireRange && lineOfSight(run.world, e.x, e.y, p.x, p.y)) {
        e.charging = true;
        run.emit('enemyCharge', e.x, e.y, e.type);
      } else {
        e.timerA = d.telegraph + 0.3;
      }
    }
    if (e.charging && e.timerA <= 0) {
      e.charging = false;
      e.timerA = d.fireEvery + randRange(run.rng, -0.15, 0.25);
      const mx = e.x + Math.cos(e.angle) * (e.r + 4);
      const my = e.y + Math.sin(e.angle) * (e.r + 4);
      spawnEnemyProjectile(run, 'orb', mx, my, e.angle, d.bulletSpeed, d.bulletRadius, e.damage, d.bulletLife, 'Schütze');
      run.emit('enemyShot', mx, my, e.angle);
    }
  },
};

const bomber = {
  init(run, e) {
    e.state = 'chase';
  },
  update(run, e, dt) {
    const d = e.def;
    if (e.state === 'chase') {
      chase(run, e, dt);
      if (!run.player.dead && distToPlayer(run, e) <= d.triggerDist + run.player.r) {
        e.state = 'fuse';
        e.stateT = d.fuse;
        run.emit('fuse', e.x, e.y);
      }
    } else {
      brake(e, dt);
      e.stateT -= dt;
      if (e.stateT <= 0) {
        // Selbstzündung: trifft nur den Spieler
        run.explodeAt(e.x, e.y, d.blastRadius, d.damage, 'enemy', 'Bomber-Explosion');
        removeEnemy(e);
        run.emit('enemyGone', e.x, e.y, e.type);
      }
    }
  },
  onDeath(run, e) {
    // Vom Spieler getötet: Explosion trifft nur andere Gegner (kurz verzögert für eine Kettenreaktion)
    addDelayedExplosion(run, e.x, e.y, e.def.blastRadius, e.def.deathBlastDamage, 'player', 'bomber', 0.08);
  },
};

const tank = {
  init(run, e) {
    e.state = 'walk';
    e.timerA = randRange(run.rng, 1.5, e.def.stompEvery);
  },
  update(run, e, dt) {
    const d = e.def;
    if (e.state === 'walk') {
      chase(run, e, dt);
      e.timerA -= dt;
      if (e.timerA <= 0 && distToPlayer(run, e) < 650) {
        e.state = 'windup';
        e.stateT = d.stompWindup;
        e.charging = true;
        run.emit('tankWindup', e.x, e.y);
      }
    } else {
      brake(e, dt);
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.state = 'walk';
        e.charging = false;
        e.timerA = d.stompEvery;
        addShockwave(run, e.x, e.y, e.r, d.waveMaxRadius, d.waveSpeed, d.waveThickness, d.waveDamage, 'Panzer-Schockwelle');
        run.emit('stomp', e.x, e.y);
      }
    }
  },
};

const splitter = {
  update(run, e, dt) {
    chase(run, e, dt);
  },
  onDeath(run, e) {
    const n = e.def.splitInto;
    for (let i = 0; i < n; i++) {
      const a = e.angle + (i / n) * TAU;
      const m = createEnemy(run, 'mini', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
      m.kx = Math.cos(a) * 260;
      m.ky = Math.sin(a) * 260;
      m.popIn = 0.15;
      addEnemy(run, m);
    }
    run.emit('split', e.x, e.y);
  },
};

const mini = {
  update(run, e, dt) {
    chase(run, e, dt);
  },
};

const shield = {
  update(run, e, dt) {
    const p = run.player;
    // dreht sich langsam zum Spieler: von der Seite oder hinten verwundbar
    const target = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = turnTowards(e.angle, target, e.def.turnRate * dt);
    steerTo(run, e, p.x, p.y, e.speed, dt);
  },
};

const egg = {
  init(run, e) {
    e.stateT = e.def.hatchTime;
  },
  update(run, e, dt) {
    e.vx = 0;
    e.vy = 0;
    e.stateT -= dt;
    if (e.stateT <= 0) {
      const d = e.def;
      for (let i = 0; i < d.hatchCount; i++) {
        const a = run.rng() * TAU;
        const s = createEnemy(run, d.hatchInto, e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
        s.popIn = 0.2;
        addEnemy(run, s);
      }
      removeEnemy(e);
      run.emit('hatch', e.x, e.y);
    }
  },
};

export const ENEMY_AI = { runner, sprinter, shooter, bomber, tank, splitter, mini, shield, egg };

// Hilfsfunktion für Bosse und Gegner: Länge eines freien Weges
export function freeDistance(run, x, y, angle, max) {
  return raycast(run.world, x, y, Math.cos(angle), Math.sin(angle), max, null);
}

