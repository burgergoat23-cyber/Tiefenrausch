// Bosse: Erscheinen, Phasen, Lebensleiste, Tod. Das Verhalten steht in boss_guardian.js und boss_brood.js.

import { CONFIG } from './config.js';
import { createEnemy, addEnemy, killEnemy } from './enemies.js';
import { guardianInit, guardianUpdate, guardianPhaseChange } from './boss_guardian.js';
import { broodInit, broodUpdate, broodSplit } from './boss_brood.js';
import { pickDrop, spawnPickup } from './pickups.js';
import { addBonus, bossBonus } from './scoring.js';
import { clampToFree } from './world.js';

const BEHAVIOR = {
  guardian: { init: guardianInit, update: guardianUpdate },
  brood: { init: broodInit, update: broodUpdate },
};

let familyId = 1;

// Leben eines Bosses beim n-ten Auftauchen
export function bossHp(kind, appearance, dual, bc = CONFIG.bosses) {
  return bc[kind].hp * Math.pow(1 + bc.hpGrowth, appearance - 1) * (dual ? bc.dualHpFactor : 1);
}

function bossDef(kind, hp, radius) {
  const bc = CONFIG.bosses[kind];
  return {
    name: bc.name, shape: kind, color: bc.color, hp, speed: bc.speed, damage: bc.damage,
    points: CONFIG.bosses.points, radius: radius || bc.radius, accel: 700, knockResist: 1, big: true,
  };
}

// Boss-Objekt erzeugen (auch für die kleinen Bruten nach der Teilung)
export function createBoss(run, kind, hp, x, y, opts = {}) {
  const e = createEnemy(run, kind, x, y, bossDef(kind, hp, opts.radius));
  e.mass = 40;
  const bc = CONFIG.bosses;
  e.boss = {
    kind,
    name: bc[kind].name,
    color: bc[kind].color,
    bossNumber: opts.bossNumber || 1,
    family: opts.family || { id: familyId++, name: bc[kind].name, color: bc[kind].color, members: 0, frac: 1, base: 1 },
    phase: opts.phase || 1,
    intro: opts.intro ?? bc.introTime,
    invuln: opts.intro ?? bc.introTime,
    roar: 0,
    speedMult: opts.speedMult || 1,
    child: !!opts.child,
    rot: 0,
  };
  e.boss.family.members++;
  e.spawning = e.boss.intro > 0;
  BEHAVIOR[kind].init(run, e);
  return e;
}

// Boss-Welle: Bosse am Rand gegenüber dem Spieler erscheinen lassen
export function spawnBosses(run, info) {
  const n = info.list.length;
  const p = run.player;
  const w = run.world;
  info.list.forEach((b, i) => {
    // gegenüberliegende Seite der Arena, mehrere Bosse nebeneinander
    const a = Math.atan2(w.height / 2 - p.y, w.width / 2 - p.x) + (n > 1 ? (i - (n - 1) / 2) * 1.1 : 0);
    const pos = { x: w.width / 2 + Math.cos(a) * 520, y: w.height / 2 + Math.sin(a) * 420 };
    clampToFree(w, pos, CONFIG.bosses[b.kind].radius + 10);
    const hp = bossHp(b.kind, b.appearance, info.dual);
    const e = addEnemy(run, createBoss(run, b.kind, hp, pos.x, pos.y, { bossNumber: info.bossNumber }));
    run.emit('bossSpawn', e.x, e.y, b.kind, e.r);
    if (i === 0) run.emit('bossAppear', e.x, e.y, b.kind);
  });
}

export function updateBoss(run, e, dt) {
  const b = e.boss;
  b.rot += dt * CONFIG.bosses.guardian.turnSpeed * b.speedMult;
  if (b.invuln > 0) b.invuln -= dt;
  if (b.intro > 0) {
    b.intro -= dt;
    e.vx = 0;
    e.vy = 0;
    if (b.intro <= 0) {
      e.spawning = false;
      run.emit('bossReady', e.x, e.y, b.kind);
    }
    return;
  }
  if (b.roar > 0) {
    // Brüllen beim Phasenwechsel: steht still
    b.roar -= dt;
    e.vx *= 0.85;
    e.vy *= 0.85;
    return;
  }
  BEHAVIOR[b.kind].update(run, e, dt);
}

// Phasenwechsel bei 66 % und 33 % Leben
export function onBossDamaged(run, e) {
  const b = e.boss;
  if (b.child || e.hp <= 0) return;
  const th = CONFIG.bosses.phases;
  const next = th[b.phase - 1];
  if (next === undefined || e.hp > e.maxHp * next) return;
  // nicht mehrere Phasen auf einmal überspringen
  e.hp = Math.max(e.hp, e.maxHp * next - 1);
  if (b.kind === 'brood' && b.phase === 2) {
    broodSplit(run, e);
    return;
  }
  b.phase++;
  b.roar = CONFIG.bosses.roarTime;
  b.invuln = CONFIG.bosses.roarTime;
  b.speedMult *= CONFIG.bosses.phaseSpeedup;
  e.charging = false;
  if (b.kind === 'guardian') guardianPhaseChange(e);
  run.emit('bossRoar', e.x, e.y, b.phase);
}

export function onBossKilled(run, e) {
  const b = e.boss;
  b.family.members--;
  run.emit('bossPartDeath', e.x, e.y, b.kind, e.r);
  if (b.family.members > 0) return;
  // Boss besiegt
  run.stats.bossesKilled++;
  const bonus = bossBonus(b.bossNumber);
  addBonus(run.score, bonus);
  run.emit('bossDeath', e.x, e.y, b.kind, bonus);
  run.emit('bonus', bonus, e.x, e.y);
  for (let i = 0; i < CONFIG.bosses.drops; i++) {
    const d = pickDrop(run.rng);
    spawnPickup(run, d.kind, d.id, e.x + Math.cos(i * 2.1) * 30, e.y + Math.sin(i * 2.1) * 30);
  }
  // letzter Boss tot: übrige Helfer zerfallen
  const bossLeft = run.enemies.some((o) => o.boss && !o.dead);
  if (!bossLeft) {
    for (const o of run.enemies) {
      if (!o.dead) {
        o.noDrop = true;
        killEnemy(run, o, '');
      }
    }
    run.waves.warnings.length = 0;
  }
}

// Lebensleisten für das HUD: [{ name, color, frac, phase }]
export function bossBars(run, out = []) {
  out.length = 0;
  const seen = new Set();
  for (const e of run.enemies) {
    if (!e.boss || e.dead) continue;
    const fam = e.boss.family;
    if (seen.has(fam.id)) continue;
    seen.add(fam.id);
    let hp = 0;
    let max = 0;
    let intro = 0;
    for (const o of run.enemies) {
      if (o.boss && !o.dead && o.boss.family === fam) {
        hp += o.hp;
        max += o.maxHp;
        intro = Math.max(intro, o.boss.intro);
      }
    }
    // nach der Teilung der Brut zeigt die Leiste das letzte Drittel weiter
    const frac = fam.base * (fam.childMax ? hp / fam.childMax : hp / max);
    out.push({ name: fam.name, color: fam.color, frac: Math.max(0, frac), phase: e.boss.phase, intro });
  }
  return out;
}

