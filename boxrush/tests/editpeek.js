const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '../index.html'));
  await p.click('button[data-act=training]'); await p.waitForTimeout(200);
  await p.click('button[data-act=starttraining]'); await p.waitForTimeout(600);
  // Zielwand: rechte Boxwand (V) neben dem Spieler, mittleres Feld
  const info = await p.evaluate(() => {
    const B = window.BOXRUSH, P = B.Match.player, T = 96;
    const b = P.homeBox; const w = B.WallSystem.get('V', b.x + 2, b.y);   // obere rechte Wand
    // Spieler an die Kachel neben die Wand stellen
    P.x = P.px = (b.x + 1.5) * T; P.y = P.py = (b.y + 0.5) * T;
    window.__log = []; const st = { open: null, shot: null, closed: null };
    const orig = B.Game.step.bind(B.Game);
    B.Game.step = (dt) => { orig(dt); const t = B.Match.time;
      if (st.open === null && !w.segments[1]) st.open = t;
      if (st.open !== null && st.shot === null && P.stats.shots > 0) st.shot = t;
      if (st.shot !== null && st.closed === null && w.segments[1]) st.closed = t; };
    window.__st = st;
    return { wx: w.cx, wy: w.cy + 0 };
  });
  await p.waitForTimeout(300);
  const scr = await p.evaluate(({ wx, wy }) => window.BOXRUSH.Renderer.worldToScreen(wx, wy), info);
  await p.mouse.move(scr.x, scr.y); await p.waitForTimeout(400);
  const scr2 = await p.evaluate(({ wx, wy }) => window.BOXRUSH.Renderer.worldToScreen(wx, wy), info);
  await p.mouse.move(scr2.x, scr2.y); await p.waitForTimeout(100);
  const t0 = await p.evaluate(() => window.BOXRUSH.Match.time);
  await p.keyboard.down('KeyF'); await p.waitForTimeout(20);
  await p.mouse.down(); await p.waitForTimeout(17); await p.mouse.up();
  await p.keyboard.up('KeyF');
  await p.waitForTimeout(85);           // 0,09 s nach Bestätigen: Waffe muss bereit sein
  await p.mouse.down(); await p.waitForTimeout(30); await p.mouse.up();
  await p.waitForTimeout(17);
  await p.keyboard.down('KeyF'); await p.waitForTimeout(17); await p.keyboard.up('KeyF');
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => window.__st);
  console.log('Start', t0.toFixed(3), JSON.stringify(st));
  if (st.open && st.shot && st.closed) console.log('Edit->offen', (st.open - t0).toFixed(3), 's  Schuss', (st.shot - t0).toFixed(3), 's  wieder zu', (st.closed - t0).toFixed(3), 's');
  await p.screenshot({ path: require('path').join(require('os').tmpdir(), 'train.png') });
  console.log('ERR', errs);
  await b.close();
})();
