// Ablauf der Wellen zur Laufzeit: Einleitung, Spawns mit Warnkreisen, Warteschlange, Pause, Upgrade-Wunsch.

import { CONFIG, isUpgradeWave } from './config.js';
import { dist2, TAU } from './utils.js';
import { edgePoint, anyPoint, coverPoint, clampToFree, circleBlocked } from './world.js';
import { createEnemy, addEnemy, aliveCount } from './enemies.js';
import { spawnBosses } from './boss.js';
import { healPlayer } from './player.js';
import { addBonus, noHitBonus } from './scoring.js';
import { magnetizeAll } from './pickups.js';
import { generateWave } from './waves.js';

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
