// Boss 1: Der Wächter – großer roter Ring mit Kern.
// Phase 1: Kreis-Salven mit Lücke. Phase 2: zusätzlich Ansturm mit Warnlinie (prallt an Wänden ab).
// Phase 3: ruft alle 6 s Läufer, die Salven werden zu Spiralen.

import { CONFIG } from './config.js';
import { spawnEnemyProjectile } from './projectiles.js';
import { steerTo } from './enemy_ai.js';
import { resolveCircle } from './world.js';
import { queueSpawn } from './wave_director.js';
import { TAU, randInt, clamp } from './utils.js';

const G = () => CONFIG.bosses.guardian;

export function guardianInit(run, e) {
  const g = G();
  const b = e.boss;
  b.salvoT = g.salvoEvery * 0.6;
  b.ringsLeft = 0;
  b.ringT = 0;
  b.gapStart = 0;
  b.ringOffset = 0;
  b.charge = 'idle';
  b.chargeT = g.chargeEvery * 0.5;
  b.cdx = 1;
  b.cdy = 0;
  b.path = [];
  b.summonT = 2;
  b.spiral = 'pause';
  b.spiralT = 1;
  b.spiralFire = 0;
  b.spiralRot = 0;
  b.spiralDir = 1;
  b.orbit = run.rng() < 0.5 ? -1 : 1;
}

function fireRing(run, e, offset) {
  const g = G();
  const b = e.boss;
  const n = g.salvoCount;
  const speed = g.salvoSpeed * (1 + 0.08 * (b.phase - 1));
  for (let i = 0; i < n; i++) {
    if ((i - b.gapStart + n) % n < g.salvoGap) continue; // Lücke zum Durchschlüpfen
    const a = b.rot + offset + (i / n) * TAU;
    spawnEnemyProjectile(run, 'boss', e.x + Math.cos(a) * (e.r + 8), e.y + Math.sin(a) * (e.r + 8), a, speed,
      g.bulletRadius, g.bulletDamage, 6, b.name);
  }
  run.emit('bossShot', e.x, e.y, 'ring');
}

// Weg des Ansturms vorausberechnen (gleiche Physik wie der echte Ansturm)
function chargePath(run, e, dx, dy) {
  const g = G();
  const step = 1 / 60;
  const p = { x: e.x, y: e.y };
  const out = [p.x, p.y];
  const n = { nx: 0, ny: 0 };
  const steps = Math.round(g.chargeTime / step);
  const speed = g.chargeSpeed * e.boss.speedMult;
  const probe = { x: 0, y: 0 };
  for (let i = 0; i < steps; i++) {
    // wie im echten Ansturm: erst vorausschauen und abprallen, dann bewegen
    probe.x = p.x + dx * speed * step;
    probe.y = p.y + dy * speed * step;
    if (resolveCircle(run.world, probe, e.r, n)) {
      const dot = dx * n.nx + dy * n.ny;
      if (dot < 0) {
        dx -= 2 * dot * n.nx;
        dy -= 2 * dot * n.ny;
        out.push(p.x, p.y);
      }
    }
    p.x += dx * speed * step;
    p.y += dy * speed * step;
    resolveCircle(run.world, p, e.r, null);
  }
  out.push(p.x, p.y);
  return out;
}

const wallN = { nx: 0, ny: 0 };

function updateCharge(run, e, dt) {
  const g = G();
  const b = e.boss;
  const p = run.player;
  if (b.charge === 'idle') {
    b.chargeT -= dt;
    if (b.chargeT <= 0 && b.ringsLeft === 0 && !e.charging) {
      b.charge = 'warn';
      b.chargeWarn = g.chargeWarn;
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      b.cdx = (p.x - e.x) / d;
      b.cdy = (p.y - e.y) / d;
      b.path = chargePath(run, e, b.cdx, b.cdy);
      // stehen bleiben, damit der Ansturm genau der Warnlinie folgt
      e.vx = 0;
      e.vy = 0;
      run.emit('bossTelegraph', e.x, e.y, 'charge');
      return true;
    }
    return false;
  }
  if (b.charge === 'warn') {
    b.chargeWarn -= dt;
    e.vx = 0;
    e.vy = 0;
    if (b.chargeWarn <= 0) {
      b.charge = 'run';
      b.chargeRun = g.chargeTime;
      e.x = b.path[0];
      e.y = b.path[1];
      run.emit('bossCharge', e.x, e.y);
    }
    return true;
  }
  if (b.charge === 'run') {
    b.chargeRun -= dt;
    const sp = g.chargeSpeed * b.speedMult;
    // Abprallen an Wänden und Hindernissen
    const tx = e.x + b.cdx * sp * dt;
    const ty = e.y + b.cdy * sp * dt;
    const probe = { x: tx, y: ty };
    if (resolveCircle(run.world, probe, e.r, wallN)) {
      const dot = b.cdx * wallN.nx + b.cdy * wallN.ny;
      if (dot < 0) {
        b.cdx -= 2 * dot * wallN.nx;
        b.cdy -= 2 * dot * wallN.ny;
        run.emit('bossAttack', probe.x, probe.y, 'bounce');
      }
    }
    e.vx = b.cdx * sp;
    e.vy = b.cdy * sp;
    run.emit('trail', e.x, e.y, e.vx, e.vy, b.color);
    if (b.chargeRun <= 0) {
      b.charge = 'stun';
      b.stunT = g.chargeStun;
      b.path = [];
    }
    return true;
  }
  // kurz benommen: verwundbares Zeitfenster
  b.stunT -= dt;
  e.vx *= 0.85;
  e.vy *= 0.85;
  if (b.stunT <= 0) {
    b.charge = 'idle';
    b.chargeT = g.chargeEvery / b.speedMult;
  }
  return true;
}

