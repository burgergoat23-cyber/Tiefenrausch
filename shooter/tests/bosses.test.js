// Logik-Tests: Bosse, Upgrades und Simulation (wird von logic.test.js geladen, läuft auch einzeln)

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/config.js';
import { createRun, stepRun } from '../src/run.js';
import { mulberry32 } from '../src/utils.js';
import { addEnemy } from '../src/enemies.js';
import { createBot, botActions } from '../src/bot.js';
import { near, idleActions, quietRun } from './helpers.js';

// --- Bosse und Upgrades ----------------------------------------------------------------

import { createBoss, bossHp, bossBars, onBossDamaged } from '../src/boss.js';
import { damageEnemy } from '../src/enemies.js';
import { computeMods, pickCards, applyUpgrade, availableUpgrades, maxHpFor } from '../src/upgrades.js';
import { startWave } from '../src/wave_director.js';

test('Boss-Leben: +40 % pro Auftauchen, weniger wenn beide kommen', () => {
  assert.equal(bossHp('guardian', 1, false), 1500);
  assert.ok(near(bossHp('guardian', 2, false), 2100));
  assert.ok(near(bossHp('brood', 1, false), 2500));
  assert.ok(near(bossHp('brood', 2, true), 2500 * 1.4 * CONFIG.bosses.dualHpFactor));
});

function bossRun(kind) {
  const run = quietRun(9, 0);
  run.god = true;
  const e = addEnemy(run, createBoss(run, kind, 1000, 1200, 400, { intro: 0, bossNumber: 2 }));
  return { run, e };
}

test('Wächter: Phasenwechsel bei 66 % und 33 % mit Brüllen, nicht übersprungen', () => {
  const { run, e } = bossRun('guardian');
  const roars = [];
  run.listeners.push((t, a, b, c) => { if (t === 'bossRoar') roars.push(c); });
  damageEnemy(run, e, 500, {}); // 100 % -> 50 %: darf nicht direkt in Phase 3 springen
  assert.equal(e.boss.phase, 2);
  assert.ok(e.hp >= 659, 'Leben bleibt an der Phasengrenze');
  assert.equal(damageEnemy(run, e, 100, {}), 0, 'während des Brüllens unverwundbar');
  for (let i = 0; i < 60; i++) stepRun(run, 1 / 60, idleActions());
  damageEnemy(run, e, 400, {});
  assert.equal(e.boss.phase, 3);
  assert.deepEqual(roars, [2, 3]);
  assert.ok(e.boss.speedMult > 1.4);
});

test('Wächter: Salve mit Lücke, Ansturm mit Warnlinie, Spirale und Helfer in Phase 3', () => {
  const { run, e } = bossRun('guardian');
  let maxBullets = 0;
  for (let i = 0; i < 4 * 60; i++) {
    stepRun(run, 1 / 60, idleActions());
    maxBullets = Math.max(maxBullets, run.projectiles.enemy.count);
  }
  const g = CONFIG.bosses.guardian;
  assert.ok(maxBullets >= g.salvoCount - g.salvoGap, `Salve: ${maxBullets} Kugeln`);
  // Phase 2: Ansturm mit vorberechnetem Weg
  e.hp = e.maxHp * 0.6;
  e.boss.phase = 2;
  e.boss.chargeT = 0.01;
  let warned = false;
  let charged = false;
  for (let i = 0; i < 4 * 60; i++) {
    stepRun(run, 1 / 60, idleActions());
    if (e.boss.charge === 'warn' && e.boss.path.length >= 4) warned = true;
    if (e.boss.charge === 'run') charged = true;
  }
  assert.ok(warned && charged, 'Warnlinie und Ansturm');
  // Phase 3: Helfer rufen
  e.boss.phase = 3;
  e.boss.summonT = 0.01;
  run.noWaves = false;
  run.waves.state = 'fight';
  run.waves.plan = { groups: [] };
  for (let i = 0; i < 2.5 * 60; i++) stepRun(run, 1 / 60, idleActions());
  const helpers = run.enemies.filter((o) => !o.dead && o.type === 'runner').length;
  assert.ok(helpers >= 1, `Helfer: ${helpers}`);
});

test('Brut: teilt sich bei 33 % in zwei Bosse mit je 30 % Leben, Sieg erst wenn beide tot', () => {
  const { run, e } = bossRun('brood');
  e.boss.phase = 2;
  damageEnemy(run, e, e.hp - e.maxHp * 0.33 + 5, {});
  const kids = run.enemies.filter((o) => o.boss && !o.dead);
  assert.equal(kids.length, 2);
  assert.ok(e.dead);
  for (const k of kids) assert.ok(near(k.maxHp, e.maxHp * 0.3, 1e-6));
  const bars = bossBars(run);
  assert.equal(bars.length, 1, 'eine gemeinsame Leiste');
  assert.ok(near(bars[0].frac, CONFIG.bosses.phases[1], 1e-6));
  for (let i = 0; i < 70; i++) stepRun(run, 1 / 60, idleActions());
  damageEnemy(run, kids[0], 1e6, {});
  assert.equal(run.stats.bossesKilled, 0);
  damageEnemy(run, kids[1], 1e6, {});
  assert.equal(run.stats.bossesKilled, 1);
  assert.equal(run.score.score >= 10000, true, 'Bonus 5000 × Boss-Nummer 2');
  assert.equal(run.pickups.length, CONFIG.bosses.drops);
});

