// Drops: Würfeln, Erzeugen, Anziehen, Einsammeln und Wirkung. Reine Logik.

import { CONFIG } from './config.js';
import { weightedKey, TAU } from './utils.js';
import { healPlayer } from './player.js';
import { giveWeapon } from './weapons.js';

// Rein: Würfelt einen Drop. Rückgabe: null oder { kind, id }
export function rollDrop(rng, chance, dc = CONFIG.drops) {
  if (rng() >= chance) return null;
  return pickDrop(rng, dc);
}

export function pickDrop(rng, dc = CONFIG.drops) {
  const kind = weightedKey(rng, dc.split);
  if (kind === 'heal') return { kind, id: 'heal' };
  if (kind === 'weapon') return { kind, id: weightedKey(rng, dc.weaponWeights) };
  return { kind, id: weightedKey(rng, dc.powerWeights) };
}

export function dropChance(run, e) {
  const base = e.def.dropChance ?? CONFIG.drops.chance;
  return base * (1 + run.mods.luck);
}

export function spawnPickup(run, kind, id, x, y) {
  const a = run.rng() * TAU;
  const sp = 60 + run.rng() * 80;
  const pk = {
    kind, id, x, y, px: x, py: y,
    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
    age: 0,
    life: kind === 'weapon' ? CONFIG.drops.weaponLife : CONFIG.drops.life,
    magnet: false,
    dead: false,
    seed: run.rng() * TAU,
  };
  run.pickups.push(pk);
  run.emit('dropSpawn', x, y, kind, id);
  return pk;
}

// Nach einem Kill: vielleicht etwas fallen lassen
export function maybeDrop(run, e) {
  if (e.boss || e.noDrop) return;
  const d = rollDrop(run.rng, dropChance(run, e));
  if (d) spawnPickup(run, d.kind, d.id, e.x, e.y);
}

// Alle Drops der Arena zum Spieler ziehen (Magnet, Wellenende)
export function magnetizeAll(run) {
  for (const pk of run.pickups) pk.magnet = true;
}

export function pickupColor(pk) {
  if (pk.kind === 'weapon') return '#ffffff';
  return CONFIG.powerups[pk.id].color;
}

export function pickupName(pk) {
  if (pk.kind === 'weapon') return CONFIG.weapons[pk.id].name;
  return CONFIG.powerups[pk.id].name;
}

export function applyPickup(run, pk) {
  const pw = CONFIG.powerups;
  const cap = pw.extendCap;
  switch (pk.id) {
    case 'heal':
      healPlayer(run, pw.heal.amount);
      break;
    case 'shield':
      run.power.shield.amount = pw.shield.amount;
      run.power.shield.t = Math.min(run.power.shield.t + pw.shield.duration, pw.shield.duration * cap);
      break;
    case 'rapid':
    case 'multi':
    case 'slow':
      run.power[pk.id] = Math.min(run.power[pk.id] + pw[pk.id].duration, pw[pk.id].duration * cap);
      break;
    case 'magnet':
      magnetizeAll(run);
      break;
    default:
      if (pk.kind === 'weapon') giveWeapon(run, pk.id);
      break;
  }
  run.stats.pickups = (run.stats.pickups || 0) + 1;
  run.emit('pickup', pk.x, pk.y, pk.id, pickupColor(pk));
  run.emit('pickupText', pk.x, pk.y, pickupName(pk), pickupColor(pk));
}

export function updatePickups(run, dt) {
  const list = run.pickups;
  const p = run.player;
  const dc = CONFIG.drops;
  const collectR = p.r + dc.pickupRadius;
  for (let i = 0; i < list.length; i++) {
    const pk = list[i];
    pk.px = pk.x;
    pk.py = pk.y;
    pk.age += dt;
    if (pk.age >= pk.life && !pk.magnet) {
      pk.dead = true;
      run.emit('dropExpire', pk.x, pk.y);
      continue;
    }
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (!p.dead && (pk.magnet || d < dc.attractRange)) {
      // zum Spieler ziehen, wird schneller
      const sp = (pk.magnet ? dc.magnetSpeed : dc.attractSpeed) * Math.min(1, 0.4 + pk.age);
      pk.vx = (dx / d) * sp;
      pk.vy = (dy / d) * sp;
    } else {
      const f = Math.exp(-4 * dt);
      pk.vx *= f;
      pk.vy *= f;
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    pk.x = Math.max(20, Math.min(run.world.width - 20, pk.x));
    pk.y = Math.max(20, Math.min(run.world.height - 20, pk.y));
    if (!p.dead && d < collectR) {
      pk.dead = true;
      applyPickup(run, pk);
    }
  }
  let w = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i];
  list.length = w;
}
