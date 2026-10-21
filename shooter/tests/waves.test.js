// Logik-Tests: Wellen (wird von logic.test.js geladen, läuft auch einzeln)

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/config.js';
import { createRun, stepRun } from '../src/run.js';

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
