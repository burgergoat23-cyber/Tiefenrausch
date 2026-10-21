// Logik-Tests ohne Browser:  node tests/logic.test.js   (oder: npm test)

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/config.js';
import { circleCircle, circleRect, segmentCircle, rayCircle, segmentRect, SpatialHash } from '../src/collision.js';
import { LAYOUTS, createWorld, resolveCircle, raycast } from '../src/world.js';
import { FixedStepper } from '../src/game.js';
import { createRun, stepRun } from '../src/run.js';
import { mulberry32 } from '../src/utils.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

function idleActions(over = {}) {
  return {
    moveX: 0, moveY: 0, aimValid: true, aimAngle: 0, aimReach: 0, aimMode: 'stick',
    fire: false, dash: false, weaponDir: 0, weaponSlot: 0, assist: false, ...over,
  };
}

// --- Kollision ---------------------------------------------------------------------

test('Kreis gegen Kreis', () => {
  assert.equal(circleCircle(0, 0, 10, 15, 0, 6), true);
  assert.equal(circleCircle(0, 0, 10, 16, 0, 6), false);
  assert.equal(circleCircle(0, 0, 10, 0, 0, 1), true);
});

test('Kreis gegen Rechteck', () => {
  assert.equal(circleRect(50, 50, 5, 0, 0, 100, 100), true);   // innen
  assert.equal(circleRect(-4, 50, 5, 0, 0, 100, 100), true);   // berührt links
  assert.equal(circleRect(-6, 50, 5, 0, 0, 100, 100), false);
  assert.equal(circleRect(-3, -3, 5, 0, 0, 100, 100), true);   // Ecke, Abstand 4.24
  assert.equal(circleRect(-4, -4, 5, 0, 0, 100, 100), false);  // Ecke, Abstand 5.66
});

test('Strahl gegen Kreis (Railgun)', () => {
  assert.ok(near(rayCircle(0, 0, 1, 0, 100, 50, 0, 10), 40));
  assert.equal(rayCircle(0, 0, 1, 0, 100, 50, 20, 10), -1);    // daneben
  assert.equal(rayCircle(0, 0, 1, 0, 30, 50, 0, 10), -1);      // zu kurz
  assert.equal(rayCircle(0, 0, -1, 0, 100, 50, 0, 10), -1);    // falsche Richtung
  assert.equal(rayCircle(50, 0, 1, 0, 100, 50, 0, 10), 0);     // startet im Kreis
  assert.ok(near(segmentCircle(0, 0, 100, 0, 50, 5, 10), (50 - Math.sqrt(75)) / 100));
});

test('Strecke gegen Rechteck mit Normale', () => {
  const out = { nx: 0, ny: 0 };
  const t = segmentRect(0, 50, 100, 50, 40, 0, 20, 100, out);
  assert.ok(near(t, 0.4));
  assert.equal(out.nx, -1);
  assert.equal(segmentRect(0, 150, 100, 150, 40, 0, 20, 100, out), -1);
  const t2 = segmentRect(50, 200, 50, 0, 0, 0, 100, 100, out);
  assert.ok(near(t2, 0.5));
  assert.equal(out.ny, 1);
});

test('Räumliches Raster findet Nachbarn', () => {
  const hash = new SpatialHash(1000, 1000, 100);
  const objs = [{ x: 50, y: 50, r: 10 }, { x: 160, y: 50, r: 10 }, { x: 900, y: 900, r: 10 }];
  objs.forEach((o) => hash.insert(o));
  const out = [];
  hash.query(60, 60, 120, out);
  assert.ok(out.includes(objs[0]) && out.includes(objs[1]));
  assert.ok(!out.includes(objs[2]));
  hash.clear();
  hash.query(60, 60, 120, out);
  assert.equal(out.length, 0);
});

// --- Arena -------------------------------------------------------------------------

test('Alle Layouts: 6-10 Hindernisse, Startbereich frei', () => {
  assert.equal(LAYOUTS.length, 4);
  for (let i = 0; i < LAYOUTS.length; i++) {
    const w = createWorld(i);
    assert.ok(w.obstacles.length >= 6 && w.obstacles.length <= 10, `Layout ${i}`);
    for (const o of w.obstacles) {
      const hit = o.shape === 'rect'
        ? circleRect(w.startX, w.startY, CONFIG.arena.safeRadius, o.x, o.y, o.w, o.h)
        : circleCircle(w.startX, w.startY, CONFIG.arena.safeRadius, o.x, o.y, o.r);
      assert.equal(hit, false, `Layout ${i} Hindernis im Startbereich`);
    }
  }
});

