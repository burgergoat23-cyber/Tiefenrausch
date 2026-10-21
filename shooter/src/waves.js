// Wellen: reine Planung (generateWave) und Ablauf zur Laufzeit (Spawns, Warnkreise, Pausen).

import { CONFIG, isUpgradeWave } from './config.js';
import { mulberry32, hashSeed, weightedKey, shuffle, randInt, clamp, dist2, TAU } from './utils.js';
import { edgePoint, anyPoint, coverPoint, clampToFree, circleBlocked } from './world.js';
import { createEnemy, addEnemy, aliveCount } from './enemies.js';
import { spawnBosses } from './boss.js';
import { healPlayer } from './player.js';
import { addBonus, noHitBonus } from './scoring.js';
import { magnetizeAll } from './pickups.js';

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

// --- Ablauf zur Laufzeit -------------------------------------------------------------

export function createWaveState() {
  return {
    number: 0,
    state: 'intro',        // intro, fight, break
    t: 0,
    elapsed: 0,
    plan: null,
    groupIdx: 0,
    queue: [],
    warnings: [],
    remaining: 0,
    hitThisWave: false,
    hpScale: 1,
    speedScale: 1,
    special: null,
    darkness: false,
    boss: null,
    bossesSpawned: false,
    upgradeAsked: false,
    lastBonus: 0,
    noBoss: false,
  };
}

export function startWave(run, n) {
  const w = run.waves;
  const plan = generateWave(n, run.seed, { noBoss: w.noBoss });
  w.number = n;
  w.plan = plan;
  w.state = 'intro';
  w.t = CONFIG.waves.introTime;
  w.elapsed = 0;
  w.groupIdx = 0;
  w.queue.length = 0;
  w.warnings.length = 0;
  w.hitThisWave = false;
  w.hpScale = plan.hpScale;
  w.speedScale = plan.speedScale;
  w.special = plan.special;
  w.darkness = plan.special === 'darkness';
  w.boss = plan.boss;
  w.bossesSpawned = false;
  w.upgradeAsked = false;
  run.emit('waveStart', n, plan.special, plan.boss ? plan.boss.list.map((b) => b.kind).join('+') : '');
}

const tmpPt = { x: 0, y: 0 };

function farEnough(run, x, y) {
  return dist2(x, y, run.player.x, run.player.y) >= CONFIG.waves.spawnMinDist ** 2;
}

// Ankerpunkt einer Gruppe bestimmen (nie näher als 350 am Spieler)
function anchorPoint(run, group) {
  const world = run.world;
  const p = run.player;
  if (group.anchor === 'cover') {
    const c = coverPoint(world, run.rng, p.x, p.y, CONFIG.waves.spawnMinDist);
    if (c) return c;
  }
  if (group.anchor === 'anywhere') {
    for (let i = 0; i < 12; i++) {
      const a = anyPoint(world, run.rng, 90);
      if (farEnough(run, a.x, a.y) && !circleBlocked(world, a.x, a.y, 30)) return a;
    }
  }
  // Rand: Position entlang des Umfangs, bei Bedarf weiterschieben
  let best = null;
  let bestD = -1;
  for (let k = 0; k < 4; k++) {
    const r = (group.pos + k * 0.25) % 1;
    const pt = edgePoint(world, () => r, 70);
    const d = dist2(pt.x, pt.y, p.x, p.y);
    if (d >= CONFIG.waves.spawnMinDist ** 2) return pt;
    if (d > bestD) { bestD = d; best = pt; }
  }
  return best;
}

function queueGroup(run, group) {
  const w = run.waves;
  const wc = CONFIG.waves;
  if (group.anchor === 'ring') {
    const p = run.player;
    const n = group.types.length;
    const off = group.pos * TAU;
    group.types.forEach((type, i) => {
      const a = off + (i / n) * TAU;
      tmpPt.x = p.x + Math.cos(a) * wc.ringRadius;
      tmpPt.y = p.y + Math.sin(a) * wc.ringRadius;
      clampToFree(run.world, tmpPt, CONFIG.enemies[type].radius);
      keepAway(run, tmpPt, CONFIG.enemies[type].radius);
      w.queue.push({ type, x: tmpPt.x, y: tmpPt.y });
    });
    return;
  }
  const anchor = anchorPoint(run, group);
  for (const type of group.types) {
    const r = CONFIG.enemies[type].radius;
    let x = anchor.x;
    let y = anchor.y;
    for (let i = 0; i < 6; i++) {
      const a = run.rng() * TAU;
      const d = run.rng() * wc.groupSpread;
      x = anchor.x + Math.cos(a) * d;
      y = anchor.y + Math.sin(a) * d;
      if (!circleBlocked(run.world, x, y, r)) break;
    }
    tmpPt.x = x;
    tmpPt.y = y;
    clampToFree(run.world, tmpPt, r);
    keepAway(run, tmpPt, r);
    w.queue.push({ type, x: tmpPt.x, y: tmpPt.y });
  }
}

