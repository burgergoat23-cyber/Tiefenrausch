// Boss 2: Die Brut – pulsierender grün-lila Klumpen.
// Phase 1: träge, legt Eier (schlüpfen nach 3 s zu Sprintern, zerstörbar).
// Phase 2: zusätzlich Säure-Geschosse, die 4 s liegenbleibende Pfützen machen.
// Phase 3: teilt sich in 2 kleinere Bosse mit je 30 % Leben.

import { CONFIG } from './config.js';
import { createEnemy, addEnemy, removeEnemy } from './enemies.js';
import { createBoss } from './boss.js';
import { steerTo } from './enemy_ai.js';
import { addAcidGlob } from './hazards.js';
import { TAU, randRange } from './utils.js';

const B = () => CONFIG.bosses.brood;

export function broodInit(run, e) {
  const b = e.boss;
  b.eggT = 1.5;
  b.acidT = 2;
  b.wobble = run.rng() * TAU;
}

function countEggs(run) {
  let n = 0;
  for (const o of run.enemies) if (!o.dead && o.type === 'egg') n++;
  return n;
}

function layEggs(run, e) {
  const c = B();
  const room = c.maxEggs - countEggs(run);
  const n = Math.min(c.eggCount, room);
  // hinter sich ablegen
  const back = Math.atan2(-e.vy, -e.vx);
  for (let i = 0; i < n; i++) {
    const a = back + (i - (n - 1) / 2) * 0.8 + randRange(run.rng, -0.2, 0.2);
    const egg = createEnemy(run, 'egg', e.x + Math.cos(a) * (e.r + 6), e.y + Math.sin(a) * (e.r + 6));
    egg.kx = Math.cos(a) * 220;
    egg.ky = Math.sin(a) * 220;
    egg.knockResist = 0;
    egg.popIn = 0.2;
    addEnemy(run, egg);
  }
  if (n > 0) run.emit('bossLay', e.x, e.y);
}

function spitAcid(run, e) {
  const c = B();
  const p = run.player;
  for (let i = 0; i < c.acidCount; i++) {
    // erstes Geschoss genau auf den Spieler, die anderen daneben
    const ox = i === 0 ? 0 : randRange(run.rng, -c.acidSpread, c.acidSpread);
    const oy = i === 0 ? 0 : randRange(run.rng, -c.acidSpread, c.acidSpread);
    const tx = Math.max(40, Math.min(run.world.width - 40, p.x + ox + p.vx * 0.3));
    const ty = Math.max(40, Math.min(run.world.height - 40, p.y + oy + p.vy * 0.3));
    addAcidGlob(run, e.x, e.y, tx, ty, c.acidFlight);
  }
  run.emit('bossAttack', e.x, e.y, 'acid');
}

export function broodUpdate(run, e, dt) {
  const c = B();
  const b = e.boss;
  const p = run.player;
  const rate = b.child ? c.childRate : 1;
  // träge auf den Spieler zu, mit Schlingern
  b.wobble += dt * 1.7;
  const side = Math.sin(b.wobble) * 90;
  const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
  const nx = (p.x - e.x) / d;
  const ny = (p.y - e.y) / d;
  steerTo(run, e, p.x - ny * side, p.y + nx * side, c.speed * b.speedMult * (b.child ? c.childSpeed : 1), dt);
  e.angle = Math.atan2(e.vy, e.vx);

  b.eggT -= dt;
  if (b.eggT <= 0) {
    b.eggT = (c.eggEvery * rate) / b.speedMult;
    layEggs(run, e);
  }
  if (b.phase >= 2) {
    b.acidT -= dt;
    if (b.acidT <= 0) {
      b.acidT = (c.acidEvery * rate) / b.speedMult;
      spitAcid(run, e);
    }
  }
}

// Teilung bei 33 %: zwei kleinere Bruten mit je 30 % Leben
export function broodSplit(run, e) {
  const c = B();
  const b = e.boss;
  const fam = b.family;
  removeEnemy(e);
  fam.members--;
  fam.base = CONFIG.bosses.phases[1];
  const hp = e.maxHp * c.splitHp;
  fam.childMax = hp * 2;
  for (let i = 0; i < 2; i++) {
    const a = e.angle + Math.PI / 2 + i * Math.PI;
    const child = createBoss(run, 'brood', hp, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, {
      radius: c.childRadius, family: fam, bossNumber: b.bossNumber, phase: 3, intro: 0, child: true,
      speedMult: b.speedMult * CONFIG.bosses.phaseSpeedup,
    });
    child.kx = Math.cos(a) * 380;
    child.ky = Math.sin(a) * 380;
    child.boss.invuln = CONFIG.bosses.roarTime;
    child.boss.eggT = 2 + i;
    child.boss.acidT = 1.5 + i * 1.2;
    addEnemy(run, child);
  }
  run.emit('bossRoar', e.x, e.y, 3);
  run.emit('bossSplit', e.x, e.y, e.r);
}
