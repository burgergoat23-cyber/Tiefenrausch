// Weitere Abläufe für tests/browser_check.mjs: Upgrade, Bosse, Menüs, Touch, Ton, Leistung.

import { shooter, nearestEnemy } from './scenario_helpers.mjs';

// Upgrade-Auswahl öffnen (nach Welle 3), Karte per Taste wählen
export async function upgrade(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  await page.evaluate(() => {
    const g = window.__game;
    g.run.god = true;
    window.__api.startWave(g.run, 3);
    g.run.waves.state = 'break';
    g.run.waves.t = 6;
    g.run.waves.upgradeAsked = false;
  });
  await page.waitForTimeout(1800);
  await shot('karten');
  const st = await page.evaluate(() => window.__game.state);
  await page.waitForTimeout(500);
  if (dev.touch) {
    const box = await page.locator('.card').nth(1).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);
    await shot('karte_gewaehlt');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(200);
    await shot('karte_gewaehlt');
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ state: window.__game.state, ups: window.__game.run.stats.upgrades }));
  console.log(dev.name, st, JSON.stringify(after));
}

// Boss-Kampf: Welle WAVE (5 = Wächter, 10 = Brut), Phasen über Lebenspunkte erzwingen
export async function boss(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  const n = Number(process.env.WAVE || 5);
  await page.evaluate((n) => {
    const g = window.__game;
    g.run.god = true;
    window.__api.startWave(g.run, n);
  }, n);
  await page.waitForTimeout(2600);
  await shot(`boss${n}_auftritt`);
  await page.waitForTimeout(2500);
  await shot(`boss${n}_phase1`);
  const setFrac = (f) => page.evaluate((f) => {
    for (const e of window.__game.run.enemies) if (e.boss && !e.dead) e.hp = e.maxHp * f + 1;
  }, f);
  const fireAtBoss = async (ms) => {
    await page.mouse.down();
    for (let t = 0; t < ms; t += 100) {
      const pos = await page.evaluate(() => {
        const g = window.__game;
        const e = g.run.enemies.find((o) => o.boss && !o.dead);
        if (!e) return null;
        const c = g.cam;
        return { x: (e.x - c.x) * c.zoom + c.screenW / 2, y: (e.y - c.y) * c.zoom + c.screenH / 2 };
      });
      if (pos) await page.mouse.move(pos.x, pos.y);
      await page.waitForTimeout(100);
    }
    await page.mouse.up();
  };
  await setFrac(0.67);
  await fireAtBoss(1500);
  await page.waitForTimeout(3500);
  await shot(`boss${n}_phase2`);
  await setFrac(0.34);
  await fireAtBoss(1500);
  await page.waitForTimeout(3000);
  await shot(`boss${n}_phase3`);
  const info = await page.evaluate(() => {
    const r = window.__game.run;
    return r.enemies.filter((e) => e.boss && !e.dead).map((e) => ({ kind: e.boss.kind, phase: e.boss.phase, hp: Math.round(e.hp), child: e.boss.child }));
  });
  console.log(dev.name, JSON.stringify(info));
  // Boss besiegen
  await page.evaluate(() => { for (const e of window.__game.run.enemies) if (e.boss) e.hp = 1; });
  await fireAtBoss(2500);
  await page.evaluate(() => { for (const e of window.__game.run.enemies) if (e.boss) e.hp = 1; });
  await fireAtBoss(2000);
  await shot(`boss${n}_besiegt`);
  console.log(dev.name, JSON.stringify(await page.evaluate(() => ({ wave: window.__game.run.waves.state, kills: window.__game.run.stats.bossesKilled, score: window.__game.run.score.score }))));
}

