// Weitere Effekte: Wellen, Spawns, Gegner-Ankündigungen, Drops und Bosse.

import { CONFIG } from './config.js';
import { addTrauma, panTo } from './camera.js';
import { PK, burst, emit, amount, emitLabel } from './particles.js';
import { TAU } from './utils.js';

function sound(fx, name, a, b) {
  if (fx.audio && !demo(fx)) fx.audio.play(name, a, b);
}

function demo(fx) {
  return !!(fx.game.run && fx.game.run.demo);
}

export function handleMore(fx, type, a, b, c, d, e) {
  const ps = fx.ps;
  switch (type) {
    case 'spawnWarn': {
      // Partikel saugen sich zum Spawnpunkt
      const col = CONFIG.enemies[c] ? CONFIG.enemies[c].color : '#ff2e4d';
      const n = amount(ps, 10);
      const life = CONFIG.waves.spawnWarn;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * TAU;
        const r = 50 + Math.random() * 40;
        const sp = r / life;
        emit(ps, PK.IMPLODE, a + Math.cos(ang) * r, b + Math.sin(ang) * r,
          -Math.cos(ang) * sp, -Math.sin(ang) * sp, life * (0.8 + Math.random() * 0.2), 2.5, col);
      }
      break;
    }
    case 'spawn': {
      const col = CONFIG.enemies[c] ? CONFIG.enemies[c].color : '#ffffff';
      const ring = emit(ps, PK.RING, a, b, 0, 0, 0.25, 6, col);
      if (ring) ring.size2 = 40;
      sound(fx, 'spawn');
      break;
    }
    case 'waveStart':
      sound(fx, d ? 'bossWave' : 'waveStart');
      if (fx.audio && !demo(fx)) fx.audio.setIntensity(d ? 2 : 1);
      break;
    case 'waveClear':
      sound(fx, 'waveClear');
      if (fx.audio && !demo(fx)) fx.audio.setIntensity(0);
      break;
    case 'fuse':
      sound(fx, 'fuse');
      break;
    case 'tankWindup':
      sound(fx, 'windup');
      break;
    case 'enemyCharge':
      sound(fx, 'charge');
      break;
    case 'split':
      burst(ps, PK.DOT, a, b, 10, 80, 220, 0.4, 3, CONFIG.enemies.splitter.color, null, TAU, 4);
      break;
    case 'hatch':
      burst(ps, PK.DOT, a, b, 12, 60, 200, 0.4, 3, CONFIG.enemies.egg.color, null, TAU, 4);
      sound(fx, 'hatch');
      break;
    case 'enemyGone':
      break;
    case 'sprint':
      sound(fx, 'sprint');
      break;
    case 'pickup': {
      // Ring zieht sich zusammen, dazu Funken
      const ring = emit(ps, PK.RING, a, b, 0, 0, 0.3, 46, d || '#ffffff');
      if (ring) ring.size2 = 4;
      burst(ps, PK.SPARK, a, b, 10, 120, 340, 0.3, 1.8, d || '#ffffff', null, TAU, 4);
      sound(fx, 'pickup');
      break;
    }
    case 'pickupText':
      emitLabel(ps, a, b - 30, c, d || '#ffffff', 15);
      break;
    case 'bossAppear':
      panTo(fx.game.cam, a, b);
      fx.bossFlash = 1;
      sound(fx, 'bossAppear');
      break;
    case 'bossRoar': {
      addTrauma(fx.game.cam, CONFIG.trauma.bossRoar);
      const ring = emit(ps, PK.RING, a, b, 0, 0, 0.6, 60, '#ffffff');
      if (ring) ring.size2 = 420;
      fx.bossFlash = 0.6;
      sound(fx, 'roar');
      break;
    }
    case 'bossAttack':
      addTrauma(fx.game.cam, CONFIG.trauma.bossAttack);
      break;
    case 'bossTelegraph':
      sound(fx, 'charge', 1);
      break;
    case 'bossCharge':
      sound(fx, 'dash');
      addTrauma(fx.game.cam, 0.15);
      break;
    case 'bossDeath':
      // Explosionsserie rund um den Boss
      for (let i = 0; i < 7; i++) {
        const ang = Math.random() * TAU;
        const r = 20 + Math.random() * 90;
        fx.queue.push({ t: 0.12 + i * 0.16, x: a + Math.cos(ang) * r, y: b + Math.sin(ang) * r, r: 90 + Math.random() * 80 });
      }
      addTrauma(fx.game.cam, CONFIG.trauma.bossDeath);
      fx.game.hitStop = Math.max(fx.game.hitStop, CONFIG.juice.hitStopBoss);
      fx.bossFlash = 1;
      if (fx.settings.vibration && !demo(fx) && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(250); } catch { /* nicht unterstützt */ }
      }
      sound(fx, 'bossDeath');
      break;
    case 'bonus':
      sound(fx, 'bonus');
      break;
    default:
      break;
  }
}
