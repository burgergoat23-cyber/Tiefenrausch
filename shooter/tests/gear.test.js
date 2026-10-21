// Logik-Tests: Waffen und Drops (wird von logic.test.js geladen, läuft auch einzeln)

import test from 'node:test';
import assert from 'node:assert/strict';

import { stepRun } from '../src/run.js';
import { mulberry32 } from '../src/utils.js';
import { createEnemy, addEnemy } from '../src/enemies.js';
import { near, idleActions, quietRun } from './helpers.js';

// --- Waffen und Drops ----------------------------------------------------------------

import { rollDrop, applyPickup } from '../src/pickups.js';
import { giveWeapon, startAmmo, maxAmmo, selectWeapon, fireRate } from '../src/weapons.js';

test('Drops: 10 % Chance, Verteilung Heilung 35 / Waffe 25 / Power-up 40', () => {
  const rng = mulberry32(5);
  const counts = { none: 0, heal: 0, weapon: 0, power: 0 };
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const d = rollDrop(rng, 0.1);
    counts[d ? d.kind : 'none']++;
  }
  const drops = N - counts.none;
  assert.ok(Math.abs(drops / N - 0.1) < 0.01);
  assert.ok(Math.abs(counts.heal / drops - 0.35) < 0.03);
  assert.ok(Math.abs(counts.weapon / drops - 0.25) < 0.03);
  assert.ok(Math.abs(counts.power / drops - 0.4) < 0.03);
});

test('Waffe aufheben: neu = Startmunition und ausrüsten, doppelt = Munition dazu bis 2× Start', () => {
  const run = quietRun();
  giveWeapon(run, 'shotgun');
  assert.equal(run.arsenal.current, 'shotgun');
  assert.equal(run.arsenal.ammo.shotgun, 40);
  selectWeapon(run, 'pistol');
  giveWeapon(run, 'shotgun');
  assert.equal(run.arsenal.current, 'pistol', 'schon vorhanden: nicht automatisch wechseln');
  assert.equal(run.arsenal.ammo.shotgun, 80);
  giveWeapon(run, 'shotgun');
  assert.equal(run.arsenal.ammo.shotgun, 80, 'höchstens doppelte Startmenge');
  run.mods.ammoMult = 1.5;
  assert.equal(startAmmo(run, 'shotgun'), 60);
  assert.equal(maxAmmo(run, 'shotgun'), 120);
});

test('Leere Waffe wechselt automatisch zur nächsten mit Munition, zuletzt Pistole', () => {
  const run = quietRun();
  giveWeapon(run, 'rocket');
  giveWeapon(run, 'shotgun');
  run.arsenal.ammo.shotgun = 1;
  let t = 0;
  while (run.arsenal.current === 'shotgun' && t < 3) {
    stepRun(run, 1 / 60, idleActions({ fire: true }));
    t += 1 / 60;
  }
  assert.equal(run.arsenal.current, 'rocket');
  run.arsenal.ammo.rocket = 1;
  for (let i = 0; i < 90; i++) stepRun(run, 1 / 60, idleActions({ fire: true }));
  assert.equal(run.arsenal.current, 'pistol');
});

test('Feuerrate: Pistole 5/s, MG 14/s, Schnellfeuer +60 %', () => {
  const run = quietRun();
  const count = (secs) => {
    const before = run.stats.shots;
    for (let i = 0; i < secs * 60; i++) stepRun(run, 1 / 60, idleActions({ fire: true, aimAngle: Math.PI / 2 }));
    return run.stats.shots - before;
  };
  const pistol = count(2);
  assert.ok(pistol >= 9 && pistol <= 11, `Pistole ${pistol} in 2 s`);
  giveWeapon(run, 'mg');
  run.arsenal.cooldown = 0;
  const mg = count(2);
  assert.ok(mg >= 26 && mg <= 30, `MG ${mg} in 2 s`);
  run.power.rapid = 10;
  assert.ok(near(fireRate(run, 'mg'), 14 * 1.6));
});