// Mittendrin: Welle WAVE mit Waffe WEAPON, Bot-artig zielen, mehrere Bilder
export async function action(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  const n = Number(process.env.WAVE || 7);
  await page.evaluate(([n, w]) => {
    const g = window.__game;
    g.run.god = true;
    window.__api.startWave(g.run, n);
    if (w) { window.__api.giveWeapon(g.run, w); g.run.arsenal.ammo[w] = 999; }
  }, [n, process.env.WEAPON || '']);
  await page.waitForTimeout(3500);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    const t = await nearestEnemy(page);
    if (t) await page.mouse.move(t.x, t.y);
    if (i % 20 === 0) await page.keyboard.press('Space');
    if (i === 25 || i === 45) await shot('action' + i);
    await page.waitForTimeout(100);
  }
  await page.mouse.up();
}

// Ton-Prüfung: jedes Geräusch offline berechnen und Spitzenpegel/Lautheit messen; Musik kurz laufen lassen
export async function sound(page, dev) {
  if (dev.name !== 'pc') return;
  const res = await page.evaluate(async () => {
    const { SOUNDS } = await import('./src/sounds.js');
    const out = {};
    for (const name of Object.keys(SOUNDS)) {
      const ctx = new OfflineAudioContext(1, 44100 * 3, 44100);
      const noise = ctx.createBuffer(1, 88200, 44100);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const a = { ctx, sfx: ctx.destination, noise, stopCharge() {}, charge: null };
      const dur = SOUNDS[name](a, 0.01, 1, 1);
      const buf = await ctx.startRendering();
      const ch = buf.getChannelData(0);
      let peak = 0;
      let sum = 0;
      for (let i = 0; i < ch.length; i++) {
        const v = Math.abs(ch[i]);
        if (v > peak) peak = v;
        sum += ch[i] * ch[i];
      }
      const rmsDb = 10 * Math.log10(sum / Math.max(1, Math.round(dur * 44100)) + 1e-12);
      out[name] = { dur: +dur.toFixed(2), peak: +peak.toFixed(2), rmsDb: +rmsDb.toFixed(1) };
    }
    return out;
  });
  for (const [k, v] of Object.entries(res)) console.log(k.padEnd(12), JSON.stringify(v));
  // echtes Abspielen + Musik
  await page.mouse.click(dev.width / 2, dev.height / 2);
  await page.waitForTimeout(300);
  const live = await page.evaluate(async () => {
    const a = window.__audio;
    a.setIntensity(2);
    for (const n of ['pistol', 'explosion', 'playerHit', 'waveStart', 'bossAppear', 'combo', 'pickup']) a.play(n, 1);
    await new Promise((r) => setTimeout(r, 1500));
    return { state: a.ctx && a.ctx.state, music: !!a.music, pulse: a.music && a.music.pulse(), bpm: a.music && a.music.bpm };
  });
  console.log('live', JSON.stringify(live));
}

