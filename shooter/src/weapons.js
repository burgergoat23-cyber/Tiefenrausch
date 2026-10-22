// Waffen: Feuern, Munition, Wechsel, Zielhilfe. Reine Logik.

import { CONFIG } from './config.js';
import { spawnPlayerProjectile, fireRail } from './projectiles.js';
import { raycast } from './world.js';
import { angleDiff, DEG, randSigned } from './utils.js';

const ORDER = CONFIG.weapons.order;

export function createArsenal() {
  const ammo = {};
  for (const id of ORDER) ammo[id] = 0;
  ammo.pistol = Infinity;
  return {
    current: 'pistol',
    ammo,
    cooldown: 0,
    mgSpread: CONFIG.weapons.mg.spread,
    railCharge: 0,
    switchT: 0,          // für die HUD-Animation beim Wechsel
  };
}

export function startAmmo(run, id) {
  const w = CONFIG.weapons[id];
  return w.ammo === Infinity ? Infinity : Math.round(w.ammo * run.mods.ammoMult);
}

export function maxAmmo(run, id) {
  const w = CONFIG.weapons[id];
  return w.ammo === Infinity ? Infinity : Math.round(w.ammo * run.mods.ammoMult * CONFIG.weapons.ammoCapFactor);
}

export function hasAmmo(ars, id) {
  return ars.ammo[id] > 0;
}

// Waffe aufheben: neu = Startmunition und direkt ausrüsten, schon vorhanden = Munition dazu
export function giveWeapon(run, id) {
  const ars = run.arsenal;
  const isNew = !hasAmmo(ars, id);
  if (isNew) ars.ammo[id] = startAmmo(run, id);
  else ars.ammo[id] = Math.min(maxAmmo(run, id), ars.ammo[id] + startAmmo(run, id));
  if (isNew) selectWeapon(run, id);
  run.emit('weaponPickup', id, isNew);
  return isNew;
}

export function selectWeapon(run, id) {
  const ars = run.arsenal;
  if (!hasAmmo(ars, id) || ars.current === id) return false;
  ars.current = id;
  if (ars.railCharge > 0) run.emit('railCancel'); // Ladeton weich ausblenden
  ars.railCharge = 0;
  ars.switchT = 0.25;
  ars.cooldown = Math.max(ars.cooldown, 0.12);
  run.emit('weaponSwitch', id);
  return true;
}

// Nächste/vorige Waffe mit Munition
export function cycleWeapon(run, dir) {
  const ars = run.arsenal;
  let idx = ORDER.indexOf(ars.current);
  for (let i = 0; i < ORDER.length; i++) {
    idx = (idx + dir + ORDER.length) % ORDER.length;
    if (hasAmmo(ars, ORDER[idx])) return selectWeapon(run, ORDER[idx]);
  }
  return false;
}

// Leer: zur nächsten Waffe mit Munition, zuletzt Pistole
export function autoSwitch(run) {
  const ars = run.arsenal;
  let idx = ORDER.indexOf(ars.current);
  for (let i = 1; i < ORDER.length; i++) {
    const id = ORDER[(idx + i) % ORDER.length];
    if (id !== 'pistol' && hasAmmo(ars, id)) return selectWeapon(run, id);
  }
  return selectWeapon(run, 'pistol');
}

export function fireRate(run, id) {
  const rapid = run.power.rapid > 0 ? 1 + CONFIG.powerups.rapid.rateBonus : 1;
  return CONFIG.weapons[id].rate * run.mods.rateMult * rapid;
}

// Zielhilfe (Touch/Gamepad): bis zu 6° auf den nächsten Gegner in Zielrichtung
export function assistAim(run, angle) {
  const wc = CONFIG.weapons;
  const p = run.player;
  let best = null;
  let bestScore = Infinity;
  const cone = wc.assistCone * DEG;
  for (const e of run.enemies) {
    if (e.dead || e.spawning) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > wc.assistRange) continue;
    const diff = angleDiff(angle, Math.atan2(dy, dx));
    if (Math.abs(diff) > cone) continue;
    const score = Math.abs(diff) * 600 + d; // Winkel zählt mehr als Entfernung
    if (score < bestScore) {
      bestScore = score;
      best = diff;
    }
  }
  if (best === null) return angle;
  const max = wc.assistAngle * DEG;
  return angle + Math.max(-max, Math.min(max, best));
}

