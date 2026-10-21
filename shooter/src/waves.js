// Wellen: reine Planung (generateWave). Den Ablauf zur Laufzeit steuert wave_director.js.

import { CONFIG } from './config.js';
import { mulberry32, hashSeed, weightedKey, shuffle, randInt, clamp } from './utils.js';

// --- Planung (rein, ohne Zeichnen, Zufall nur aus dem Seed) -------------------------

export function waveBudget(n, wc = CONFIG.waves) {
  return Math.floor(wc.budgetBase + n * wc.budgetLinear + n * n * wc.budgetQuad);
}

export function waveScales(n, wc = CONFIG.waves) {
  return {
    hpScale: 1 + wc.hpPerWave * (n - 1),
    speedScale: 1 + Math.min(wc.speedMax, wc.speedPerWave * (n - 1)),
  };
}

export function isBossWave(n, wc = CONFIG.waves) {
  return wc.bossEvery > 0 && n % wc.bossEvery === 0;
}

export function isSpecialWave(n, wc = CONFIG.waves) {
  return !isBossWave(n, wc) && n >= wc.specialFirst && (n - wc.specialFirst) % wc.specialEvery === 0;
}

// Spezialwellen kommen in gemischter Reihenfolge, jede Art einmal pro Durchgang
export function specialFor(n, seed, wc = CONFIG.waves) {
  if (!isSpecialWave(n, wc)) return null;
  let k = 0;
  for (let i = wc.specialFirst; i < n; i++) if (isSpecialWave(i, wc)) k++;
  const count = wc.specials.length;
  const order = shuffle(mulberry32(hashSeed(seed, Math.floor(k / count), 0x5bec)), [...wc.specials]);
  return order[k % count];
}

// Welche Bosse in Welle n kommen und wie oft sie schon da waren
export function bossesForWave(n, wc = CONFIG.waves) {
  if (!isBossWave(n, wc)) return null;
  const b = n / wc.bossEvery;
  let g = 0;
  let br = 0;
  const list = [];
  for (let i = 1; i <= b; i++) {
    const both = i >= 4;
    if (i === 1 || i === 3 || both) g++;
    if (i === 2 || both) br++;
  }
  if (b === 1 || b === 3 || b >= 4) list.push({ kind: 'guardian', appearance: g });
  if (b === 2 || b >= 4) list.push({ kind: 'brood', appearance: br });
  return { bossNumber: b, list, dual: list.length > 1 };
}

// Kaufbare Typen, die in Welle n freigeschaltet sind
export function unlockedTypes(n, cfg = CONFIG.enemies) {
  return Object.keys(cfg).filter((t) => cfg[t].cost && cfg[t].unlock <= n);
}

function buy(rng, types, budget, cfg, out) {
  let left = budget;
  const weights = {};
  for (;;) {
    const affordable = types.filter((t) => cfg[t].cost <= left);
    if (affordable.length === 0) break;
    for (const t of affordable) weights[t] = cfg[t].weight;
    const t = weightedKey(rng, weights, affordable);
    out.push(t);
    left -= cfg[t].cost;
  }
  return budget - left;
}

function buyCount(types, count, budget, cfg, out) {
  let spent = 0;
  for (let i = 0; i < count; i++) {
    const t = types[i % types.length];
    if (spent + cfg[t].cost > budget) break;
    out.push(t);
    spent += cfg[t].cost;
  }
  return spent;
}

// Liefert die Gegnerliste der Welle n. Rein: gleicher Seed = gleiche Welle.
// opts.noBoss: Bosswelle wie eine normale Welle planen
export function generateWave(n, seed, opts = {}) {
  const wc = CONFIG.waves;
  const ec = CONFIG.enemies;
  const rng = mulberry32(hashSeed(seed, n, 0x5eed));
  const budget = waveBudget(n, wc);
  const scales = waveScales(n, wc);
  const plan = {
    number: n,
    budget,
    spent: 0,
    boss: null,
    special: null,
    enemies: [],
    groups: [],
    duration: clamp(wc.durationMin + (n - 1) * wc.durationPerWave, wc.durationMin, wc.durationMax),
    hpScale: scales.hpScale,
    speedScale: scales.speedScale,
  };
  if (!opts.noBoss && isBossWave(n, wc)) {
    plan.boss = bossesForWave(n, wc);
    return plan;
  }
  const special = specialFor(n, seed, wc);
  plan.special = special;
  const types = unlockedTypes(n, ec);
  const list = [];
  const ringList = [];
  let spent = 0;

  if (special === 'sprinters') {
    spent = buy(rng, ['sprinter'], Math.floor(budget * 0.55), ec, list);
  } else if (special === 'bomberRain') {
    const b = Math.floor(budget * 0.8);
    spent = buyCount(['bomber'], Math.floor((b * 0.7) / ec.bomber.cost), b, ec, list);
    spent += buy(rng, ['runner'], b - spent, ec, list);
  } else if (special === 'shooterRing') {
    const half = Math.floor(budget * 0.5);
    spent = buyCount(['shooter'], Math.floor(half / ec.shooter.cost), half, ec, ringList);
    spent += buy(rng, types.filter((t) => t === 'runner' || t === 'sprinter'), budget - spent, ec, list);
  } else {
    const b = special === 'darkness' ? Math.floor(budget * 0.85) : budget;
    // Neue Typen in ihrer ersten Welle bevorzugen, damit man sie kennenlernt
    const fresh = types.filter((t) => ec[t].unlock === n && n > 1);
    if (fresh.length) {
      const share = Math.floor(b * wc.newTypeShare);
      const count = Math.max(2 * fresh.length, Math.floor(share / Math.max(...fresh.map((t) => ec[t].cost))));
      spent += buyCount(fresh, count, b, ec, list);
    }
    spent += buy(rng, types, b - spent, ec, list);
  }
  plan.spent = spent;

  // In Gruppen von 3-8 aufteilen und über die Wellendauer verteilen
  shuffle(rng, list);
  const groups = [];
  for (let i = 0; i < list.length;) {
    const size = randInt(rng, wc.groupMin, wc.groupMax);
    const anchor = special === 'bomberRain' ? 'anywhere' : rng() < wc.coverChance ? 'cover' : 'edge';
    groups.push({ time: 0, anchor, pos: rng(), types: list.slice(i, i + size) });
    i += size;
  }
  for (let i = 0; i < ringList.length;) {
    const size = randInt(rng, 4, 6);
    groups.push({ time: 0, anchor: 'ring', pos: rng(), types: ringList.slice(i, i + size) });
    i += size;
  }
  shuffle(rng, groups);
  const dur = special === 'bomberRain' ? plan.duration * 0.7 : plan.duration;
  groups.forEach((g, i) => {
    const base = groups.length > 1 ? (i / (groups.length - 1)) * dur : 0;
    g.time = i === 0 ? 0 : Math.max(0, base + (rng() - 0.5) * 2);
  });
  groups.sort((a, b) => a.time - b.time);
  plan.groups = groups;
  plan.enemies = [...list, ...ringList];
  return plan;
}
