// Logik-Tests: Wegfindung und Fehler aus dem Review (wird von logic.test.js geladen, läuft auch einzeln)

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/config.js';
import { stepRun } from '../src/run.js';
import { createEnemy, addEnemy, damageEnemy } from '../src/enemies.js';
import { createBoss } from '../src/boss.js';
import { giveWeapon } from '../src/weapons.js';
import { createWorld, resolveCircle } from '../src/world.js';
import { near, idleActions, quietRun } from './helpers.js';

// Spieler festhalten, damit nur der Gegner sich bewegt
function holdPlayer(run, x, y) {
  const p = run.player;
  p.x = x;
  p.y = y;
  p.vx = 0;
  p.vy = 0;
}

test('Wegfindung: Panzer findet aus der L-Ecke heraus zum Spieler', () => {
  const run = quietRun(5, 2);
  run.god = true;
  const e = addEnemy(run, createEnemy(run, 'tank', 660, 580));
  let reached = false;
  for (let i = 0; i < 30 * 60 && !reached; i++) {
    holdPlayer(run, 400, 300);
    stepRun(run, 1 / 60, idleActions());
    reached = Math.hypot(e.x - 400, e.y - 300) < e.r + 40;
  }
  assert.ok(reached, `Panzer steht bei ${e.x.toFixed(0)},${e.y.toFixed(0)}`);
});

test('Wegfindung: Panzer finden zum Spieler, der in der Innenecke eines L steht', () => {
  const run = quietRun(11, 2);
  run.god = true;
  const e = addEnemy(run, createEnemy(run, 'tank', 400, 300));
  let reached = false;
  for (let i = 0; i < 30 * 60 && !reached; i++) {
    holdPlayer(run, 594, 494);
    stepRun(run, 1 / 60, idleActions());
    reached = Math.hypot(e.x - 594, e.y - 494) < e.r + 40;
  }
  assert.ok(reached, `Panzer steht bei ${e.x.toFixed(0)},${e.y.toFixed(0)}`);
});

test('Wand-Ecke: Normale hat Länge 1', () => {
  const world = createWorld(0);
  const pos = { x: 2, y: 3 };
  const n = { nx: 0, ny: 0 };
  assert.equal(resolveCircle(world, pos, 10, n), 1);
  assert.ok(near(Math.hypot(n.nx, n.ny), 1));
});

function guardianRun() {
  const run = quietRun(9, 0);
  run.god = true;
  const e = addEnemy(run, createBoss(run, 'guardian', 1000, 1200, 600, { intro: 0, bossNumber: 2 }));
  return { run, e };
}

test('Wächter: Phase 3 mitten in der Doppel-Salve – Spiralen und Ansturm laufen weiter', () => {
  const { run, e } = guardianRun();
  const b = e.boss;
  b.phase = 2;
  b.ringsLeft = 1;
  b.ringT = 0.3;
  damageEnemy(run, e, e.hp - e.maxHp * CONFIG.bosses.phases[1] + 1, {});
  assert.equal(b.phase, 3);
  assert.equal(b.ringsLeft, 0, 'Salve abgebrochen');
  let charged = false;
  for (let i = 0; i < 15 * 60; i++) {
    stepRun(run, 1 / 60, idleActions());
    if (b.charge === 'run') charged = true;
  }
  assert.ok(charged, 'Ansturm in Phase 3');
});

test('Wächter: Ansturm folgt der Warnlinie', () => {
  const { run, e } = guardianRun();
  const b = e.boss;
  b.phase = 2;
  b.salvoT = 99;
  b.chargeT = 0.01;
  // in voller Fahrt: darf beim Warnen nicht von der Linie wegrutschen
  e.vx = 150;
  e.vy = 80;
  let path = null;
  let startOk = false;
  for (let i = 0; i < 5 * 60; i++) {
    stepRun(run, 1 / 60, idleActions());
    if (b.charge === 'warn' && !path) path = b.path.slice();
    if (b.charge === 'run' && !startOk) startOk = near(e.x, path[0], 1) && near(e.y, path[1], 1);
    if (b.charge === 'stun') break;
  }
  assert.ok(path && startOk, 'Start am Anfang der Linie');
  const ex = path[path.length - 2];
  const ey = path[path.length - 1];
  assert.ok(Math.hypot(e.x - ex, e.y - ey) < 30, `Ende ${e.x.toFixed(0)},${e.y.toFixed(0)} statt ${ex.toFixed(0)},${ey.toFixed(0)}`);
});