// Nie näher als spawnMinDist am Spieler: notfalls nach außen schieben
function keepAway(run, pt, r) {
  const p = run.player;
  const min = CONFIG.waves.spawnMinDist;
  for (let i = 0; i < 3; i++) {
    const dx = pt.x - p.x;
    const dy = pt.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= min) return;
    const k = d > 1 ? (min + 5) / d : 0;
    pt.x = k ? p.x + dx * k : p.x + min + 5;
    pt.y = k ? p.y + dy * k : p.y;
    clampToFree(run.world, pt, r);
    if (d < 1 || i === 2) {
      // an der Wand gelandet und immer noch zu nah: auf die gegenüberliegende Seite
      if (Math.hypot(pt.x - p.x, pt.y - p.y) < min) {
        pt.x = run.world.width - pt.x;
        pt.y = run.world.height - pt.y;
        clampToFree(run.world, pt, r);
      }
    }
  }
}

export function updateWaves(run, dt) {
  const w = run.waves;
  const wc = CONFIG.waves;
  if (run.player.dead) return;

  if (w.state === 'intro') {
    w.t -= dt;
    if (w.t <= 0) {
      w.state = 'fight';
      w.elapsed = 0;
      if (w.boss && !w.bossesSpawned) {
        w.bossesSpawned = true;
        spawnBosses(run, w.boss);
      }
    }
  } else if (w.state === 'fight') {
    w.elapsed += dt;
    const groups = w.plan.groups;
    const alive = aliveCount(run);
    // Arena leer: nächste Gruppe vorziehen
    if (alive === 0 && w.warnings.length === 0 && w.queue.length === 0 && w.groupIdx < groups.length) {
      w.elapsed = Math.max(w.elapsed, groups[w.groupIdx].time - wc.fastForward);
    }
    while (w.groupIdx < groups.length && groups[w.groupIdx].time <= w.elapsed) {
      queueGroup(run, groups[w.groupIdx]);
      w.groupIdx++;
    }
    // Warteschlange -> Warnkreise (höchstens 45 Gegner gleichzeitig)
    while (w.queue.length && alive + w.warnings.length < wc.maxAlive) {
      const q = w.queue.shift();
      keepAway(run, q, CONFIG.enemies[q.type].radius); // Spieler kann inzwischen näher sein
      w.warnings.push({ type: q.type, x: q.x, y: q.y, t: wc.spawnWarn, max: wc.spawnWarn });
      run.emit('spawnWarn', q.x, q.y, q.type);
    }
    updateWarnings(run, dt);
    let undispatched = 0;
    for (let i = w.groupIdx; i < groups.length; i++) undispatched += groups[i].types.length;
    w.remaining = aliveCount(run) + w.queue.length + w.warnings.length + undispatched;
    // Die letzten Gegner markieren, damit man nicht suchen muss
    const mark = w.remaining <= wc.markLast;
    for (const e of run.enemies) e.marked = mark && !e.dead;
    if (w.remaining === 0 && w.groupIdx >= groups.length) waveCleared(run);
  } else if (w.state === 'break') {
    w.t -= dt;
    if (!w.upgradeAsked && isUpgradeWave(w.number) && w.t <= wc.breakTime - wc.upgradeDelay) {
      w.upgradeAsked = true;
      run.requestUpgrade();
    }
    if (w.t <= 0) startWave(run, w.number + 1);
  }
}

// Einzelnen Gegner mit Warnkreis erscheinen lassen (z. B. vom Boss gerufen)
export function queueSpawn(run, type, x, y) {
  const pt = { x, y };
  clampToFree(run.world, pt, CONFIG.enemies[type].radius);
  keepAway(run, pt, CONFIG.enemies[type].radius);
  const wc = CONFIG.waves;
  run.waves.warnings.push({ type, x: pt.x, y: pt.y, t: wc.spawnWarn, max: wc.spawnWarn });
  run.emit('spawnWarn', pt.x, pt.y, type);
}

function updateWarnings(run, dt) {
  const w = run.waves;
  const p = run.player;
  const hold2 = CONFIG.waves.spawnHoldDist ** 2;
  for (let i = w.warnings.length - 1; i >= 0; i--) {
    const s = w.warnings[i];
    s.t -= dt;
    if (s.t > 0) continue;
    // Spieler steht drauf: warten, damit niemand aus dem Nichts getroffen wird
    if (dist2(s.x, s.y, p.x, p.y) < hold2) {
      s.t = 0;
      continue;
    }
    w.warnings.splice(i, 1);
    const e = addEnemy(run, createEnemy(run, s.type, s.x, s.y));
    run.emit('spawn', e.x, e.y, e.type);
  }
}

function waveCleared(run) {
  const w = run.waves;
  w.state = 'break';
  w.t = CONFIG.waves.breakTime;
  w.darkness = false;
  w.lastBonus = 0;
  if (!w.hitThisWave && !run.player.dead) {
    w.lastBonus = noHitBonus(w.number);
    addBonus(run.score, w.lastBonus);
  }
  healPlayer(run, CONFIG.waves.breakHeal);
  magnetizeAll(run);
  run.emit('waveClear', w.number, w.lastBonus);
}
