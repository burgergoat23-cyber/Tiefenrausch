// Punkte und Kombo. Reine Funktionen, getestet in tests/logic.test.js.

import { CONFIG } from './config.js';

export function createScore() {
  return { score: 0, combo: 0, comboT: 0, tier: 0 };
}

// Stufe (Index in tiers) für eine Kombo-Zahl
export function comboTier(count, tiers = CONFIG.combo.tiers) {
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) if (count >= tiers[i].at) idx = i;
  return idx;
}

export function comboMultiplier(count, tiers = CONFIG.combo.tiers) {
  return tiers[comboTier(count, tiers)].mult;
}

// Kill werten. Rückgabe: { gained, tierUp }
export function registerKill(sc, points, cfg = CONFIG.combo) {
  sc.combo = sc.comboT > 0 ? sc.combo + 1 : 1;
  sc.comboT = cfg.window;
  const tier = comboTier(sc.combo, cfg.tiers);
  const tierUp = tier > sc.tier;
  sc.tier = tier;
  const gained = Math.round(points * cfg.tiers[tier].mult);
  sc.score += gained;
  return { gained, tierUp, tier };
}

// Spieler getroffen: Kombo halbieren (nicht ganz weg)
export function comboOnHit(sc, cfg = CONFIG.combo) {
  sc.combo = Math.floor(sc.combo * cfg.hitKeep);
  sc.tier = comboTier(sc.combo, cfg.tiers);
}

export function updateCombo(sc, dt) {
  if (sc.comboT > 0) {
    sc.comboT -= dt;
    if (sc.comboT <= 0) {
      sc.comboT = 0;
      sc.combo = 0;
      sc.tier = 0;
    }
  }
}

export function addBonus(sc, amount) {
  sc.score += Math.round(amount);
}

export function noHitBonus(wave, cfg = CONFIG.scoring) {
  return cfg.noHitBonus * wave;
}

export function bossBonus(bossNumber, cfg = CONFIG.scoring) {
  return cfg.bossBonus * bossNumber;
}

// Schaden mit Upgrades und kritischem Treffer. Rückgabe: { amount, crit }
export function rollDamage(base, mods, rng, out = { amount: 0, crit: false }) {
  let amount = base * mods.dmgMult;
  const crit = mods.crit > 0 && rng() < mods.crit;
  if (crit) amount *= 2;
  out.amount = amount;
  out.crit = crit;
  return out;
}

// Zusammenfassung einer Runde für den Game-Over-Bildschirm (rein)
export function runSummary(run, cfg = CONFIG) {
  const st = run.stats;
  let fav = 'pistol';
  let favKills = -1;
  for (const [w, k] of Object.entries(st.killsByWeapon)) {
    if (k > favKills) {
      favKills = k;
      fav = w;
    }
  }
  const upgrades = {};
  for (const id of st.upgrades) upgrades[id] = (upgrades[id] || 0) + 1;
  return {
    score: run.score.score,
    wave: run.waves.number,
    time: st.time,
    kills: st.kills,
    killsByType: { ...st.killsByType },
    accuracy: st.shots > 0 ? Math.round((st.hits / st.shots) * 100) : 0,
    maxCombo: st.maxCombo,
    upgrades,
    favoriteWeapon: cfg.weapons[fav] ? cfg.weapons[fav].name : fav,
    deathBy: run.player.lastHitBy || '',
    bosses: st.bossesKilled,
  };
}
