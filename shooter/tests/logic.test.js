// Logik-Tests ohne Browser:  node tests/logic.test.js   (oder: npm test)

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/config.js';
import { circleCircle, circleRect, segmentCircle, rayCircle, segmentRect, SpatialHash } from '../src/collision.js';
import { LAYOUTS, createWorld, resolveCircle, raycast } from '../src/world.js';
import { FixedStepper } from '../src/game.js';
import { createRun, stepRun } from '../src/run.js';
import { mulberry32 } from '../src/utils.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

function idleActions(over = {}) {
  return {
    moveX: 0, moveY: 0, aimValid: true, aimAngle: 0, aimReach: 0, aimMode: 'stick',
    fire: false, dash: false, weaponDir: 0, weaponSlot: 0, assist: false, ...over,
  };
}

// --- Kollision ---------------------------------------------------------------------

test('Kreis gegen Kreis', () => {
  assert.equal(circleCircle(0, 0, 10, 15, 0, 6), true);
  assert.equal(circleCircle(0, 0, 10, 16, 0, 6), false);
  assert.equal(circleCircle(0, 0, 10, 0, 0, 1), true);
});

test('Kreis gegen Rechteck', () => {
  assert.equal(circleRect(50, 50, 5, 0, 0, 100, 100), true);   // innen
  assert.equal(circleRect(-4, 50, 5, 0, 0, 100, 100), true);   // berührt links
  assert.equal(circleRect(-6, 50, 5, 0, 0, 100, 100), false);
  assert.equal(circleRect(-3, -3, 5, 0, 0, 100, 100), true);   // Ecke, Abstand 4.24
  assert.equal(circleRect(-4, -4, 5, 0, 0, 100, 100), false);  // Ecke, Abstand 5.66
});

test('Strahl gegen Kreis (Railgun)', () => {
  assert.ok(near(rayCircle(0, 0, 1, 0, 100, 50, 0, 10), 40));
  assert.equal(rayCircle(0, 0, 1, 0, 100, 50, 20, 10), -1);    // daneben
  assert.equal(rayCircle(0, 0, 1, 0, 30, 50, 0, 10), -1);      // zu kurz
  assert.equal(rayCircle(0, 0, -1, 0, 100, 50, 0, 10), -1);    // falsche Richtung
  assert.equal(rayCircle(50, 0, 1, 0, 100, 50, 0, 10), 0);     // startet im Kreis
  assert.ok(near(segmentCircle(0, 0, 100, 0, 50, 5, 10), (50 - Math.sqrt(75)) / 100));
});

test('Strecke gegen Rechteck mit Normale', () => {
  const out = { nx: 0, ny: 0 };
  const t = segmentRect(0, 50, 100, 50, 40, 0, 20, 100, out);
  assert.ok(near(t, 0.4));
  assert.equal(out.nx, -1);
  assert.equal(segmentRect(0, 150, 100, 150, 40, 0, 20, 100, out), -1);
  const t2 = segmentRect(50, 200, 50, 0, 0, 0, 100, 100, out);
  assert.ok(near(t2, 0.5));
  assert.equal(out.ny, 1);
});

test('Räumliches Raster findet Nachbarn', () => {
  const hash = new SpatialHash(1000, 1000, 100);
  const objs = [{ x: 50, y: 50, r: 10 }, { x: 160, y: 50, r: 10 }, { x: 900, y: 900, r: 10 }];
  objs.forEach((o) => hash.insert(o));
  const out = [];
  hash.query(60, 60, 120, out);
  assert.ok(out.includes(objs[0]) && out.includes(objs[1]));
  assert.ok(!out.includes(objs[2]));
  hash.clear();
  hash.query(60, 60, 120, out);
  assert.equal(out.length, 0);
});

// --- Arena -------------------------------------------------------------------------

test('Alle Layouts: 6-10 Hindernisse, Startbereich frei', () => {
  assert.equal(LAYOUTS.length, 4);
  for (let i = 0; i < LAYOUTS.length; i++) {
    const w = createWorld(i);
    assert.ok(w.obstacles.length >= 6 && w.obstacles.length <= 10, `Layout ${i}`);
    for (const o of w.obstacles) {
      const hit = o.shape === 'rect'
        ? circleRect(w.startX, w.startY, CONFIG.arena.safeRadius, o.x, o.y, o.w, o.h)
        : circleCircle(w.startX, w.startY, CONFIG.arena.safeRadius, o.x, o.y, o.r);
      assert.equal(hit, false, `Layout ${i} Hindernis im Startbereich`);
    }
  }
});

