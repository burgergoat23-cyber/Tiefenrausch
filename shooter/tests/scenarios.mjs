// Abläufe für tests/browser_check.mjs (je Gerät aufgerufen)

import path from 'node:path';

function shooter(page, dev, outDir) {
  return (n) => page.screenshot({ path: path.join(outDir, `${dev.name}_${n}.png`) });
}

// Bildschirmposition des nächsten Gegners (oder null)
async function nearestEnemy(page) {
  return page.evaluate(() => {
    const g = window.__game;
    const run = g.run;
    if (!run) return null;
    const p = run.player;
    let best = null;
    let bd = Infinity;
    for (const e of run.enemies) {
      if (e.dead) continue;
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return null;
    const c = g.cam;
    return { x: (best.x - c.x) * c.zoom + c.screenW / 2, y: (best.y - c.y) * c.zoom + c.screenH / 2 };
  });
}

export async function basic(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  await page.mouse.move(dev.width * 0.7, dev.height * 0.4);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(60);
  await shot('dash');
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  await shot('stand');
}

// Kämpfen: auf den nächsten Gegner zielen und feuern, dabei hin und her laufen
export async function combat(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  const secs = Number(process.env.SECS || 8);
  await page.mouse.move(dev.width / 2 + 100, dev.height / 2);
  await page.mouse.down();
  const keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
  for (let i = 0; i < secs * 10; i++) {
    const t = await nearestEnemy(page);
    if (t) await page.mouse.move(t.x, t.y);
    if (i % 15 === 0) {
      for (const k of keys) await page.keyboard.up(k);
      await page.keyboard.down(keys[(i / 15) % 4]);
    }
    if (i % 23 === 0) await page.keyboard.press('Space');
    if (i === Math.floor(secs * 5)) await shot('kampf1');
    await page.waitForTimeout(100);
  }
  await shot('kampf2');
  await page.mouse.up();
  for (const k of keys) await page.keyboard.up(k);
  const info = await page.evaluate(() => {
    const r = window.__game.run;
    return { state: window.__game.state, kills: r.stats.kills, hp: r.player.hp, shots: r.stats.shots, score: r.score.score };
  });
  console.log(dev.name, JSON.stringify(info));
}

// Sterben: Leben auf 1, Gegner direkt daneben
export async function death(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  await page.evaluate(() => {
    const r = window.__game.run;
    r.player.hp = 1;
  });
  for (let i = 0; i < 80; i++) {
    const st = await page.evaluate(() => window.__game.state);
    if (st === 'dying') { await page.waitForTimeout(150); await shot('sterben'); }
    if (st === 'gameover') break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  await shot('gameover');
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  console.log(dev.name, await page.evaluate(() => window.__game.state));
}

// Alle Gegnertypen um den Spieler (unverwundbar), Bilder machen
export async function zoo(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  await page.evaluate(() => {
    const g = window.__game;
    const { createEnemy, addEnemy } = window.__api;
    const run = g.run;
    run.god = true;
    run.noWaves = true;
    const p = run.player;
    const types = ['runner', 'sprinter', 'shooter', 'bomber', 'tank', 'splitter', 'mini', 'shield', 'egg'];
    types.forEach((t, i) => {
      const a = (i / types.length) * Math.PI * 2;
      addEnemy(run, createEnemy(run, t, p.x + Math.cos(a) * 260, p.y + Math.sin(a) * 200));
    });
  });
  await page.waitForTimeout(300);
  await shot('zoo1');
  await page.waitForTimeout(1500);
  await shot('zoo2');
  await page.mouse.move(dev.width / 2 + 200, dev.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2500);
  await shot('zoo3');
  await page.mouse.up();
}

// Bestimmte Welle starten (WAVE=8), unverwundbar, Bilder nach ein paar Sekunden
export async function wave(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  const n = Number(process.env.WAVE || 8);
  const info = await page.evaluate((n) => {
    const g = window.__game;
    g.run.god = true;
    window.__api.startWave(g.run, n);
    return { special: g.run.waves.special, boss: !!g.run.waves.boss };
  }, n);
  console.log(dev.name, 'Welle', n, JSON.stringify(info));
  await page.waitForTimeout(1000);
  await shot(`w${n}_a`);
  await page.waitForTimeout(3500);
  await shot(`w${n}_b`);
  await page.waitForTimeout(3000);
  await shot(`w${n}_c`);
}

// Beliebigen Code im Spiel ausführen (EVAL), dann WAIT ms warten und ein Bild machen
export async function evalShot(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  const res = await page.evaluate(process.env.EVAL || '0');
  if (res !== undefined) console.log(dev.name, JSON.stringify(res));
  await page.waitForTimeout(Number(process.env.WAIT || 2000));
  await shot(process.env.NAME || 'eval');
}

// Alle Drops um den Spieler, danach jede Waffe kurz abfeuern
export async function arsenal(page, dev, outDir) {
  const shot = shooter(page, dev, outDir);
  await page.evaluate(() => {
    const g = window.__game;
    const { spawnPickup, createEnemy, addEnemy } = window.__api;
    const run = g.run;
    run.god = true;
    run.noWaves = true;
    const p = run.player;
    const ids = [['heal', 'heal'], ['power', 'shield'], ['power', 'rapid'], ['power', 'multi'], ['power', 'slow'],
      ['power', 'magnet'], ['weapon', 'shotgun'], ['weapon', 'mg'], ['weapon', 'rocket'], ['weapon', 'rail']];
    ids.forEach(([k, id], i) => {
      const a = (i / ids.length) * Math.PI * 2;
      const pk = spawnPickup(run, k, id, p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 160);
      pk.vx = pk.vy = 0;
    });
    for (let i = 0; i < 6; i++) {
      const e = addEnemy(run, createEnemy(run, 'tank', p.x + 380 + (i % 2) * 70, p.y - 150 + i * 60));
      e.speed = 0; e.hp = e.maxHp = 5000;
    }
  });
  await page.waitForTimeout(400);
  await shot('drops');
  await page.mouse.move(dev.width / 2 + 250, dev.height / 2);
  for (const w of ['shotgun', 'mg', 'rocket', 'rail']) {
    await page.evaluate((w) => { const r = window.__game.run; window.__api.giveWeapon(r, w); r.arsenal.ammo[w] = 99; }, w);
    await page.mouse.down();
    await page.waitForTimeout(w === 'rail' ? 650 : 450);
    await shot('waffe_' + w);
    await page.waitForTimeout(400);
    await page.mouse.up();
  }
}

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