// Menüs: Start, Einstellungen, Highscores, Spielen, Pause, Game Over, Name, Nochmal
export async function menus(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  const tap = async (sel) => {
    const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
    const box = await loc.boundingBox();
    if (dev.touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(250);
  };
  await page.waitForTimeout(1500);
  await shot('m1_start');
  await tap('text=Einstellungen');
  await shot('m2_einstellungen');
  await tap(page.locator('.settings .toggle').nth(2));
  await tap('text="Zurück"');
  await tap('text=Highscores');
  await shot('m3_highscores');
  await tap('text="Zurück"');
  await tap('text=SPIELEN');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await shot('m4_pause');
  const pauseState = await page.evaluate(() => window.__game.state);
  await tap('text=Weiter');
  await page.waitForTimeout(300);
  const resumed = await page.evaluate(() => window.__game.state);
  // Runde schnell beenden
  await page.evaluate(() => {
    const r = window.__game.run;
    r.score.score = 12345;
    r.stats.kills = 42;
    r.player.hp = 1;
    r.player.invuln = 0;
    const { createEnemy, addEnemy } = window.__api;
    const e = addEnemy(r, createEnemy(r, 'runner', r.player.x + 20, r.player.y));
    e.speed = 0;
  });
  await page.waitForTimeout(2200);
  await shot('m5_gameover');
  const over = await page.evaluate(() => ({ state: window.__game.state, name: document.querySelector('.name-input')?.value }));
  if (!dev.touch) {
    await page.locator('.name-input').fill('ZED');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
  } else {
    await tap('text=Nochmal');
  }
  await page.waitForTimeout(400);
  const again = await page.evaluate(() => ({ state: window.__game.state, hs: JSON.parse(localStorage.getItem('neonarena_highscores') || '[]') }));
  console.log(dev.name, JSON.stringify({ pauseState, resumed, over, again }));
}

// Touch mit zwei Daumen gleichzeitig (über CDP), Dash-Knopf, Waffenleiste antippen
export async function touch(page, dev, outDir) {
  if (!dev.touch) return;
  const shot = shooter(page, dev, outDir);
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  // SPIELEN antippen
  const box = await page.locator('.start-screen .primary').boundingBox();
  await send('touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 9 }]);
  await send('touchEnd', []);
  await page.waitForTimeout(400);
  const w = dev.width;
  const h = dev.height;
  const p0 = await page.evaluate(() => ({ x: window.__game.run.player.x, y: window.__game.run.player.y, state: window.__game.state }));
  const L = { x: w * 0.18, y: h * 0.75, id: 1 };
  const R = { x: w * 0.8, y: h * 0.72, id: 2 };
  await send('touchStart', [L]);
  await send('touchStart', [L, R]);
  for (let i = 1; i <= 20; i++) {
    // links nach rechts oben schieben, rechts nach links zielen (über die Bildschirmmitte hinaus = Stick bleibt)
    await send('touchMove', [{ ...L, x: L.x + Math.min(50, i * 5), y: L.y - Math.min(30, i * 3) }, { ...R, x: R.x - Math.min(80, i * 8), y: R.y - i }]);
    await page.waitForTimeout(60);
  }
  await shot('touch_sticks');
  const mid = await page.evaluate(() => {
    const r = window.__game.run;
    return { x: r.player.x, y: r.player.y, shots: r.stats.shots, aim: r.player.aim, device: window.__app.input.device };
  });
  await send('touchEnd', []);
  await page.waitForTimeout(200);
  // Dash-Knopf
  const dash = await page.evaluate(() => {
    const t = window.__app.input.touch;
    t.layoutButtons();
    const b = t.buttons.find((x) => x.id === 'dash');
    return { x: b.x, y: b.y };
  });
  const dashes0 = await page.evaluate(() => window.__game.run.stats.dashes);
  await send('touchStart', [{ x: dash.x, y: dash.y, id: 3 }]);
  await page.waitForTimeout(80);
  await send('touchEnd', []);
  await page.waitForTimeout(200);
  const dashes1 = await page.evaluate(() => window.__game.run.stats.dashes);
  // Pause-Knopf
  const pause = await page.evaluate(() => {
    const b = window.__app.input.touch.buttons.find((x) => x.id === 'pause');
    return { x: b.x, y: b.y };
  });
  await send('touchStart', [{ x: pause.x, y: pause.y, id: 4 }]);
  await send('touchEnd', []);
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => window.__game.state);
  console.log(dev.name, JSON.stringify({ p0, mid, dashes: dashes1 - dashes0, afterPause: st }));
}

// Leistung: viele Gegner, Kugeln und Partikel gleichzeitig; misst die Bildzeit
export async function perf(page, dev, outDir) {
  if (dev.name !== 'pc' && dev.name !== 'ipad_quer') return;
  const shot = shooter(page, dev, outDir);
  await page.evaluate(() => {
    const g = window.__game;
    const r = g.run;
    r.god = true;
    r.noWaves = true;
    const { createEnemy, addEnemy, giveWeapon } = window.__api;
    const types = ['runner', 'sprinter', 'shooter', 'tank', 'splitter', 'shield', 'bomber'];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const e = addEnemy(r, createEnemy(r, types[i % types.length], r.player.x + Math.cos(a) * 420, r.player.y + Math.sin(a) * 300));
      e.hp = e.maxHp = 1e6;
    }
    giveWeapon(r, 'mg');
    r.arsenal.ammo.mg = 1e6;
    r.power.multi = 1e6;
    r.power.rapid = 1e6;
    // gegnerische Kugeln, die herumfliegen (für die 200-Projektile-Marke)
    window.__spray = setInterval(() => {
      for (const e of r.enemies) {
        if (e.type === 'shooter' || e.type === 'tank') {
          window.__api.spawnEnemyProjectile(r, 'orb', e.x, e.y, Math.random() * 6.28, 120, 9, 0, 6, 'Test');
        }
      }
    }, 120);
  });
  await page.mouse.move(dev.width / 2 + 200, dev.height / 2);
  await page.mouse.down();
  // Bildzeiten messen
  const res = await page.evaluate(async () => {
    const times = [];
    let last = performance.now();
    let maxB = 0;
    let maxP = 0;
    await new Promise((resolve) => {
      const f = (now) => {
        times.push(now - last);
        last = now;
        const r = window.__game.run;
        maxB = Math.max(maxB, r.projectiles.player.count + r.projectiles.enemy.count);
        maxP = Math.max(maxP, window.__app.particles.pool.count);
        if (times.length < 300) requestAnimationFrame(f);
        else resolve();
      };
      requestAnimationFrame(f);
    });
    times.sort((a, b) => a - b);
    return {
      median: times[150].toFixed(1), p95: times[285].toFixed(1), enemies: window.__game.run.enemies.length,
      bullets: maxB, particles: maxP, quality: window.__app.perf.level,
      logicMs: window.__app.timing.logic.toFixed(2), drawMs: window.__app.timing.draw.toFixed(2),
    };
  });
  await shot('perf');
  await page.evaluate(() => clearInterval(window.__spray));
  await page.mouse.up();
  console.log(dev.name, 'Bildzeit ms', JSON.stringify(res));
}