test('Kreis wird aus Wand und Hindernis geschoben', () => {
  const w = createWorld(1);
  const e = { x: -50, y: 800 };
  resolveCircle(w, e, 14, null);
  assert.equal(e.x, 14);
  const o = w.obstacles[0];
  const e2 = { x: o.x + 5, y: o.y + o.h / 2 };
  resolveCircle(w, e2, 14, null);
  assert.ok(!circleRect(e2.x, e2.y, 13.9, o.x, o.y, o.w, o.h));
});

test('Raycast stoppt an der Wand', () => {
  const w = createWorld(0);
  const d = raycast(w, 1200, 800, 0, -1, 5000, null);
  assert.ok(d <= 800 + 1e-6);
});

// --- Game Loop ---------------------------------------------------------------------

test('Fester Zeitschritt: 60 Schritte pro Sekunde, unabhängig von der Bildrate', () => {
  for (const hz of [30, 60, 120, 144]) {
    const s = new FixedStepper();
    let steps = 0;
    for (let i = 0; i < hz; i++) s.advance(1 / hz, () => steps++);
    assert.ok(Math.abs(steps - 60) <= 1, `${hz} Hz -> ${steps} Schritte`);
  }
});

test('Ruckler werden auf 0,1 s begrenzt', () => {
  const s = new FixedStepper();
  let steps = 0;
  s.advance(2.0, () => steps++);
  assert.ok(steps <= 7);
});

// --- Spieler -----------------------------------------------------------------------

test('Diagonal nicht schneller als gerade', () => {
  const run1 = createRun({ seed: 1, layout: 0 });
  const run2 = createRun({ seed: 1, layout: 0 });
  for (let i = 0; i < 60; i++) {
    stepRun(run1, 1 / 60, idleActions({ moveX: 1 }));
    stepRun(run2, 1 / 60, idleActions({ moveX: 1, moveY: 1 }));
  }
  const v1 = Math.hypot(run1.player.vx, run1.player.vy);
  const v2 = Math.hypot(run2.player.vx, run2.player.vy);
  assert.ok(near(v1, CONFIG.player.maxSpeed, 1));
  assert.ok(near(v2, CONFIG.player.maxSpeed, 1));
});

test('Reibung stoppt in ca. 0,12 s', () => {
  const run = createRun({ seed: 1, layout: 0 });
  for (let i = 0; i < 40; i++) stepRun(run, 1 / 60, idleActions({ moveX: 1 }));
  let t = 0;
  while (Math.hypot(run.player.vx, run.player.vy) > 0.01 && t < 1) {
    stepRun(run, 1 / 60, idleActions());
    t += 1 / 60;
  }
  assert.ok(t <= 0.14, `stoppt nach ${t.toFixed(3)} s`);
});

test('Dash: ca. 180 Einheiten, Abklingzeit 1,5 s, unverwundbar', () => {
  const run = createRun({ seed: 1, layout: 0 });
  run.player.y = 1500; // freie Bahn am unteren Rand
  run.player.x = 1000;
  const x0 = run.player.x;
  stepRun(run, 1 / 60, idleActions({ moveX: 1, dash: true }));
  let dashing = 0;
  for (let i = 0; i < 30; i++) {
    if (run.player.dashT > 0) dashing++;
    stepRun(run, 1 / 60, idleActions());
  }
  const moved = run.player.x - x0;
  assert.ok(moved > 165 && moved < 230, `Dash-Weg ${moved.toFixed(1)}`);
  assert.ok(dashing >= 7 && dashing <= 10);
  assert.equal(run.player.dashCharges, 0);
  stepRun(run, 1 / 60, idleActions({ dash: true }));
  assert.equal(run.player.dashT, 0, 'kein Dash während der Abklingzeit');
  for (let i = 0; i < 90; i++) stepRun(run, 1 / 60, idleActions());
  assert.equal(run.player.dashCharges, 1);
});

test('Zufall mit Seed ist reproduzierbar', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});
