const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../index.html'));
  const r = await p.evaluate(() => {
    const B = window.BOXRUSH, T = 96, out = [];
    const ok = (name, cond) => out.push((cond ? 'OK   ' : 'FAIL ') + name);
    B.Game.startMatch({ mode: 'duel', difficulty: 'easy', rounds: 3 }); B.Game.state = 'sim';
    const M = B.Match, P = M.player, E = M.fighters[1], W = B.WallSystem;
    E.brain.passive = true; M.phase = 'combat';
    for (const w of [...W.list]) if (!W.isBorder(w.orient, w.gx, w.gy)) W.remove(w);
    const tx = 5, ty = 5;
    const w = W.add('V', tx + 1, ty, { ownerId: P.id, team: P.team, instant: true });
    P.x = (tx + 0.5) * T; P.y = (ty + 0.5) * T; E.x = 15 * T; E.y = 15 * T;
    const settle = () => { for (let i = 0; i < 8; i++) W.update(1 / 60); };
    const shape = (open) => {
      // Reset auf voll
      W.setSegments(w, [true, true, true]);
      P.pointerX = w.cx; P.pointerY = w.cy; P.mode = 'weapon';
      if (!startEdit(P)) return 'kein Start';
      for (let i = 0; i < 3; i++) if (open[i]) setSel(P, w, i, true);
      confirmEdit(P); settle();
      return w.segments.map(s => s ? 'zu' : 'offen').join('/');
    };
    const forms = [[0,0,0],[1,0,0],[0,0,1],[0,1,0],[1,1,0],[0,1,1],[1,0,1]];
    for (const f of forms) { const res = shape(f); const exp = f.map(x => x ? 'offen' : 'zu').join('/'); ok('Form ' + exp, res === exp); }
    // alle drei offen → unmöglich
    const r3 = shape([1,1,1]); ok('alle 3 offen unmöglich (Ergebnis ' + r3 + ')', r3 !== 'offen/offen/offen');
    // Kugeln und Sicht durch offenes Feld, nicht durch geschlossenes
    shape([0,1,0]);
    const mid = W.segCenter(w, 1), top = W.segCenter(w, 0);
    const ray = (y) => Physics.raycastWalls(w.x0 - 50, y, 1, 0, 100);
    ok('Kugel/Sicht durch offenes Feld', !ray(mid.y));
    ok('Kugel/Sicht blockiert von geschlossenem Feld', !!ray(top.y));
    // Kämpfer passt durch ein einzelnes offenes Feld
    P.x = w.x0 - 40; P.y = mid.y + 3; P.vx = 0; P.vy = 0;
    let passed = false;
    for (let i = 0; i < 90; i++) { P.vx = 260; P.vy = 0; Physics.moveFighter(P, 1 / 60); if (P.x > w.x0 + 30) { passed = true; break; } }
    ok('Kämpfer passt durch ein offenes Feld (mit Ecken-Hilfe, 3 Einheiten daneben)', passed);
    // nicht durch geschlossenes Feld
    P.x = w.x0 - 40; P.y = top.y; let blocked = true;
    for (let i = 0; i < 90; i++) { P.vx = 260; P.vy = 0; Physics.moveFighter(P, 1 / 60); if (P.x > w.x0) blocked = false; }
    ok('Kämpfer blockiert von geschlossenem Feld', blocked);
    // Reset schließt kein Feld, in dem ein Kämpfer steht
    P.x = w.x0; P.y = mid.y;
    startReset(w, P); settle();
    ok('Reset lässt besetztes Feld offen', w.segments[1] === false && w.segments[0] && w.segments[2]);
    P.x = (tx + 0.5) * T; P.y = (ty + 0.5) * T;
    startReset(w, P); settle();
    ok('Reset schließt danach', w.segments.every(Boolean));
    // Gegnerische Wand nicht editierbar
    for (const x of [...W.list]) if (!W.isBorder(x.orient, x.gx, x.gy)) W.remove(x);
    const we = W.add('V', tx + 1, ty, { ownerId: E.id, team: E.team, instant: true });
    P.pointerX = we.cx; P.pointerY = we.cy; P.mode = 'weapon';
    ok('Gegnerische Wand nicht editierbar', !startEdit(P) && P.mode !== 'edit');
    // Wand hinter der Wand vor dir ist nicht editierbar
    for (const x of [...W.list]) if (!W.isBorder(x.orient, x.gx, x.gy)) W.remove(x);
    const front = W.add('V', tx + 1, ty, { ownerId: P.id, team: P.team, instant: true });
    const back = W.add('V', tx + 2, ty, { ownerId: P.id, team: P.team, instant: true });
    P.x = (tx + 0.5) * T; P.y = (ty + 0.5) * T; P.mode = 'weapon';
    P.pointerX = back.cx; P.pointerY = back.cy;
    startEdit(P);
    ok('Nur die Wand direkt vor dir wird bearbeitet (nicht die dahinter)', P.edit && P.edit.wall === front);
    endEdit(P);
    W.setSegments(front, [true, false, true]);
    P.pointerX = back.cx; P.pointerY = back.cy;
    startEdit(P);
    ok('Auch durch ein offenes Feld nicht die Wand dahinter', P.edit && P.edit.wall === front);
    endEdit(P);
    // Randwand nicht editierbar
    P.x = 0.5 * T; P.y = 5.5 * T; P.pointerX = 0; P.pointerY = 5.5 * T;
    ok('Randwand nicht editierbar', !startEdit(P));
    // Bauen: belegte Kante rot, blockiert durch Kämpfer rot
    P.x = (tx + 0.5) * T; P.y = (ty + 0.5) * T;
    const t1 = buildTarget(P, we.cx, we.cy); ok('Belegte Kante ungültig (' + t1.reason + ')', !t1.valid);
    const t2 = buildTarget(P, P.x, P.y - T * 0.5); ok('Freie Kante gültig', t2.valid);
    const t3 = buildTarget(P, P.x + T * 0.5 - 1, P.y + 0.5 * T); // Kante unter dem Spieler? -> eigene Kachel unten
    E.x = (tx + 0.5) * T; E.y = (ty) * T + 2;  // Gegner steht auf der oberen Kante
    const t4 = buildTarget(P, P.x, P.y - T * 0.5); ok('Kante mit Kämpfer darauf ungültig (' + t4.reason + ')', !t4.valid);
    // Wand-HP-Aufbau
    E.x = 15 * T; E.y = 15 * T;
    const nw = placeWall(P, 'H', tx, ty); const hp0 = nw.hp; for (let i = 0; i < 40; i++) W.update(1 / 60);
    ok('Aufbau 10 % → 150 HP in 0,6 s (' + Math.round(hp0) + ' → ' + Math.round(nw.hp) + ')', Math.round(hp0) === 15 && Math.round(nw.hp) === 150);
    // Zerstörte Wand beendet Edit sofort
    P.pointerX = nw.cx; P.pointerY = nw.cy; P.mode = 'weapon';
    startEdit(P); breakWall(nw, E); updateFighter(P, P.intent, 1/60);
    ok('Edit endet bei Wandbruch ohne Fehler', P.mode === 'weapon' && !P.edit);
    return out;
  });
  console.log(r.join('\n')); console.log('ERR', errs);
  await b.close();
})();
