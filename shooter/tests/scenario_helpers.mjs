// Hilfen für die Browser-Abläufe

import path from 'node:path';

export function shooter(page, dev, outDir) {
  return (n) => page.screenshot({ path: path.join(outDir, `${dev.name}_${n}.png`) });
}

// Bildschirmposition des nächsten Gegners (oder null)
export async function nearestEnemy(page) {
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
