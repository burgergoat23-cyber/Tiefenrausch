// Upgrade-Karten: Auswahl, Stapeln bis zur Obergrenze, Wirkung. Reine Logik.

import { CONFIG } from './config.js';
import { shuffle } from './utils.js';

const DEFS = CONFIG.upgrades;
const BY_ID = Object.fromEntries(DEFS.map((d) => [d.id, d]));

export function upgradeDef(id) {
  return BY_ID[id];
}

export function level(levels, id) {
  return levels[id] || 0;
}

// Karten, die noch nicht voll ausgebaut sind
export function availableUpgrades(levels) {
  return DEFS.filter((d) => level(levels, d.id) < d.max);
}

// count zufällige Karten (ohne Doppelte)
export function pickCards(rng, levels, count = CONFIG.upgradeChoices) {
  const list = shuffle(rng, availableUpgrades(levels).map((d) => d.id));
  return list.slice(0, count);
}

// Abgeleitete Werte aus den Stufen (rein, getestet)
export function computeMods(levels) {
  const v = (id) => level(levels, id) * BY_ID[id].value;
  const boom = BY_ID.dashBoom;
  return {
    speedMult: 1 + v('swift'),
    dmgMult: 1 + v('sharp'),
    rateMult: 1 + v('trigger'),
    pierce: v('pierce'),
    bounce: v('bounce'),
    vamp: v('vamp'),
    dashExtra: v('dash2'),
    dashBoom: level(levels, 'dashBoom') > 0,
    dashBoomRadius: boom.radius,
    dashBoomDamage: boom.damage,
    luck: v('luck'),
    ammoMult: 1 + v('ammo'),
    crit: v('crit'),
  };
}

export function maxHpFor(levels) {
  return CONFIG.player.maxHp + level(levels, 'tough') * BY_ID.tough.value;
}

// Karte nehmen. Rückgabe: false, wenn schon voll ausgebaut.
export function applyUpgrade(run, id) {
  const def = BY_ID[id];
  if (!def || level(run.upgrades, id) >= def.max) return false;
  run.upgrades[id] = level(run.upgrades, id) + 1;
  const before = run.mods.ammoMult;
  run.mods = computeMods(run.upgrades);
  const p = run.player;
  if (id === 'tough') {
    p.maxHp = maxHpFor(run.upgrades);
    p.hp = p.maxHp;
  }
  if (id === 'ammo') {
    // vorhandene Munition wächst mit
    const ars = run.arsenal;
    for (const w of Object.keys(ars.ammo)) {
      if (ars.ammo[w] > 0 && ars.ammo[w] !== Infinity) ars.ammo[w] = Math.round((ars.ammo[w] * run.mods.ammoMult) / before);
    }
  }
  if (id === 'dash2') p.dashCharges = Math.min(p.dashCharges + 1, 1 + run.mods.dashExtra);
  run.stats.upgrades.push(id);
  run.emit('upgrade', id, run.upgrades[id]);
  return true;
}