test('Kreis wird aus Wand und Hindernis geschoben', () => {
  const w = createWorld(1);
  const e = { x: -50, y: 800 };
  resolveCircle(w, e, 14, null);
  assert.equal(e.x, 14);
  const o = w.obstacles[0];
  const e2 = { x: o.x + 5, y: o.y + o.h / 2 };
  resolveCircle(w, e2, 14, null);
  assert.ok(!circleRect(e2.x, e2.y, 13.9, o.x, o.y, o.w, o.h));
});

test('Raycast stoppt an der Wand', () => {
  const w = createWorld(0);
  const d = raycast(w, 1200, 800, 0, -1, 5000, null);
  assert.ok(d <= 800 + 1e-6);
});

// --- Game Loop ---------------------------------------------------------------------

test('Fester Zeitschritt: 60 Schritte pro Sekunde, unabhängig von der Bildrate', () => {
  for (const hz of [30, 60, 120, 144]) {
    const s = new FixedStepper();
    let steps = 0;
    for (let i = 0; i < hz; i++) s.advance(1 / hz, () => steps++);
    assert.ok(Math.abs(steps - 60) <= 1, `${hz} Hz -> ${steps} Schritte`);
  }
});

test('Ruckler werden auf 0,1 s begrenzt', () => {
  const s = new FixedStepper();
  let steps = 0;
  s.advance(2.0, () => steps++);
  assert.ok(steps <= 7);
});

// --- Spieler -----------------------------------------------------------------------

test('Diagonal nicht schneller als gerade', () => {
  const run1 = createRun({ seed: 1, layout: 0 });
  const run2 = createRun({ seed: 1, layout: 0 });
  for (let i = 0; i < 60; i++) {
    stepRun(run1, 1 / 60, idleActions({ moveX: 1 }));
    stepRun(run2, 1 / 60, idleActions({ moveX: 1, moveY: 1 }));
  }
  const v1 = Math.hypot(run1.player.vx, run1.player.vy);
  const v2 = Math.hypot(run2.player.vx, run2.player.vy);
  assert.ok(near(v1, CONFIG.player.maxSpeed, 1));
  assert.ok(near(v2, CONFIG.player.maxSpeed, 1));
});

test('Reibung stoppt in ca. 0,12 s', () => {
  const run = createRun({ seed: 1, layout: 0 });
  for (let i = 0; i < 40; i++) stepRun(run, 1 / 60, idleActions({ moveX: 1 }));
  let t = 0;
  while (Math.hypot(run.player.vx, run.player.vy) > 0.01 && t < 1) {
    stepRun(run, 1 / 60, idleActions());
    t += 1 / 60;
  }
  assert.ok(t <= 0.14, `stoppt nach ${t.toFixed(3)} s`);
});

test('Dash: ca. 180 Einheiten, Abklingzeit 1,5 s, unverwundbar', () => {
  const run = createRun({ seed: 1, layout: 0 });
  run.player.y = 1500; // freie Bahn am unteren Rand
  run.player.x = 1000;
  const x0 = run.player.x;
  stepRun(run, 1 / 60, idleActions({ moveX: 1, dash: true }));
  let dashing = 0;
  for (let i = 0; i < 30; i++) {
    if (run.player.dashT > 0) dashing++;
    stepRun(run, 1 / 60, idleActions());
  }
  const moved = run.player.x - x0;
  assert.ok(moved > 165 && moved < 230, `Dash-Weg ${moved.toFixed(1)}`);
  assert.ok(dashing >= 7 && dashing <= 10);
  assert.equal(run.player.dashCharges, 0);
  stepRun(run, 1 / 60, idleActions({ dash: true }));
  assert.equal(run.player.dashT, 0, 'kein Dash während der Abklingzeit');
  for (let i = 0; i < 90; i++) stepRun(run, 1 / 60, idleActions());
  assert.equal(run.player.dashCharges, 1);
});