test('MG-Streuung wächst beim Dauerfeuer bis 12°', () => {
  const run = quietRun();
  giveWeapon(run, 'mg');
  for (let i = 0; i < 120; i++) stepRun(run, 1 / 60, idleActions({ fire: true }));
  assert.ok(near(run.arsenal.mgSpread, 12, 1e-9));
  for (let i = 0; i < 120; i++) stepRun(run, 1 / 60, idleActions());
  assert.ok(near(run.arsenal.mgSpread, 7, 1e-9));
});

test('Rakete: Flächenschaden trifft mehrere, schadet dem Spieler nicht', () => {
  const run = quietRun(3, 0);
  const p = run.player;
  giveWeapon(run, 'rocket');
  run.arsenal.cooldown = 0; // Wechsel-Verzögerung überspringen
  const a = addEnemy(run, createEnemy(run, 'tank', p.x + 300, p.y));
  const b = addEnemy(run, createEnemy(run, 'tank', p.x + 300, p.y + 70));
  a.speed = b.speed = 0;
  for (let i = 0; i < 60; i++) stepRun(run, 1 / 60, idleActions({ fire: i < 2, aimAngle: 0 }));
  assert.ok(a.hp < a.maxHp - 90, `direkt ${a.maxHp - a.hp}`);
  assert.ok(b.hp < b.maxHp - 30, `Fläche ${b.maxHp - b.hp}`);
  // Rakete direkt vor dem Spieler zünden
  const c = addEnemy(run, createEnemy(run, 'runner', p.x + 40, p.y));
  c.speed = 0;
  run.arsenal.cooldown = 0;
  for (let i = 0; i < 30; i++) stepRun(run, 1 / 60, idleActions({ fire: i < 1, aimAngle: 0 }));
  assert.equal(p.hp, 100);
});

test('Railgun durchschlägt alle Gegner in einer Linie', () => {
  const run = quietRun(3, 0);
  const p = run.player;
  giveWeapon(run, 'rail');
  const list = [200, 320, 440].map((d) => addEnemy(run, createEnemy(run, 'runner', p.x + d, p.y)));
  list.forEach((e) => { e.speed = 0; });
  for (let i = 0; i < 40; i++) stepRun(run, 1 / 60, idleActions({ fire: true, aimAngle: 0 }));
  assert.ok(list.every((e) => e.dead), 'alle drei tot');
  assert.equal(run.arsenal.ammo.rail, 14);
});

test('Power-ups: Dauer verlängert sich, höchstens doppelt; Schild 50', () => {
  const run = quietRun();
  applyPickup(run, { kind: 'power', id: 'rapid', x: 0, y: 0 });
  assert.equal(run.power.rapid, 8);
  applyPickup(run, { kind: 'power', id: 'rapid', x: 0, y: 0 });
  applyPickup(run, { kind: 'power', id: 'rapid', x: 0, y: 0 });
  assert.equal(run.power.rapid, 16);
  applyPickup(run, { kind: 'power', id: 'shield', x: 0, y: 0 });
  assert.equal(run.power.shield.amount, 50);
  assert.equal(run.power.shield.t, 12);
  run.player.hp = 50;
  applyPickup(run, { kind: 'heal', id: 'heal', x: 0, y: 0 });
  assert.equal(run.player.hp, 75);
});

test('Drops werden eingesammelt und verschwinden nach 12 s', () => {
  const run = quietRun();
  const p = run.player;
  run.pickups.push({ kind: 'heal', id: 'heal', x: p.x + 40, y: p.y, px: 0, py: 0, vx: 0, vy: 0, age: 0, life: 12, magnet: false, dead: false, seed: 0 });
  run.pickups.push({ kind: 'heal', id: 'heal', x: p.x + 500, y: p.y, px: 0, py: 0, vx: 0, vy: 0, age: 0, life: 12, magnet: false, dead: false, seed: 0 });
  p.hp = 50;
  for (let i = 0; i < 60; i++) stepRun(run, 1 / 60, idleActions());
  assert.equal(p.hp, 75, 'naher Drop zieht sich heran und heilt');
  assert.equal(run.pickups.length, 1);
  for (let i = 0; i < 12 * 60; i++) stepRun(run, 1 / 60, idleActions());
  assert.equal(run.pickups.length, 0, 'ferner Drop verschwindet');
});
