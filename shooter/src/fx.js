// Effekte: übersetzt Spiel-Ereignisse in Partikel, Screenshake, Hit-Stop, Ton und Vibration.

import { CONFIG } from './config.js';
import { addTrauma } from './camera.js';
import { PK, burst, emit, emitText, amount, addDamageText } from './particles.js';
import { paintBurn } from './render_world.js';
import { TAU } from './utils.js';
import { handleMore } from './fx_more.js';

const T = CONFIG.trauma;

export function createFx(particles, game, settings) {
  const fx = {
    ps: particles,
    game,
    settings,
    audio: null,           // wird in main.js gesetzt
    hurt: 0,               // roter Rand nach Treffer (0..1)
    comboFlash: 0,
    afterToggle: 0,
    bossFlash: 0,
    events: 0,
    queue: [],             // verzögerte Effekte (z. B. Explosionsserie beim Boss-Tod)
  };
  fx.listener = (type, a, b, c, d, e) => handle(fx, type, a, b, c, d, e);
  return fx;
}

// Verzögerte Effekte abarbeiten (pro Bild, mit sichtbarer Zeit)
export function updateFx(fx, dt) {
  const q = fx.queue;
  for (let i = q.length - 1; i >= 0; i--) {
    q[i].t -= dt;
    if (q[i].t <= 0) {
      const it = q[i];
      q.splice(i, 1);
      explosion(fx, it.x, it.y, it.r, true);
      trauma(fx, 0.25);
      sound(fx, 'explosion', it.r);
    }
  }
}

export function attachFx(fx, run) {
  if (!run.listeners.includes(fx.listener)) run.listeners.push(fx.listener);
}

function trauma(fx, v) {
  addTrauma(fx.game.cam, v);
}

function sound(fx, name, a, b) {
  // die Demo im Startbildschirm bleibt stumm (nur Musik)
  if (fx.audio && !(fx.game.run && fx.game.run.demo)) fx.audio.play(name, a, b);
}

function vibrate(fx, ms) {
  if (!fx.settings.vibration || fx.game.run?.demo) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(ms); } catch { /* nicht unterstützt */ }
  }
}

function enemyColor(e) {
  return e && e.boss ? e.boss.color : e ? e.def.color : '#ffffff';
}

function explosion(fx, x, y, radius, big) {
  const ps = fx.ps;
  emit(ps, PK.FLASH, x, y, 0, 0, big ? 0.16 : 0.1, radius * (big ? 1.1 : 0.8), '#ffffff');
  const ring = emit(ps, PK.RING, x, y, 0, 0, 0.35, radius * 0.25, '#ffb347');
  if (ring) ring.size2 = radius * 1.15;
  burst(ps, PK.DOT, x, y, big ? 28 : 18, 80, radius * 4, 0.5, 5, '#ffb347', null, TAU, 3.5);
  burst(ps, PK.SPARK, x, y, big ? 16 : 10, 200, radius * 6, 0.35, 2, '#fff2b0', null, TAU, 3);
  const nSmoke = amount(ps, big ? 8 : 5);
  for (let i = 0; i < nSmoke; i++) {
    const a = Math.random() * TAU;
    const s = 20 + Math.random() * radius * 0.8;
    const p = emit(ps, PK.SMOKE, x + Math.cos(a) * radius * 0.2, y + Math.sin(a) * radius * 0.2,
      Math.cos(a) * s, Math.sin(a) * s, 0.9 + Math.random() * 0.6, radius * 0.25, '#2a2a3a');
    if (p) { p.size2 = radius * 0.6; p.drag = 2; }
  }
  if (big) {
    const n = amount(ps, 6);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 150 + Math.random() * 250;
      const p = emit(ps, PK.DEBRIS, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.7, 4 + Math.random() * 4, '#ffd27a');
      if (p) { p.drag = 3; p.spin = (Math.random() - 0.5) * 20; }
    }
  }
  paintBurn(x, y, radius * 0.75, big ? 1 : 0.8);
}