test('Brut legt Eier, aus denen Sprinter schlüpfen; Säure in Phase 2', () => {
  const { run, e } = bossRun('brood');
  for (let i = 0; i < 6 * 60; i++) stepRun(run, 1 / 60, idleActions());
  const sprinters = run.enemies.filter((o) => !o.dead && o.type === 'sprinter').length;
  assert.ok(sprinters >= 2, `Sprinter: ${sprinters}`);
  e.boss.phase = 2;
  e.boss.acidT = 0.01;
  let globs = 0;
  let pools = 0;
  for (let i = 0; i < 2 * 60; i++) {
    stepRun(run, 1 / 60, idleActions());
    globs = Math.max(globs, run.hazards.filter((h) => h.kind === 'glob').length);
    pools = Math.max(pools, run.hazards.filter((h) => h.kind === 'acid').length);
  }
  assert.equal(globs, CONFIG.bosses.brood.acidCount);
  assert.ok(pools >= 1);
});

test('Upgrades: Wirkung, Stapeln bis zur Obergrenze, volle Karten kommen nicht mehr', () => {
  const m = computeMods({ sharp: 2, trigger: 1, swift: 3, crit: 3, luck: 1, ammo: 2, pierce: 2, dash2: 1 });
  assert.ok(near(m.dmgMult, 1.3));
  assert.ok(near(m.rateMult, 1.1));
  assert.ok(near(m.speedMult, 1.3));
  assert.ok(near(m.crit, 0.3));
  assert.ok(near(m.luck, 0.3));
  assert.ok(near(m.ammoMult, 2));
  assert.equal(m.pierce, 2);
  assert.equal(m.dashExtra, 1);
  assert.equal(maxHpFor({ tough: 2 }), 140);
  const run = quietRun();
  run.player.hp = 30;
  assert.equal(applyUpgrade(run, 'tough'), true);
  assert.equal(run.player.maxHp, 120);
  assert.equal(run.player.hp, 120, 'volle Heilung');
  assert.equal(applyUpgrade(run, 'dash2'), true);
  assert.equal(applyUpgrade(run, 'dash2'), false, 'Doppel-Dash nur 1 Stufe');
  assert.ok(!availableUpgrades(run.upgrades).some((d) => d.id === 'dash2'));
  for (let i = 0; i < 10; i++) applyUpgrade(run, 'sharp');
  assert.equal(run.upgrades.sharp, 5);
  assert.ok(near(run.mods.dmgMult, 1.75));
  const rng = mulberry32(1);
  for (let i = 0; i < 50; i++) {
    const cards = pickCards(rng, run.upgrades);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards).size, 3, 'keine doppelten Karten');
    assert.ok(!cards.includes('sharp') && !cards.includes('dash2'));
  }
  const all = Object.fromEntries(CONFIG.upgrades.map((d) => [d.id, d.max]));
  assert.equal(pickCards(rng, all).length, 0);
});

test('Simulation: Bot spielt 10 Wellen inkl. zwei Bossen ohne Fehler und ohne Endlosschleife', () => {
  const run = createRun({ seed: 2024, layout: 1 });
  run.god = true;
  const bot = createBot(7);
  let t = 0;
  const limit = 25 * 60; // 25 Minuten Spielzeit
  let cards = 0;
  let maxEnemies = 0;
  while (run.waves.number <= 10 && t < limit) {
    stepRun(run, 1 / 60, botActions(bot, run, 1 / 60));
    if (run.pendingUpgrade) {
      const c = pickCards(run.rng, run.upgrades);
      if (c.length) applyUpgrade(run, c[0]);
      run.pendingUpgrade = 0;
      cards++;
    }
    maxEnemies = Math.max(maxEnemies, run.enemies.length);
    t += 1 / 60;
    for (const e of run.enemies) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) throw new Error('NaN bei ' + e.type);
    }
    if (!Number.isFinite(run.player.x)) throw new Error('Spieler NaN');
  }
  assert.ok(run.waves.number > 10, `nur bis Welle ${run.waves.number} in ${(t / 60).toFixed(1)} min`);
  assert.equal(run.stats.bossesKilled, 2);
  assert.equal(cards, 4, 'Karten nach Welle 3, 5, 8, 10');
  assert.ok(maxEnemies < 120, `zu viele Objekte: ${maxEnemies}`);
  console.log(`  10 Wellen in ${(t / 60).toFixed(1)} min Spielzeit, ${run.stats.kills} Kills, Punkte ${run.score.score}`);
});

test('Bosswelle startet die richtigen Bosse', () => {
  const run = quietRun();
  run.noWaves = false;
  startWave(run, 20);
  for (let i = 0; i < 3 * 60; i++) stepRun(run, 1 / 60, idleActions());
  const kinds = run.enemies.filter((e) => e.boss).map((e) => e.boss.kind).sort();
  assert.deepEqual(kinds, ['brood', 'guardian']);
  void onBossDamaged;
});