export function updateWeapons(run, dt, act) {
  const ars = run.arsenal;
  const p = run.player;
  if (ars.switchT > 0) ars.switchT -= dt;
  if (p.dead) return;

  if (act.weaponSlot >= 1 && act.weaponSlot <= ORDER.length) selectWeapon(run, ORDER[act.weaponSlot - 1]);
  else if (act.weaponDir) cycleWeapon(run, act.weaponDir);

  const id = ars.current;
  const w = CONFIG.weapons[id];
  ars.cooldown -= dt;
  if (!act.fire && ars.cooldown < 0) ars.cooldown = 0;

  // Maschinengewehr: Streuung erholt sich, wenn nicht gefeuert wird
  if (!(act.fire && id === 'mg')) {
    ars.mgSpread = Math.max(CONFIG.weapons.mg.spread, ars.mgSpread - CONFIG.weapons.mg.spreadRecover * dt);
  }

  if (id === 'rail') {
    // Railgun: gedrückt halten lädt auf, Loslassen bricht ab
    if (act.fire && ars.cooldown <= 0 && hasAmmo(ars, id)) {
      if (ars.railCharge === 0) run.emit('railCharge', p.x, p.y);
      ars.railCharge += dt;
      if (ars.railCharge >= w.charge) {
        ars.railCharge = 0;
        // Abklingzeit vor dem Schuss setzen: ein Waffenwechsel im Schuss (Munition leer) darf sie nicht verlängern
        ars.cooldown += 1 / fireRate(run, id);
        if (ars.cooldown < 0) ars.cooldown = 0;
        shoot(run, id, act);
      }
    } else {
      if (ars.railCharge > 0) run.emit('railCancel');
      ars.railCharge = 0;
    }
    return;
  }

  if (act.fire && ars.cooldown <= 0 && hasAmmo(ars, id)) {
    ars.cooldown += 1 / fireRate(run, id);
    if (ars.cooldown < 0) ars.cooldown = 0;
    shoot(run, id, act);
  }
}

function shoot(run, id, act) {
  const ars = run.arsenal;
  const p = run.player;
  const w = CONFIG.weapons[id];
  let aim = p.aim;
  if (act.assist) aim = assistAim(run, aim);
  // Mündung nicht hinter einer Wand, an der der Spieler steht
  const muzzle = raycast(run.world, p.x, p.y, Math.cos(aim), Math.sin(aim), CONFIG.weapons.muzzle, null);
  const mx = p.x + Math.cos(aim) * muzzle;
  const my = p.y + Math.sin(aim) * muzzle;
  const multi = run.power.multi > 0;
  const sideAngle = CONFIG.weapons.multiShotAngle * DEG;
  const dirs = multi ? 3 : 1;
  // alle Strahlen eines Schusses treffen nur Gegner, die es vorher schon gab (keine frischen Mini-Teiler)
  const railCount = run.enemies.length;

  for (let k = 0; k < dirs; k++) {
    const base = aim + (multi ? (k - 1) * sideAngle : 0);
    if (id === 'rail') {
      fireRail(run, mx, my, base, railCount);
      continue;
    }
    const spreadDeg = id === 'mg' ? ars.mgSpread : w.spread;
    const spread = spreadDeg * DEG;
    for (let i = 0; i < w.pellets; i++) {
      let a;
      if (w.pellets > 1) {
        // Fächer gleichmäßig verteilt, mit etwas Zufall
        a = base - spread / 2 + (spread * i) / (w.pellets - 1) + randSigned(run.rng, spread / (w.pellets * 3));
      } else {
        a = base + randSigned(run.rng, spread / 2);
      }
      const speed = w.speed * (1 + randSigned(run.rng, w.speedJitter || 0));
      spawnPlayerProjectile(run, id, mx, my, a, speed);
      run.stats.shots++;
    }
  }

  if (id === 'mg') ars.mgSpread = Math.min(w.spreadMax, ars.mgSpread + w.spreadGrow);
  // Rückstoß auf den Spieler
  p.vx -= Math.cos(aim) * w.recoil;
  p.vy -= Math.sin(aim) * w.recoil;
  run.emit('shot', mx, my, aim, id);

  if (ars.ammo[id] !== Infinity) {
    ars.ammo[id]--;
    if (ars.ammo[id] <= 0) {
      ars.ammo[id] = 0;
      run.emit('weaponEmpty', id);
      autoSwitch(run);
    }
  }
}
