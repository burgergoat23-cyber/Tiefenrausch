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
