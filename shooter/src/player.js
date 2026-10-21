// Spieler: Bewegung, Dash, Schaden. Reine Logik.

import { CONFIG } from './config.js';
import { resolveCircle } from './world.js';
import { clamp, length } from './utils.js';

export function createPlayer(x, y) {
  const pc = CONFIG.player;
  return {
    x, y, px: x, py: y,
    vx: 0, vy: 0,
    r: pc.radius,
    hp: pc.maxHp,
    maxHp: pc.maxHp,
    aim: 0,
    moving: 0,          // 0..1, für die Streckung beim Laufen
    dashT: 0,           // verbleibende Dash-Zeit
    dashDX: 1, dashDY: 0,
    dashCharges: 1,
    dashRecharge: 0,
    graceT: 0,          // kurze Unverwundbarkeit nach dem Dash
    invuln: 0,
    dead: false,
    healAcc: 0,         // Vampir: angesammelte Bruchteile
    lastHitBy: '',
  };
}

// Abgeleiteter Wert: maximale Dash-Ladungen (Doppel-Dash)
export function dashMaxCharges(run) {
  return 1 + run.mods.dashExtra;
}

export function updatePlayer(run, dt, act) {
  const p = run.player;
  if (p.dead) return;
  const pc = CONFIG.player;
  const dc = CONFIG.dash;

  if (act.aimValid) p.aim = act.aimAngle;

  // Dash-Ladungen nachfüllen (eine nach der anderen)
  const maxCharges = dashMaxCharges(run);
  if (p.dashCharges < maxCharges) {
    p.dashRecharge += dt;
    if (p.dashRecharge >= dc.cooldown) {
      p.dashRecharge = 0;
      p.dashCharges++;
      if (p.dashCharges >= maxCharges) run.emit('dashReady');
    }
  } else {
    p.dashRecharge = 0;
  }

  let mx = act.moveX;
  let my = act.moveY;
  let m = length(mx, my);
  if (m > 1) { mx /= m; my /= m; m = 1; }

  if (p.dashT > 0) {
    // Während des Dashes: feste Richtung und Tempo
    const speed = dc.distance / dc.duration;
    p.vx = p.dashDX * speed;
    p.vy = p.dashDY * speed;
    p.dashT -= dt;
    run.emit('afterimage', p.x, p.y, p.aim);
    if (p.dashT <= 0) {
      p.dashT = 0;
      p.graceT = dc.grace;
      const keep = CONFIG.player.maxSpeed * run.mods.speedMult / speed;
      p.vx *= keep;
      p.vy *= keep;
      run.emit('dashEnd', p.x, p.y);
      if (run.mods.dashBoom) run.explodeAt(p.x, p.y, run.mods.dashBoomRadius, run.mods.dashBoomDamage, 'player', 'dash');
    }
  } else {
    const maxSpeed = pc.maxSpeed * run.mods.speedMult;
    const accel = pc.accel * run.mods.speedMult;
    if (m > 0.01) {
      // Auf Zielgeschwindigkeit zubeschleunigen (Vektor-Annäherung)
      approachVelocity(p, mx * maxSpeed, my * maxSpeed, accel * dt);
    } else {
      // Reibung: aus voller Fahrt in stopTime stehen
      approachVelocity(p, 0, 0, (pc.maxSpeed / pc.stopTime) * dt);
    }
    if (act.dash && p.dashCharges >= 1) startDash(run, mx, my, m);
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  resolveCircle(run.world, p, p.r, null);

  const speedNow = length(p.vx, p.vy);
  p.moving = clamp(speedNow / pc.maxSpeed, 0, 1);

  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.graceT > 0) p.graceT = Math.max(0, p.graceT - dt);
}

function approachVelocity(p, tx, ty, step) {
  const dx = tx - p.vx;
  const dy = ty - p.vy;
  const d = length(dx, dy);
  if (d <= step || d < 1e-6) {
    p.vx = tx;
    p.vy = ty;
  } else {
    p.vx += (dx / d) * step;
    p.vy += (dy / d) * step;
  }
}

function startDash(run, mx, my, m) {
  const p = run.player;
  if (m > 0.2) {
    p.dashDX = mx / m;
    p.dashDY = my / m;
  } else {
    p.dashDX = Math.cos(p.aim);
    p.dashDY = Math.sin(p.aim);
  }
  p.dashT = CONFIG.dash.duration;
  p.dashCharges--;
  run.stats.dashes++;
  run.emit('dash', p.x, p.y, Math.atan2(p.dashDY, p.dashDX));
}

export function isPlayerInvulnerable(run) {
  const p = run.player;
  return p.dead || p.dashT > 0 || p.graceT > 0 || p.invuln > 0 || run.god;
}

// Schaden am Spieler. Rückgabe: tatsächlich abgezogene Lebenspunkte.
export function hurtPlayer(run, amount, source, fromX, fromY) {
  const p = run.player;
  if (amount <= 0 || isPlayerInvulnerable(run)) return 0;
  // Schild absorbiert zuerst
  const sh = run.power.shield;
  if (sh.amount > 0) {
    const absorbed = Math.min(sh.amount, amount);
    sh.amount -= absorbed;
    amount -= absorbed;
    if (sh.amount <= 0) { sh.amount = 0; sh.t = 0; run.emit('shieldBreak', p.x, p.y); }
    else run.emit('shieldHit', p.x, p.y);
    if (amount <= 0) {
      p.invuln = 0.25;
      return 0;
    }
  }
  p.hp -= amount;
  p.invuln = CONFIG.player.invulnAfterHit;
  p.lastHitBy = source;
  run.stats.damageTaken += amount;
  run.waves.hitThisWave = true;
  // Schubs weg von der Quelle
  if (fromX !== undefined) {
    let dx = p.x - fromX;
    let dy = p.y - fromY;
    const d = length(dx, dy) || 1;
    dx /= d;
    dy /= d;
    p.vx += dx * CONFIG.player.hitKnockback;
    p.vy += dy * CONFIG.player.hitKnockback;
  }
  run.onPlayerHit();
  run.emit('playerHit', p.x, p.y, amount);
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    run.emit('playerDeath', p.x, p.y);
  }
  return amount;
}

export function healPlayer(run, amount) {
  const p = run.player;
  if (p.dead) return 0;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  return p.hp - before;
}