test('Wächter: angekündigte Helfer zählen zur Obergrenze', () => {
  const { run, e } = guardianRun();
  const g = CONFIG.bosses.guardian;
  e.boss.phase = 3;
  run.noWaves = false;
  run.waves.state = 'fight';
  run.waves.plan = { groups: [] };
  for (let k = 0; k < 6; k++) {
    e.boss.summonT = 0.01;
    stepRun(run, 1 / 60, idleActions());
  }
  const helpers = run.waves.warnings.length + run.enemies.filter((o) => !o.dead && !o.boss).length;
  assert.ok(helpers <= g.summonMax, `Helfer: ${helpers}`);
});

test('Railgun trifft keine Mini-Teiler, die erst durch denselben Strahl entstehen', () => {
  const run = quietRun(3, 0);
  const p = run.player;
  giveWeapon(run, 'rail');
  const s = addEnemy(run, createEnemy(run, 'splitter', p.x + 250, p.y));
  s.speed = 0;
  s.hp = 1;
  for (let i = 0; i < 40 && !s.dead; i++) stepRun(run, 1 / 60, idleActions({ fire: true, aimAngle: 0 }));
  assert.ok(s.dead);
  const minis = run.enemies.filter((o) => o.type === 'mini');
  assert.equal(minis.length, CONFIG.enemies.splitter.splitInto);
  assert.ok(minis.every((m) => !m.dead), 'Minis überleben den Strahl');
});

test('Railgun mit Mehrfachschuss: die anderen Strahlen treffen die frischen Mini-Teiler nicht', () => {
  const run = quietRun(3, 0);
  const p = run.player;
  giveWeapon(run, 'rail');
  run.power.multi = 10;
  const s = addEnemy(run, createEnemy(run, 'splitter', p.x + 100, p.y));
  s.speed = 0;
  s.hp = 1;
  for (let i = 0; i < 40 && !s.dead; i++) stepRun(run, 1 / 60, idleActions({ fire: true, aimAngle: 0 }));
  assert.ok(s.dead);
  const minis = run.enemies.filter((o) => o.type === 'mini');
  assert.equal(minis.length, CONFIG.enemies.splitter.splitInto);
  assert.ok(minis.every((m) => !m.dead), 'Minis überleben den Schuss');
});

test('Schuss direkt an der Außenwand fliegt nicht aus der Arena', () => {
  const run = quietRun(3, 0);
  const p = run.player;
  holdPlayer(run, p.r, 800);
  run.arsenal.cooldown = 0;
  const pool = run.projectiles.player;
  let outside = 0;
  for (let i = 0; i < 30; i++) {
    stepRun(run, 1 / 60, idleActions({ fire: i === 0, aimAngle: Math.PI }));
    for (let k = 0; k < pool.count; k++) if (pool.items[k].x < 0) outside++;
  }
  assert.equal(outside, 0);
});

test('Leere Waffe: Pistole ist sofort nach dem kurzen Wechsel bereit', () => {
  const run = quietRun(3, 0);
  giveWeapon(run, 'rocket');
  run.arsenal.ammo.rocket = 1;
  run.arsenal.cooldown = 0;
  stepRun(run, 1 / 60, idleActions({ fire: true, aimAngle: 0 }));
  assert.equal(run.arsenal.current, 'pistol');
  assert.ok(run.arsenal.cooldown <= 1 / CONFIG.weapons.rocket.rate + 1e-6, `Pause ${run.arsenal.cooldown.toFixed(2)} s`);
});

test('Doppel-Dash: Druck während des ersten Dashes wird gemerkt', () => {
  const run = quietRun(3, 0);
  run.mods.dashExtra = 1;
  const p = run.player;
  p.dashCharges = 2;
  stepRun(run, 1 / 60, idleActions({ dash: true, moveX: 1 }));
  assert.ok(p.dashT > 0);
  stepRun(run, 1 / 60, idleActions({ dash: true, moveX: 1 }));
  let dashes = 1;
  for (let i = 0; i < 30; i++) {
    const before = p.dashT;
    stepRun(run, 1 / 60, idleActions({ moveX: 1 }));
    if (before === 0 && p.dashT > 0) dashes++;
  }
  assert.equal(dashes, 2);
  assert.equal(run.stats.dashes, 2);
});