test('Zufall mit Seed ist reproduzierbar', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

// --- Kampf -------------------------------------------------------------------------

import { createEnemy, addEnemy } from '../src/enemies.js';
import { hurtPlayer } from '../src/player.js';
import { rollDamage, comboMultiplier, registerKill, comboOnHit, createScore, updateCombo } from '../src/scoring.js';

function quietRun(seed = 7, layout = 0) {
  return createRun({ seed, layout, noWaves: true });
}

test('Pistole tötet einen Läufer, Punkte werden gutgeschrieben', () => {
  const run = quietRun();
  const p = run.player;
  const e = addEnemy(run, createEnemy(run, 'runner', p.x + 300, p.y));
  e.speed = 0;
  let t = 0;
  while (!e.dead && t < 5) {
    stepRun(run, 1 / 60, idleActions({ fire: true, aimAngle: 0 }));
    t += 1 / 60;
  }
  assert.ok(e.dead, 'Läufer tot');
  assert.equal(run.stats.kills, 1);
  assert.equal(run.score.score, CONFIG.enemies.runner.points);
  assert.ok(run.stats.hits >= 3 && run.stats.shots >= run.stats.hits);
});

test('Schaden mit Upgrade und kritischem Treffer', () => {
  const mods = { dmgMult: 1.3, crit: 0 };
  assert.ok(near(rollDamage(10, mods, () => 0.5).amount, 13));
  const crit = rollDamage(10, { dmgMult: 1, crit: 0.1 }, () => 0.05);
  assert.equal(crit.crit, true);
  assert.equal(crit.amount, 20);
  const noCrit = rollDamage(10, { dmgMult: 1, crit: 0.1 }, () => 0.5);
  assert.equal(noCrit.crit, false);
  assert.equal(noCrit.amount, 10);
});

test('Schild absorbiert Schaden, Rest geht aufs Leben', () => {
  const run = quietRun();
  run.power.shield.amount = 50;
  run.power.shield.t = 12;
  hurtPlayer(run, 30, 'Test');
  assert.equal(run.player.hp, 100);
  assert.equal(run.power.shield.amount, 20);
  run.player.invuln = 0;
  hurtPlayer(run, 30, 'Test');
  assert.equal(run.power.shield.amount, 0);
  assert.equal(run.player.hp, 90);
});

test('Unverwundbar während des Dashes und kurz nach einem Treffer', () => {
  const run = quietRun();
  stepRun(run, 1 / 60, idleActions({ moveX: 1, dash: true }));
  assert.ok(run.player.dashT > 0);
  assert.equal(hurtPlayer(run, 50, 'Test'), 0);
  for (let i = 0; i < 20; i++) stepRun(run, 1 / 60, idleActions());
  assert.equal(hurtPlayer(run, 10, 'Test'), 10);
  assert.equal(hurtPlayer(run, 10, 'Test'), 0, 'direkt danach unverwundbar');
});

test('Spieler stirbt bei 0 Leben', () => {
  const run = quietRun();
  run.player.hp = 5;
  hurtPlayer(run, 10, 'Läufer');
  assert.equal(run.player.dead, true);
  assert.equal(run.player.hp, 0);
  assert.equal(run.player.lastHitBy, 'Läufer');
});

test('Kombo-Multiplikator: x1, x1,5 ab 10, x2 ab 25, x3 ab 50, x4 ab 100', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(9), 1);
  assert.equal(comboMultiplier(10), 1.5);
  assert.equal(comboMultiplier(24), 1.5);
  assert.equal(comboMultiplier(25), 2);
  assert.equal(comboMultiplier(50), 3);
  assert.equal(comboMultiplier(99), 3);
  assert.equal(comboMultiplier(100), 4);
  assert.equal(comboMultiplier(500), 4);
});

test('Punkte: Grundpunkte × Multiplikator, Kombo läuft ab und halbiert sich bei Treffer', () => {
  const sc = createScore();
  for (let i = 0; i < 9; i++) registerKill(sc, 10);
  assert.equal(sc.score, 90);
  const r = registerKill(sc, 10); // 10. Kill -> x1,5
  assert.equal(r.gained, 15);
  assert.equal(r.tierUp, true);
  assert.equal(sc.combo, 10);
  comboOnHit(sc);
  assert.equal(sc.combo, 5);
  updateCombo(sc, CONFIG.combo.window + 0.01);
  assert.equal(sc.combo, 0);
  registerKill(sc, 10);
  assert.equal(sc.combo, 1, 'nach Ablauf beginnt die Kombo neu');
});

// --- Wellen ------------------------------------------------------------------------

import { generateWave, waveBudget, unlockedTypes, bossesForWave, isBossWave } from '../src/waves.js';
import { createBot, botActions } from '../src/bot.js';

