// Gefahren am Boden und Explosionen: Schockwellen (Panzer), verzögerte Explosionen,
// Säure-Geschosse und Säurepfützen (Brut). Reine Logik.

import { CONFIG } from './config.js';
import { hurtPlayer, isPlayerInvulnerable } from './player.js';
import { damageEnemy } from './enemies.js';
import { rollDamage } from './scoring.js';

const near = [];
const dmgOut = { amount: 0, crit: false };

// Explosion an (x, y). team 'player' = trifft Gegner, 'enemy' = trifft den Spieler.
// Rückgabe: Anzahl getroffener Gegner.
export function explodeAt(run, x, y, radius, damage, team, source, exclude) {
  let hits = 0;
  if (team === 'player') {
    run.hash.query(x, y, radius, near);
    for (let i = 0; i < near.length; i++) {
      const e = near[i];
      if (e === exclude || e.dead || e.spawning) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > radius + e.r) continue;
      // Waffen-Explosionen profitieren von Schadens-Upgrades
      const isWeapon = CONFIG.weapons[source] || source === 'dash';
      if (isWeapon) rollDamage(damage, run.mods, run.rng, dmgOut);
      else { dmgOut.amount = damage; dmgOut.crit = false; }
      const n = d > 1e-3 ? 1 / d : 0;
      damageEnemy(run, e, dmgOut.amount, {
        crit: dmgOut.crit, weapon: source, knock: 260, kx: dx * n, ky: dy * n, ignoreShield: true,
      });
      hits++;
    }
  } else {
    const p = run.player;
    const dx = p.x - x;
    const dy = p.y - y;
    if (!p.dead && dx * dx + dy * dy <= (radius + p.r * 0.5) ** 2) {
      hurtPlayer(run, damage, source, x, y);
    }
  }
  run.emit('explosion', x, y, radius, team, source);
  return hits;
}

export function addDelayedExplosion(run, x, y, radius, damage, team, source, delay) {
  run.hazards.push({ kind: 'delayed', x, y, radius, damage, team, source, t: delay, dead: false });
}

// Ringförmige Schockwelle; per Dash kann man darüber springen
export function addShockwave(run, x, y, r0, maxR, speed, thickness, damage, source) {
  run.hazards.push({ kind: 'wave', x, y, r: r0, maxR, speed, thickness, damage, source, hit: false, dead: false, t: 0 });
}

// Säure-Geschoss fliegt in flight Sekunden zum Ziel, dort entsteht eine Pfütze
export function addAcidGlob(run, x0, y0, x1, y1, flight) {
  run.hazards.push({ kind: 'glob', x0, y0, x: x1, y: y1, t: 0, flight, dead: false });
}

export function addAcidPool(run, x, y) {
  const b = CONFIG.bosses.brood;
  run.hazards.push({ kind: 'acid', x, y, radius: b.acidRadius, t: 0, life: b.acidLife, tick: 0, dead: false });
}

export function updateHazards(run, dt, enemyDt) {
  const list = run.hazards;
  const p = run.player;
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    if (h.dead) continue;
    if (h.kind === 'delayed') {
      h.t -= dt;
      if (h.t <= 0) {
        h.dead = true;
        explodeAt(run, h.x, h.y, h.radius, h.damage, h.team, h.source);
      }
    } else if (h.kind === 'wave') {
      h.t += enemyDt;
      h.r += h.speed * enemyDt;
      if (h.r >= h.maxR) { h.dead = true; continue; }
      if (!h.hit && !p.dead) {
        const d = Math.sqrt((p.x - h.x) ** 2 + (p.y - h.y) ** 2);
        if (Math.abs(d - h.r) < h.thickness / 2 + p.r * 0.7 && !isPlayerInvulnerable(run)) {
          h.hit = true;
          hurtPlayer(run, h.damage, h.source, h.x, h.y);
        }
      }
    } else if (h.kind === 'glob') {
      h.t += enemyDt;
      if (h.t >= h.flight) {
        h.dead = true;
        addAcidPool(run, h.x, h.y);
        run.emit('acidLand', h.x, h.y);
      }
    } else if (h.kind === 'acid') {
      h.t += enemyDt;
      if (h.t >= h.life) { h.dead = true; continue; }
      h.tick -= enemyDt;
      if (h.tick <= 0 && !p.dead) {
        const d2 = (p.x - h.x) ** 2 + (p.y - h.y) ** 2;
        if (d2 < (h.radius + p.r * 0.4) ** 2 && !isPlayerInvulnerable(run)) {
          h.tick = CONFIG.bosses.brood.acidTick;
          hurtPlayer(run, CONFIG.bosses.brood.acidDamage, 'Säurepfütze');
        }
      }
    }
  }
  // tote Einträge entfernen
  let w = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i];
  list.length = w;
}
