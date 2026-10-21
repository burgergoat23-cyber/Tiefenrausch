// HUD im Spiel: Leben, Schild, Punkte, Kombo, Waffe, Power-ups, Welle, Boss-Leiste.
// Zeichnet in Bildschirm-Koordinaten (CSS-Pixel) und beachtet sichere Bereiche (Notch).

import { CONFIG } from './config.js';
import { FONT, MONO } from './ui.js';
import { clamp, formatScore } from './utils.js';
import { comboMultiplier } from './scoring.js';
import { hexAlpha } from './sprites.js';
import { drawIcon } from './icons.js';

const C = CONFIG.colors;

export function createHudState() {
  return {
    hpLag: CONFIG.player.maxHp,   // verzögerter weißer Schaden-Balken
    hpLagHold: 0,
    lastHp: CONFIG.player.maxHp,
    score: 0,
    scorePop: 0,
    combo: 0,
    comboPop: 0,
    ammoPop: 0,
    lastAmmo: 0,
    lastWeapon: '',
    wave: 0,
    wavePop: 0,
  };
}

export function hudScale(w, h) {
  return clamp(Math.min(w, h) / 430, 0.78, 1.3);
}

// Werte für Animationen nachführen (pro Bild)
export function updateHud(hs, run, dt) {
  const p = run.player;
  if (p.hp < hs.lastHp) hs.hpLagHold = 0.45;
  if (p.hp > hs.hpLag) hs.hpLag = p.hp;
  hs.lastHp = p.hp;
  if (hs.hpLagHold > 0) hs.hpLagHold -= dt;
  else hs.hpLag = Math.max(p.hp, hs.hpLag - p.maxHp * 0.6 * dt);

  const sc = run.score.score;
  if (sc !== hs.score) {
    hs.scorePop = 1;
    hs.score = sc;
  }
  if (run.score.combo !== hs.combo) {
    if (run.score.combo > hs.combo) hs.comboPop = 1;
    hs.combo = run.score.combo;
  }
  const ammo = run.arsenal.ammo[run.arsenal.current];
  if (ammo !== hs.lastAmmo || run.arsenal.current !== hs.lastWeapon) {
    hs.ammoPop = run.arsenal.current !== hs.lastWeapon ? 1 : 0.4;
    hs.lastAmmo = ammo;
    hs.lastWeapon = run.arsenal.current;
  }
  if (run.waves.number !== hs.wave) {
    hs.wavePop = 1;
    hs.wave = run.waves.number;
  }
  hs.scorePop = Math.max(0, hs.scorePop - dt * 5);
  hs.comboPop = Math.max(0, hs.comboPop - dt * 4);
  hs.ammoPop = Math.max(0, hs.ammoPop - dt * 5);
  hs.wavePop = Math.max(0, hs.wavePop - dt * 3);
}