test('generateWave: Budget wird eingehalten, nur freigeschaltete Typen', () => {
  for (let n = 1; n <= 40; n++) {
    for (const seed of [1, 99, 12345]) {
      const plan = generateWave(n, seed, { noBoss: true });
      const budget = waveBudget(n);
      assert.equal(budget, Math.floor(10 + n * 7 + n * n * 0.3));
      let cost = 0;
      const allowed = new Set(unlockedTypes(n));
      for (const t of plan.enemies) {
        assert.ok(allowed.has(t), `Welle ${n}: ${t} noch nicht freigeschaltet`);
        cost += CONFIG.enemies[t].cost;
      }
      assert.ok(cost <= budget, `Welle ${n}: Kosten ${cost} > Budget ${budget}`);
      assert.equal(cost, plan.spent);
      const inGroups = plan.groups.reduce((s, g) => s + g.types.length, 0);
      assert.equal(inGroups, plan.enemies.length);
      for (const g of plan.groups) {
        if (g.anchor !== 'ring') assert.ok(g.types.length >= 1 && g.types.length <= 8);
        assert.ok(g.time >= 0 && g.time <= 41);
      }
    }
  }
});

test('generateWave: gleicher Seed ergibt gleiche Welle', () => {
  for (const n of [1, 4, 9, 13, 22]) {
    assert.deepEqual(generateWave(n, 777, { noBoss: true }), generateWave(n, 777, { noBoss: true }));
  }
  assert.notDeepEqual(generateWave(9, 1).enemies, generateWave(9, 2).enemies);
});

test('Neue Gegnertypen kommen in ihrer ersten Welle sicher vor', () => {
  for (const [type, def] of Object.entries(CONFIG.enemies)) {
    if (!def.cost || def.unlock <= 1) continue;
    for (const seed of [3, 4, 5]) {
      const plan = generateWave(def.unlock, seed, { noBoss: true });
      if (plan.special) continue;
      assert.ok(plan.enemies.includes(type), `${type} fehlt in Welle ${def.unlock}`);
    }
  }
});

test('Spezialwellen: ab Welle 8 jede 4. Welle, nie bei Bossen', () => {
  for (let n = 1; n <= 40; n++) {
    const plan = generateWave(n, 5);
    const expect = n >= 8 && (n - 8) % 4 === 0 && n % 5 !== 0;
    assert.equal(!!plan.special, expect, `Welle ${n}`);
  }
});

test('Bosse: Welle 5 Wächter, 10 Brut, 15 Wächter stärker, ab 20 beide', () => {
  assert.equal(isBossWave(5), true);
  assert.equal(isBossWave(6), false);
  assert.deepEqual(bossesForWave(5).list, [{ kind: 'guardian', appearance: 1 }]);
  assert.deepEqual(bossesForWave(10).list, [{ kind: 'brood', appearance: 1 }]);
  assert.deepEqual(bossesForWave(15).list, [{ kind: 'guardian', appearance: 2 }]);
  assert.deepEqual(bossesForWave(20).list, [{ kind: 'guardian', appearance: 3 }, { kind: 'brood', appearance: 2 }]);
  assert.equal(bossesForWave(25).dual, true);
  assert.equal(generateWave(5, 1).enemies.length, 0);
});

test('Wellen laufen durch: Bot (unverwundbar) schafft die ersten Wellen', () => {
  const run = createRun({ seed: 11, layout: 2 });
  run.god = true;
  const bot = createBot(3);
  let maxAlive = 0;
  let t = 0;
  let minSpawnDist = Infinity;
  run.listeners.push((type, x, y) => {
    if (type === 'spawnWarn') minSpawnDist = Math.min(minSpawnDist, Math.hypot(x - run.player.x, y - run.player.y));
  });
  while (run.waves.number < 5 && t < 600) {
    stepRun(run, 1 / 60, botActions(bot, run, 1 / 60));
    if (run.pendingUpgrade) run.pendingUpgrade = 0;
    maxAlive = Math.max(maxAlive, run.enemies.filter((e) => !e.dead).length);
    t += 1 / 60;
  }
  assert.ok(run.waves.number >= 5, `nur Welle ${run.waves.number} nach ${t.toFixed(0)} s`);
  assert.ok(maxAlive <= CONFIG.waves.maxAlive + 6, `zu viele Gegner gleichzeitig: ${maxAlive}`);
  assert.ok(run.stats.kills > 50);
  // Spawns liegen nie näher als 350 am Spieler
  assert.ok(minSpawnDist >= CONFIG.waves.spawnMinDist - 1, `Spawn zu nah: ${minSpawnDist.toFixed(0)}`);
});

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