function handle(fx, type, a, b, c, d, e) {
  const ps = fx.ps;
  const s = fx.settings;
  fx.events++;
  switch (type) {
    case 'shot': {
      // a, b = Mündung, c = Winkel, d = Waffe
      const big = d === 'shotgun' || d === 'rocket';
      const m = emit(ps, PK.MUZZLE, a, b, 0, 0, 0.035, big ? 26 : 16, d === 'rocket' ? '#ffb347' : '#bfffff');
      if (m) m.rot = c;
      // kurzes Licht am Boden
      emit(ps, PK.FLASH, a, b, 0, 0, 0.06, big ? 50 : 28, '#3ff3ff');
      if (d !== 'rocket' && d !== 'rail') {
        // Hülse fliegt seitlich weg und bleibt kurz liegen
        const side = c + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        const sp = 120 + Math.random() * 80;
        const p = emit(ps, PK.CASING, a, b, Math.cos(side) * sp - Math.cos(c) * 40, Math.sin(side) * sp - Math.sin(c) * 40,
          0.35, d === 'shotgun' ? 3.5 : 2.5, d === 'shotgun' ? '#ff5a3c' : '#ffd23f', 0);
        if (p) { p.drag = 7; p.spin = (Math.random() - 0.5) * 30; p.rot = c; }
      }
      trauma(fx, T[CONFIG.weapons[d].trauma] || T.shot);
      sound(fx, d);
      break;
    }
    case 'enemyHit': {
      const col = enemyColor(e);
      burst(ps, PK.SPARK, a, b, 3 + Math.min(5, c / 6), 120, 360, 0.18, 1.6, col, null, TAU, 6);
      if (s.damageNumbers && e) addDamageText(ps, e, a, b - 10, c, d);
      sound(fx, 'hit', d);
      break;
    }
    case 'enemyDeath': {
      const col = enemyColor(e);
      const big = c === 'tank' || (e && e.boss);
      burst(ps, PK.DOT, a, b, big ? 40 : 22, 60, 380, 0.55, 3.5, col, null, TAU, 3);
      burst(ps, PK.SPARK, a, b, big ? 14 : 8, 160, 520, 0.3, 2, '#ffffff', null, TAU, 4);
      const ring = emit(ps, PK.RING, a, b, 0, 0, 0.3, d * 0.6, col);
      if (ring) ring.size2 = d * 2.6;
      emit(ps, PK.FLASH, a, b, 0, 0, 0.07, d * 1.6, col);
      if (big) explosion(fx, a, b, d * 2.2, true);
      trauma(fx, big ? 0.2 : 0.05);
      sound(fx, 'death', big ? 1 : 0);
      break;
    }
    case 'score':
      if (a > 0) emitText(ps, b, c - 26, a, '#ffd23f', 12, '+');
      break;
    case 'playerHit':
      fx.hurt = 1;
      trauma(fx, T.playerHit);
      burst(ps, PK.SPARK, a, b, 12, 150, 420, 0.3, 2, '#ff3b6b', null, TAU, 4);
      fx.game.hitStop = Math.max(fx.game.hitStop, CONFIG.juice.hitStopPlayerHit);
      vibrate(fx, 40);
      sound(fx, 'playerHit');
      break;
    case 'playerDeath':
      explosion(fx, a, b, 160, true);
      burst(ps, PK.DOT, a, b, 50, 100, 600, 1.0, 4, CONFIG.colors.player, null, TAU, 2.5);
      trauma(fx, T.playerDeath);
      vibrate(fx, 300);
      sound(fx, 'playerDeath');
      break;
    case 'explosion': {
      // a, b = Ort, c = Radius, d = Team, e = Quelle
      explosion(fx, a, b, c, c >= 100);
      trauma(fx, c >= 120 ? T.bigExplosion : T.explosion);
      sound(fx, 'explosion', c);
      break;
    }
    case 'bulletWall':
    case 'enemyBulletWall':
      burst(ps, PK.SPARK, a, b, 4, 80, 260, 0.15, 1.4, type === 'bulletWall' ? '#bfffff' : '#ff6b8b', null, TAU, 6);
      break;
    case 'bulletFade':
      emit(ps, PK.DOT, a, b, 0, 0, 0.12, 3, '#bfffff');
      break;
    case 'enemyBulletHit':
      burst(ps, PK.SPARK, a, b, 6, 100, 300, 0.2, 2, '#ff3b6b', null, TAU, 5);
      break;
    case 'enemyBulletFade':
      emit(ps, PK.DOT, a, b, 0, 0, 0.2, 6, '#ff3b6b');
      break;
    case 'dash':
      burst(ps, PK.DOT, a, b, 10, 40, 160, 0.35, 3, CONFIG.colors.player, c + Math.PI, 1.2, 4);
      sound(fx, 'dash');
      break;
    case 'afterimage': {
      fx.afterToggle = (fx.afterToggle + 1) % 2;
      if (fx.afterToggle === 0) {
        const p = emit(ps, PK.AFTER, a, b, 0, 0, 0.28, 1, CONFIG.colors.player, 1);
        if (p) p.rot = c;
      }
      break;
    }
    case 'dashEnd':
      break;
    case 'hitStop':
      fx.game.hitStop = Math.max(fx.game.hitStop, a);
      break;
    case 'rail': {
      const p = emit(ps, PK.BEAM, a, b, 0, 0, 0.22, CONFIG.weapons.rail.beamWidth, '#9ffcff');
      if (p) { p.x2 = c; p.y2 = d; }
      const len = Math.sqrt((c - a) ** 2 + (d - b) ** 2);
      const n = amount(ps, Math.min(30, len / 40));
      for (let i = 0; i < n; i++) {
        const t = Math.random();
        const q = emit(ps, PK.DOT, a + (c - a) * t, b + (d - b) * t, (Math.random() - 0.5) * 120,
          (Math.random() - 0.5) * 120, 0.4, 2.5, '#9ffcff');
        if (q) q.drag = 3;
      }
      burst(ps, PK.SPARK, c, d, 10, 150, 400, 0.25, 2, '#ffffff', null, TAU, 5);
      trauma(fx, T.rail);
      sound(fx, 'rail');
      break;
    }
    case 'railCharge':
      sound(fx, 'railCharge');
      break;
    case 'railCancel':
      if (fx.audio) fx.audio.stopCharge();
      break;
    case 'rocketTrail': {
      const t = emit(ps, PK.TRAIL, a, b, 0, 0, 0.35, 3.5, '#ffb347');
      if (t) { t.x2 = a - c / 60; t.y2 = b - d / 60; }
      const p = emit(ps, PK.DOT, a - c * 0.016, b - d * 0.016, -c * 0.1 + (Math.random() - 0.5) * 40,
        -d * 0.1 + (Math.random() - 0.5) * 40, 0.3, 3, '#ff9a2f');
      if (p) p.drag = 4;
      if (Math.random() < 0.4) {
        const q = emit(ps, PK.SMOKE, a, b, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.6, 5, '#30303f');
        if (q) q.size2 = 16;
      }
      break;
    }
    case 'trail': {
      // a, b = Ort, c, d = Geschwindigkeit, e = Farbe: dünne leuchtende Linie
      const p = emit(ps, PK.TRAIL, a, b, 0, 0, 0.28, 2.5, e);
      if (p) { p.x2 = a - c / 60; p.y2 = b - d / 60; }
      break;
    }
    case 'stomp': {
      trauma(fx, T.stomp);
      burst(ps, PK.DOT, a, b, 14, 100, 300, 0.4, 3, '#7dff3a', null, TAU, 4);
      sound(fx, 'stomp');
      break;
    }
    case 'shieldBlock':
      burst(ps, PK.SPARK, a, b, 6, 120, 320, 0.2, 1.8, '#9fc3ff', c + Math.PI, 1.6, 5);
      sound(fx, 'block');
      break;
    case 'shieldHit':
      burst(ps, PK.SPARK, a, b, 8, 100, 300, 0.25, 2, CONFIG.powerups.shield.color, null, TAU, 4);
      sound(fx, 'shieldHit');
      break;
    case 'shieldBreak': {
      const r = emit(ps, PK.RING, a, b, 0, 0, 0.35, 30, CONFIG.powerups.shield.color);
      if (r) r.size2 = 70;
      sound(fx, 'shieldBreak');
      break;
    }
    case 'enemyShot':
      emit(ps, PK.FLASH, a, b, 0, 0, 0.06, 20, '#ff3b6b');
      sound(fx, 'enemyShot');
      break;
    case 'comboTier':
      fx.comboFlash = 1;
      sound(fx, 'combo', a);
      break;
    case 'bounce':
      burst(ps, PK.SPARK, a, b, 3, 80, 200, 0.12, 1.4, '#bfffff', null, TAU, 6);
      break;
    default:
      break;
  }
  // weitere Ereignisse (Wellen, Drops, Bosse) behandelt fx_more.js
  handleMore(fx, type, a, b, c, d, e);
}
