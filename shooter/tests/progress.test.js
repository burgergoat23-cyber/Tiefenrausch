// Logik-Tests: Highscores, Speichern, Statistik (wird von logic.test.js geladen, läuft auch einzeln)

import test from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32 } from '../src/utils.js';
import { quietRun } from './helpers.js';

// --- Highscores und Speichern ---------------------------------------------------------

import { insertHighscore, qualifies, sortHighscores, cleanName, loadSettings, save, addRunToTotals, emptyTotals } from '../src/storage.js';
import { runSummary } from '../src/scoring.js';

test('Highscore-Liste ist sortiert und auf 10 Einträge begrenzt', () => {
  let list = [];
  const rng = mulberry32(3);
  for (let i = 0; i < 40; i++) {
    const entry = { name: 'ABC', score: Math.floor(rng() * 10000), wave: 1 + Math.floor(rng() * 20), date: i };
    list = insertHighscore(list, entry).list;
    assert.ok(list.length <= 10);
    for (let k = 1; k < list.length; k++) assert.ok(list[k - 1].score >= list[k].score, 'absteigend sortiert');
  }
  assert.equal(list.length, 10);
  const low = { name: 'LOW', score: 1, wave: 1, date: 99 };
  assert.equal(insertHighscore(list, low).rank, -1, 'zu wenig Punkte: nicht in der Liste');
  assert.equal(qualifies(list, 1), false);
  const top = { name: 'TOP', score: 1e9, wave: 30, date: 100 };
  const res = insertHighscore(list, top);
  assert.equal(res.rank, 0);
  assert.equal(res.list.length, 10);
  // Gleichstand: höhere Welle zuerst, dann älter zuerst
  const tie = sortHighscores([{ score: 5, wave: 2, date: 2 }, { score: 5, wave: 3, date: 3 }, { score: 5, wave: 3, date: 1 }]);
  assert.deepEqual(tie.map((e) => e.date), [1, 3, 2]);
  assert.equal(qualifies([], 0), false, '0 Punkte zählen nicht');
});

test('Kürzel: 3 Großbuchstaben', () => {
  assert.equal(cleanName('ab'), 'ABA');
  assert.equal(cleanName('x!y?z9'), 'XYZ');
  assert.equal(cleanName(''), 'AAA');
});

test('Speichern ohne localStorage (privater Modus) wirft keinen Fehler', () => {
  assert.equal(save('test', { a: 1 }), false);
  const s = loadSettings();
  assert.equal(s.shake, 'normal');
  assert.equal(s.lastName, 'AAA');
});

test('Rundenstatistik und Gesamtstatistik', () => {
  const run = quietRun();
  run.stats.kills = 12;
  run.stats.killsByWeapon = { pistol: 3, mg: 9 };
  run.stats.shots = 40;
  run.stats.hits = 30;
  run.stats.upgrades = ['sharp', 'sharp', 'crit'];
  run.stats.time = 125;
  run.score.score = 999;
  run.waves.number = 7;
  const s = runSummary(run);
  assert.equal(s.favoriteWeapon, 'Maschinengewehr');
  assert.equal(s.accuracy, 75);
  assert.deepEqual(s.upgrades, { sharp: 2, crit: 1 });
  const t = addRunToTotals(addRunToTotals(emptyTotals(), run), run);
  assert.equal(t.games, 2);
  assert.equal(t.kills, 24);
  assert.equal(t.bestWave, 7);
  assert.equal(t.playTime, 250);
});