function updateSalvo(run, e, dt) {
  const g = G();
  const b = e.boss;
  if (b.ringsLeft > 0) {
    b.ringT -= dt;
    if (b.ringT <= 0) {
      b.ringsLeft--;
      fireRing(run, e, b.ringOffset);
      b.ringOffset += Math.PI / g.salvoCount; // zweiter Ring halb versetzt
      b.ringT = g.salvoRingDelay;
    }
    return;
  }
  b.salvoT -= dt;
  if (!e.charging && b.salvoT <= g.salvoTelegraph) {
    e.charging = true;
    run.emit('bossTelegraph', e.x, e.y, 'salvo');
  }
  if (b.salvoT <= 0) {
    e.charging = false;
    b.salvoT = g.salvoEvery / b.speedMult;
    b.gapStart = randInt(run.rng, 0, g.salvoCount - 1);
    b.ringOffset = 0;
    b.ringsLeft = b.phase >= 2 ? g.salvoRings2 : 1;
    b.ringT = 0;
  }
}

function updateSpiral(run, e, dt) {
  const g = G();
  const b = e.boss;
  b.spiralT -= dt;
  if (b.spiral === 'pause') {
    if (b.spiralT <= 0) {
      b.spiral = 'tele';
      b.spiralT = g.salvoTelegraph;
      e.charging = true;
      run.emit('bossTelegraph', e.x, e.y, 'spiral');
    }
  } else if (b.spiral === 'tele') {
    if (b.spiralT <= 0) {
      b.spiral = 'fire';
      b.spiralT = g.spiralTime;
      b.spiralFire = 0;
      b.spiralDir = -b.spiralDir;
      e.charging = false;
      run.emit('bossShot', e.x, e.y, 'spiral');
    }
  } else {
    b.spiralRot += g.spiralTurn * b.spiralDir * dt;
    b.spiralFire -= dt;
    while (b.spiralFire <= 0) {
      b.spiralFire += g.spiralInterval;
      for (let k = 0; k < g.spiralArms; k++) {
        const a = b.spiralRot + (k / g.spiralArms) * TAU;
        spawnEnemyProjectile(run, 'boss', e.x + Math.cos(a) * (e.r + 8), e.y + Math.sin(a) * (e.r + 8), a,
          g.spiralSpeed, g.bulletRadius * 0.85, g.bulletDamage, 6, b.name);
      }
    }
    if (b.spiralT <= 0) {
      b.spiral = 'pause';
      b.spiralT = g.spiralPause / b.speedMult;
    }
  }
}

function updateSummon(run, e, dt) {
  const g = G();
  const b = e.boss;
  b.summonT -= dt;
  if (b.summonT > 0) return;
  b.summonT = g.summonEvery;
  // angekündigte Helfer zählen mit, sonst wächst die Schar über die Grenze
  let helpers = run.waves.warnings.length;
  for (const o of run.enemies) if (!o.dead && !o.boss) helpers++;
  const n = Math.min(g.summonCount, g.summonMax - helpers);
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + b.rot;
    const pt = { x: e.x + Math.cos(a) * (e.r + 70), y: e.y + Math.sin(a) * (e.r + 70) };
    queueSpawn(run, g.summonType, pt.x, pt.y);
  }
  run.emit('bossSummon', e.x, e.y);
}

// Phasenwechsel: laufende Salve und Ansturm abbrechen (sonst hängt Phase 3 ohne Spiralen)
export function guardianPhaseChange(e) {
  const b = e.boss;
  b.ringsLeft = 0;
  if (b.charge === 'warn' || b.charge === 'run') {
    b.charge = 'idle';
    b.path = [];
    b.chargeT = G().chargeEvery / b.speedMult;
  }
}

export function guardianUpdate(run, e, dt) {
  const g = G();
  const b = e.boss;
  const p = run.player;
  const busy = b.phase >= 2 && updateCharge(run, e, dt);
  if (!busy) {
    // um den Spieler kreisen und Abstand halten
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx) + b.orbit * 0.35;
    const keep = clamp(g.keepDist, 200, 600);
    const tx = p.x + Math.cos(a) * keep;
    const ty = p.y + Math.sin(a) * keep;
    steerTo(run, e, tx, ty, g.speed * b.speedMult * (d > keep * 1.6 ? 1.6 : 1), dt);
    if (e.hitWall) b.orbit = -b.orbit;
  }
  if (b.charge === 'idle') {
    if (b.phase >= 3) updateSpiral(run, e, dt);
    else updateSalvo(run, e, dt);
  }
  if (b.phase >= 3) updateSummon(run, e, dt);
  e.angle = b.rot;
}
