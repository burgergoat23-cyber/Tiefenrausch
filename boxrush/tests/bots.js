const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type()+': '+m.text()); });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file://' + require('path').resolve(__dirname, '../index.html'));
  await p.waitForTimeout(800);
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'menu.png') });
  const mode = process.argv[2] || 'duel', lv = process.argv[3] || 'hard';
  const res = await p.evaluate(([mode, lv]) => {
    const B = window.BOXRUSH;
    B.Game.startMatch({ mode, difficulty: lv, rounds: 3, autoplay: true, autoplayLevel: lv });
    B.Game.state = 'sim';
    const log = []; let t0 = performance.now();
    const stateCount = {}; let maxStill = 0; const still = {};
    for (let i = 0; i < 60 * 60 * 12 && B.Match.phase !== 'matchEnd'; i++) {
      B.Game.step(1 / 60);
      for (const f of B.Match.fighters) {
        if (!f.brain || !f.alive || B.Match.phase !== 'combat') { still[f.id] = 0; continue; }
        stateCount[f.brain.state] = (stateCount[f.brain.state] || 0) + 1;
        const k = f.id; const s = still[k] || { x: f.x, y: f.y, t: 0 };
        if (Math.hypot(f.x - s.x, f.y - s.y) < 2 && f.brain.wantMove) s.t++; else { s.t = 0; s.x = f.x; s.y = f.y; }
        still[k] = s; maxStill = Math.max(maxStill, s.t);
      }
      if (B.Match.phase === 'roundEnd' && B.Match.phaseT < 1/60 + 1e-9) log.push('R' + B.Match.round + ' t=' + B.Match.roundTime.toFixed(1) + ' ' + B.Match.scores.join(':'));
    }
    const P = B.Match.player;
    return { log, scores: B.Match.scores, phase: B.Match.phase, ms: performance.now() - t0, stateCount, maxStillS: maxStill / 60,
      stats: B.Match.fighters.map(f => f.name + ' ' + JSON.stringify(f.stats)) };
  }, [mode, lv]);
  console.log(JSON.stringify(res, null, 1));
  console.log('ERRORS', errs.slice(0, 10));
  await b.close();
})();
