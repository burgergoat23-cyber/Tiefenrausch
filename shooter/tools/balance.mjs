// Balancing per Simulation: ein ehrlicher Bot (verwundbar) spielt viele Runden ohne Zeichnen.
//   node tools/balance.mjs [Anzahl Runden] [max. Minuten]
// Ausgabe: erreichte Welle (Verteilung), Todesursachen, Spielzeit, Punkte.

import { createRun, stepRun } from '../src/run.js';
import { createBot, botActions } from '../src/bot.js';
import { pickCards, applyUpgrade } from '../src/upgrades.js';

const N = Number(process.argv[2] || 30);
const MAX_MIN = Number(process.argv[3] || 30);
const dt = 1 / 60;
const results = [];
const causes = {};
const waveTimes = {};
const hpAtWaveStart = {};

for (let i = 0; i < N; i++) {
  const run = createRun({ seed: 1000 + i });
  const bot = createBot(77 + i);
  let t = 0;
  let lastWave = run.waves.number;
  let waveStart = 0;
  while (!run.player.dead && t < MAX_MIN * 60) {
    stepRun(run, dt, botActions(bot, run, dt));
    if (run.pendingUpgrade) {
      const c = pickCards(run.rng, run.upgrades);
      if (c.length) applyUpgrade(run, c[Math.floor(run.rng() * c.length)]);
      run.pendingUpgrade = 0;
    }
    if (run.waves.number !== lastWave) {
      (waveTimes[lastWave] ||= []).push(t - waveStart);
      (hpAtWaveStart[run.waves.number] ||= []).push(run.player.hp / run.player.maxHp);
      lastWave = run.waves.number;
      waveStart = t;
    }
    t += dt;
  }
  const cause = run.player.dead ? run.player.lastHitBy || '?' : 'überlebt';
  causes[cause] = (causes[cause] || 0) + 1;
  results.push({ wave: run.waves.number, time: t, score: run.score.score, kills: run.stats.kills, dead: run.player.dead });
}

const waves = results.map((r) => r.wave).sort((a, b) => a - b);
const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
console.log(`Runden: ${N}, erreichte Welle: Median ${waves[Math.floor(N / 2)]}, Schnitt ${avg(waves).toFixed(1)}, min ${waves[0]}, max ${waves[N - 1]}`);
console.log(`Spielzeit Schnitt: ${(avg(results.map((r) => r.time)) / 60).toFixed(1)} min, Punkte Schnitt: ${Math.round(avg(results.map((r) => r.score)))}`);
const hist = {};
for (const w of waves) hist[w] = (hist[w] || 0) + 1;
console.log('Tod in Welle:', Object.entries(hist).map(([w, n]) => `${w}:${n}`).join('  '));
console.log('Todesursachen:', Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', '));
console.log('Wellendauer (s):', Object.entries(waveTimes).slice(0, 20).map(([w, a]) => `${w}:${avg(a).toFixed(0)}`).join(' '));
console.log('Leben zu Wellenbeginn (%):', Object.entries(hpAtWaveStart).slice(0, 20).map(([w, a]) => `${w}:${Math.round(avg(a) * 100)}`).join(' '));