function bar(ctx, x, y, w, h, frac, color, back = 'rgba(255,255,255,0.08)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function text(ctx, s, x, y, size, color, align = 'left', weight = 800, font = FONT) {
  ctx.font = `${weight} ${Math.round(size)}px ${font}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// layout = { w, h, safe: {top,right,bottom,left}, touch }
export function drawHud(ctx, hs, run, layout, time, fx) {
  const { w, h, safe } = layout;
  const u = hudScale(w, h);
  const pad = 14 * u;
  const left = safe.left + pad;
  const top = safe.top + pad;
  const right = w - safe.right - pad;
  const bottom = h - safe.bottom - pad;
  ctx.textBaseline = 'alphabetic';

  // --- oben links: Leben (mit verzögertem Schaden-Balken) und Schild ---
  const p = run.player;
  const bw = 210 * u;
  const bh = 14 * u;
  const sh = run.power.shield;
  let y = top;
  if (sh.amount > 0) {
    bar(ctx, left, y, bw, 5 * u, sh.amount / CONFIG.powerups.shield.amount, C.shield);
    y += 8 * u;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(left, y, bw, bh);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(left, y, bw * clamp(hs.hpLag / p.maxHp, 0, 1), bh);
  const low = p.hp / p.maxHp < CONFIG.player.lowHpFraction;
  const hpCol = low ? (Math.sin(time * 10) > 0 ? C.hpLow : '#ff8a9a') : C.hp;
  ctx.fillStyle = hpCol;
  ctx.fillRect(left, y, bw * clamp(p.hp / p.maxHp, 0, 1), bh);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, y + 0.5, bw - 1, bh - 1);
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, left + 6 * u, y + bh - 3 * u, 11 * u, '#04120a', 'left', 800, MONO);

  // --- oben rechts: Punkte, Kombo ---
  const sPop = 1 + hs.scorePop * 0.18;
  text(ctx, formatScore(run.score.score), right, top + 24 * u * sPop, 26 * u * sPop, C.hud, 'right', 900, MONO);
  const combo = run.score.combo;
  if (combo > 0) {
    const mult = comboMultiplier(combo);
    const cPop = 1 + hs.comboPop * 0.3;
    const flash = fx ? fx.comboFlash : 0;
    const col = flash > 0 ? '#ffffff' : C.combo;
    text(ctx, `${combo}× KOMBO`, right, top + 48 * u, 14 * u * cPop, col, 'right', 800);
    if (mult > 1) text(ctx, `x${String(mult).replace('.', ',')}`, right - 118 * u, top + 48 * u, 16 * u * cPop, col, 'right', 900);
    bar(ctx, right - 110 * u, top + 55 * u, 110 * u, 4 * u, run.score.comboT / CONFIG.combo.window, col);
  }

  // --- unten Mitte: Waffe und Munition, andere Waffen klein daneben ---
  drawWeapons(ctx, run, hs, w / 2, bottom - 18 * u, u);

  // --- unten links: aktive Power-ups ---
  drawPowerups(ctx, run, left, bottom, u);
}

// Waffenleiste: aktuelle Waffe groß mit Name und Munition, die anderen Plätze klein daneben.
// Liefert die Trefferflächen der Plätze (für Touch-Waffenwechsel).
export const weaponSlots = [];

function drawWeapons(ctx, run, hs, cx, bottom, u) {
  const ars = run.arsenal;
  const id = ars.current;
  const w = CONFIG.weapons[id];
  const order = CONFIG.weapons.order;
  const pop = 1 + hs.ammoPop * 0.2;
  const ammo = ars.ammo[id];
  const ammoTxt = ammo === Infinity ? '∞' : String(ammo);
  const low = ammo !== Infinity && ammo <= Math.ceil(w.ammo * 0.2);
  text(ctx, w.name.toUpperCase(), cx, bottom - 40 * u, 12 * u, C.hudDim, 'center', 800);
  text(ctx, ammoTxt, cx, bottom - 16 * u, 22 * u * pop, low ? '#ff8a5a' : C.hud, 'center', 900, MONO);
  // Railgun-Ladebalken
  if (id === 'rail' && ars.railCharge > 0) {
    bar(ctx, cx - 30 * u, bottom - 10 * u, 60 * u, 3 * u, ars.railCharge / CONFIG.weapons.rail.charge, '#9ffcff');
  }
  // Plätze 1-5 als Reihe; vorhandene hell, fehlende nur als Umriss
  const slot = 30 * u;
  const gap = 6 * u;
  const rowW = order.length * slot + (order.length - 1) * gap;
  let x = cx - rowW / 2;
  const y = bottom - 4 * u;
  weaponSlots.length = 0;
  order.forEach((wid, i) => {
    const has = ars.ammo[wid] > 0;
    const cur = wid === id;
    const sx = x + i * (slot + gap);
    weaponSlots.push({ id: wid, x: sx, y: y, w: slot, h: slot * 0.62 });
    ctx.globalAlpha = has ? 1 : 0.25;
    ctx.strokeStyle = cur ? C.player : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = cur ? 2 : 1;
    ctx.strokeRect(sx + 0.5, y + 0.5, slot - 1, slot * 0.62);
    if (cur) {
      ctx.fillStyle = 'rgba(63,243,255,0.15)';
      ctx.fillRect(sx, y, slot, slot * 0.62);
    }
    drawIcon(ctx, wid, sx + slot * 0.32, y + slot * 0.31, slot * 0.42, cur ? '#ffffff' : C.hudDim, 1.6);
    const a = ars.ammo[wid];
    if (has) text(ctx, a === Infinity ? '∞' : String(a), sx + slot - 3 * u, y + slot * 0.5, 8 * u, cur ? '#ffffff' : C.hudDim, 'right', 800, MONO);
    text(ctx, String(i + 1), sx + 2 * u, y - 2 * u, 7 * u, C.hudDim, 'left', 700, MONO);
    ctx.globalAlpha = 1;
  });
}

const POWER_ORDER = ['shield', 'rapid', 'multi', 'slow'];

function drawPowerups(ctx, run, left, bottom, u) {
  let x = left;
  const size = 30 * u;
  for (const id of POWER_ORDER) {
    const t = id === 'shield' ? run.power.shield.t : run.power[id];
    if (!(t > 0)) continue;
    const def = CONFIG.powerups[id];
    const frac = t / def.duration;
    ctx.fillStyle = hexAlpha(def.color, 0.15);
    ctx.fillRect(x, bottom - size, size, size);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, bottom - size + 0.5, size - 1, size - 1);
    drawIcon(ctx, id, x + size / 2, bottom - size / 2, size * 0.62, def.color, 2);
    bar(ctx, x, bottom + 3 * u, size, 3 * u, Math.min(1, frac), def.color);
    x += size + 8 * u;
  }
}

// Roter Rand: Treffer-Blitz und Pulsieren bei wenig Leben
export function drawDamageVignette(ctx, w, h, hurt, lowHp, time, colorFx) {
  let a = hurt * 0.55;
  if (lowHp) a = Math.max(a, 0.22 + 0.18 * Math.sin(time * 6));
  if (a <= 0.01) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(255,0,40,0)');
  g.addColorStop(1, `rgba(255,20,60,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (colorFx && hurt > 0.3) {
    // leichte Farbverschiebung beim Treffer
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,0,60,${(hurt - 0.3) * 0.12})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
}


const SPECIAL_NAMES = {
  sprinters: 'NUR SPRINTER',
  bomberRain: 'BOMBER-REGEN',
  darkness: 'DUNKELHEIT',
  shooterRing: 'SCHÜTZEN-RING',
};

// Welle oben Mitte, Schriftzug beim Start, Countdown in der Pause
export function drawWaveInfo(ctx, run, layout, time) {
  const { w, h, safe } = layout;
  const u = hudScale(w, h);
  const wv = run.waves;
  const cx = w / 2;
  const top = safe.top + 14 * u;
  ctx.textBaseline = 'alphabetic';

  if (wv.state === 'fight' && !hasBossBar(run)) {
    text(ctx, `WELLE ${wv.number}`, cx, top + 14 * u, 14 * u, C.hud, 'center', 900);
    const rest = wv.remaining;
    text(ctx, `${rest} ${rest === 1 ? 'Gegner' : 'Gegner'}`, cx, top + 32 * u, 12 * u, rest <= CONFIG.waves.markLast ? C.combo : C.hudDim, 'center', 700);
  }

  if (wv.state === 'intro') {
    // großer Schriftzug fährt ein (2 s)
    const total = CONFIG.waves.introTime;
    const k = 1 - wv.t / total;
    const slide = k < 0.18 ? 1 - k / 0.18 : k > 0.82 ? -(k - 0.82) / 0.18 : 0;
    const a = clamp(1 - Math.abs(slide), 0, 1);
    const x = cx + slide * w * 0.6;
    const y = h * 0.36;
    ctx.globalAlpha = a;
    const size = Math.min(w * 0.11, 80 * u);
    ctx.save();
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 18;
    text(ctx, `WELLE ${wv.number}`, x, y, size, '#ffffff', 'center', 900);
    ctx.restore();
    const sub = wv.boss ? 'BOSS: ' + bossNames(wv.boss) : wv.special ? 'SPEZIALWELLE: ' + SPECIAL_NAMES[wv.special] : '';
    if (sub) text(ctx, sub, x, y + size * 0.6, size * 0.3, wv.boss ? '#ff5a6a' : C.combo, 'center', 800);
    ctx.globalAlpha = 1;
  }

  if (wv.state === 'break') {
    const y = h * 0.3;
    const t = CONFIG.waves.breakTime - wv.t;
    const a = clamp(t * 3, 0, 1);
    ctx.globalAlpha = a;
    text(ctx, `WELLE ${wv.number} GESCHAFFT`, cx, y, Math.min(w * 0.06, 34 * u), '#ffffff', 'center', 900);
    if (wv.lastBonus > 0) {
      text(ctx, `+${formatScore(wv.lastBonus)}  OHNE TREFFER`, cx, y + 30 * u, 15 * u, C.combo, 'center', 800);
    }
    const n = Math.ceil(wv.t);
    text(ctx, `Nächste Welle in ${n}`, cx, y + 56 * u, 15 * u, C.hudDim, 'center', 700);
    ctx.globalAlpha = 1;
  }
  void time;
}

function bossNames(boss) {
  return boss.list.map((b) => CONFIG.bosses[b.kind].name).join(' & ');
}

export function hasBossBar(run) {
  return run.enemies.some((e) => e.boss && !e.dead);
}