// Ausdauer: 20 Minuten Spielzeit im Zeitraffer mit Bot (unverwundbar), danach Pause/Tab-Wechsel/Neuladen
export async function endurance(page, dev, outDir) {
  if (dev.name !== 'pc' && dev.name !== 'iphone_quer') return;
  const shot = shooter(page, dev, outDir);
  const minutes = Number(process.env.MINUTES || 20);
  const info = await page.evaluate(async (minutes) => {
    const g = window.__game;
    const r = g.run;
    r.god = true;
    const { createBot, botActions, setState } = window.__api;
    const bot = createBot(5);
    const orig = g.getActions;
    g.getActions = (gg) => botActions(bot, gg.run, 1 / 60);
    const samples = [];
    for (let m = 0; m < minutes; m++) {
      window.__fastForward(60, 30);
      // Upgrade-Auswahl automatisch schließen
      if (g.state === 'upgrade') {
        document.querySelector('.card')?.click();
        await new Promise((res) => setTimeout(res, 500));
        document.querySelector('.card')?.click();
      }
      if (g.state !== 'playing') setState(g, 'playing');
      samples.push({
        wave: r.waves.number, enemies: r.enemies.length, hazards: r.hazards.length, pickups: r.pickups.length,
        pb: r.projectiles.player.count, eb: r.projectiles.enemy.count, parts: window.__app.particles.pool.count,
        queue: r.waves.queue.length, warn: r.waves.warnings.length, fxq: window.__app.fx.queue.length,
        heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1,
      });
      await new Promise((res) => setTimeout(res, 0));
    }
    g.getActions = orig;
    return samples;
  }, minutes);
  for (const [i, s] of info.entries()) if (i % 4 === 3 || i === info.length - 1) console.log(dev.name, `min ${i + 1}`, JSON.stringify(s));
  await shot('ausdauer');
  // Tab unsichtbar -> Pause, Ton aus
  const vis = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    const st = window.__game.state;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    return st;
  });
  // Einstellungen und Highscore bleiben nach dem Neuladen
  await page.evaluate(() => {
    const a = window.__app;
    a.settings.shake = 'low';
    localStorage.setItem('neonarena_settings', JSON.stringify(a.settings));
  });
  await page.reload();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ shake: window.__app.settings.shake, state: window.__game.state }));
  console.log(dev.name, JSON.stringify({ visibilityPause: vis, afterReload: after }));
}
