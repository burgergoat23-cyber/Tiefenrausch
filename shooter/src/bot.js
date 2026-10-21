// Einfacher Computer-Spieler: für die Demo im Startbildschirm und für Simulationstests.
// Zielt auf den nächsten Gegner (mit Vorhalt), hält Abstand, weicht Kugeln aus, dasht in Not.

import { CONFIG } from './config.js';
import { obstacleAt } from './world.js';

export function createBot(seed = 1) {
  let s = seed >>> 0;
  return {
    rand() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    },
    strafe: 1,
    strafeT: 0,
    actions: {
      moveX: 0, moveY: 0, aimValid: true, aimAngle: 0, aimReach: 300, aimMode: 'stick',
      fire: false, dash: false, weaponDir: 0, weaponSlot: 0, assist: false,
    },
  };
}

function nearestEnemy(run) {
  const p = run.player;
  let best = null;
  let bd = Infinity;
  for (const e of run.enemies) {
    if (e.dead || e.spawning) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best ? { e: best, d: Math.sqrt(bd) } : null;
}

export function botActions(bot, run, dt) {
  const a = bot.actions;
  const p = run.player;
  a.dash = false;
  a.weaponDir = 0;
  a.weaponSlot = 0;
  a.fire = false;
  let mx = 0;
  let my = 0;

  bot.strafeT -= dt;
  if (bot.strafeT <= 0) {
    bot.strafe = bot.rand() < 0.5 ? -1 : 1;
    bot.strafeT = 1 + bot.rand() * 2;
  }

  const near = nearestEnemy(run);
  if (near) {
    const e = near.e;
    // Vorhalt: wohin bewegt sich der Gegner bis die Kugel ankommt?
    const speed = CONFIG.weapons[run.arsenal.current].speed || 900;
    const tHit = near.d / speed;
    const tx = e.x + e.vx * tHit;
    const ty = e.y + e.vy * tHit;
    a.aimAngle = Math.atan2(ty - p.y, tx - p.x);
    a.fire = near.d < 900;
    // Abstand halten und seitlich laufen
    const dx = (p.x - e.x) / near.d;
    const dy = (p.y - e.y) / near.d;
    const want = e.boss ? 380 : 260;
    const radial = near.d < want ? 1 : near.d > want + 120 ? -0.6 : 0;
    mx = dx * radial + -dy * bot.strafe * 0.9;
    my = dy * radial + dx * bot.strafe * 0.9;
    if (near.d < e.r + 60 && p.dashCharges > 0) a.dash = true;
  } else {
    // nichts zu tun: zur Mitte und Drops einsammeln
    let target = { x: run.world.width / 2, y: run.world.height / 2 };
    if (run.pickups && run.pickups.length) target = run.pickups[0];
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 40) { mx = dx / d; my = dy / d; }
  }

  // Kugeln ausweichen: nahe Kugel, die auf uns zufliegt -> quer dazu laufen
  const pool = run.projectiles.enemy;
  for (let i = 0; i < pool.count; i++) {
    const b = pool.items[i];
    const rx = p.x - b.x;
    const ry = p.y - b.y;
    const d2 = rx * rx + ry * ry;
    if (d2 > 220 * 220) continue;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
    const along = (rx * b.vx + ry * b.vy) / sp;
    if (along <= 0) continue;
    const side = (rx * b.vy - ry * b.vx) / sp;
    if (Math.abs(side) > 40) continue;
    const s = side >= 0 ? 1 : -1;
    mx += (b.vy / sp) * s * 2;
    my += (-b.vx / sp) * s * 2;
    if (d2 < 90 * 90 && p.dashCharges > 0) a.dash = true;
  }

  // Gefahren am Boden meiden
  for (const h of run.hazards) {
    if (h.kind === 'acid' || h.kind === 'glob') {
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 110) { mx += dx / d * 2; my += dy / d * 2; }
    }
  }

  // nicht in Hindernisse oder Wände laufen
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 0.01) {
    mx /= len;
    my /= len;
    const look = 60;
    if (obstacleAt(run.world, p.x + mx * look, p.y + my * look, p.r)
      || p.x + mx * look < 30 || p.y + my * look < 30
      || p.x + mx * look > run.world.width - 30 || p.y + my * look > run.world.height - 30) {
      const t = mx;
      mx = -my * bot.strafe;
      my = t * bot.strafe;
    }
  }
  a.moveX = mx;
  a.moveY = my;
  a.aimReach = 300;
  return a;
}
