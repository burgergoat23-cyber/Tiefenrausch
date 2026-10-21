// Touch-Steuerung: zwei virtuelle Joysticks (links bewegen, rechts zielen + schießen) und Knöpfe.
// Jeder Finger wird über seine pointerId einer Rolle zugeordnet; verlässt er den Bereich, behält er sie.

import { CONFIG } from './config.js';
import { hudScale, weaponSlots } from './hud.js';

const TC = CONFIG.touch;

function stick() {
  return { id: -1, ox: 0, oy: 0, x: 0, y: 0, vx: 0, vy: 0, mag: 0 };
}

export function createTouch(canvas, input, getLayout) {
  const t = {
    move: stick(),
    aim: stick(),
    roles: new Map(),      // pointerId -> Rolle
    buttons: [],           // { id, x, y, r } in CSS-Pixeln
    pressed: new Set(),    // gerade gedrückte Knöpfe (für die Anzeige)
    lastAim: 0,
    active: false,
  };

  const radius = () => Math.min(TC.stickRadius, 60);

  function layoutButtons() {
    const { w, h, safe } = getLayout();
    const u = hudScale(w, h);
    const r = (TC.buttonSize / 2) * Math.min(1.15, Math.max(0.85, u));
    const right = w - safe.right;
    const bottom = h - safe.bottom;
    t.buttons = [
      { id: 'dash', x: right - r - 18, y: bottom - r * 2 - 120 * u, r, label: 'DASH' },
      { id: 'weapon', x: right - r * 3 - 30, y: bottom - r * 2 - 150 * u, r: r * 0.8, label: '⇄' },
      // Pause oben rechts unter Punkten und Kombo
      { id: 'pause', x: right - 14 - 22, y: safe.top + 14 + 92 * u, r: 22, label: 'II' },
    ];
  }
  t.layoutButtons = layoutButtons;

  function hitButton(x, y) {
    for (const b of t.buttons) {
      const dx = x - b.x;
      const dy = y - b.y;
      const rr = Math.max(b.r, 24) + 8; // Trefferfläche mindestens 48 px
      if (dx * dx + dy * dy <= rr * rr) return b.id;
    }
    // Waffenleiste unten antippen
    for (let i = 0; i < weaponSlots.length; i++) {
      const s = weaponSlots[i];
      if (x >= s.x - 4 && x <= s.x + s.w + 4 && y >= s.y - 10 && y <= s.y + s.h + 10) return 'slot' + (i + 1);
    }
    return null;
  }

  function point(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startStick(s, id, x, y) {
    const { w, h } = getLayout();
    const R = radius();
    s.id = id;
    // Stick dort, wo der Daumen aufsetzt (aber ganz auf dem Bildschirm)
    s.ox = Math.min(Math.max(x, R + 6), w - R - 6);
    s.oy = Math.min(Math.max(y, R + 6), h - R - 6);
    s.x = x;
    s.y = y;
    updateStick(s, x, y);
  }

  function updateStick(s, x, y) {
    const R = radius();
    let dx = x - s.ox;
    let dy = y - s.oy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    s.x = s.ox + dx;
    s.y = s.oy + dy;
    const raw = Math.min(1, d / R);
    // Totzone 10 %, danach neu auf 0..1 skaliert
    const mag = raw < TC.deadzone ? 0 : (raw - TC.deadzone) / (1 - TC.deadzone);
    const len = Math.sqrt(dx * dx + dy * dy);
    s.mag = mag;
    s.vx = len > 1e-6 ? (dx / len) * mag : 0;
    s.vy = len > 1e-6 ? (dy / len) * mag : 0;
  }

  function endStick(s) {
    s.id = -1;
    s.vx = 0;
    s.vy = 0;
    s.mag = 0;
  }

  const onDown = (e) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    e.preventDefault();
    input.device = 'touch';
    t.active = true;
    layoutButtons();
    const p = point(e);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
    const btn = hitButton(p.x, p.y);
    if (btn) {
      t.roles.set(e.pointerId, btn);
      t.pressed.add(btn);
      if (btn === 'dash') input.edges.dash = true;
      else if (btn === 'weapon') input.edges.weaponDir = 1;
      else if (btn === 'pause') input.uiQueue.push('KeyP');
      else if (btn.startsWith('slot')) input.edges.weaponSlot = Number(btn.slice(4));
      return;
    }
    const { w } = getLayout();
    if (p.x < w / 2) {
      if (t.move.id !== -1) return;
      t.roles.set(e.pointerId, 'move');
      startStick(t.move, e.pointerId, p.x, p.y);
    } else {
      if (t.aim.id !== -1) return;
      t.roles.set(e.pointerId, 'aim');
      startStick(t.aim, e.pointerId, p.x, p.y);
    }
  };
  const onMove = (e) => {
    const role = t.roles.get(e.pointerId);
    if (!role) return;
    e.preventDefault();
    const p = point(e);
    if (role === 'move') updateStick(t.move, p.x, p.y);
    else if (role === 'aim') updateStick(t.aim, p.x, p.y);
  };
  const onUp = (e) => {
    const role = t.roles.get(e.pointerId);
    if (!role) return;
    t.roles.delete(e.pointerId);
    t.pressed.delete(role);
    if (role === 'move') endStick(t.move);
    else if (role === 'aim') endStick(t.aim);
  };
  canvas.addEventListener('pointerdown', onDown, { passive: false });
  canvas.addEventListener('pointermove', onMove, { passive: false });
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);

  // Alle Finger lösen (Pause, Menü, App-Wechsel)
  t.reset = () => {
    t.roles.clear();
    t.pressed.clear();
    endStick(t.move);
    endStick(t.aim);
  };

  // Aktionen überschreiben, wenn Touch benutzt wird
  t.apply = (a) => {
    if (input.device !== 'touch') return;
    a.moveX = t.move.vx;
    a.moveY = t.move.vy;
    a.aimMode = 'stick';
    if (t.aim.id !== -1 && t.aim.mag > 0) {
      t.lastAim = Math.atan2(t.aim.vy, t.aim.vx);
      a.aimAngle = t.lastAim;
      a.aimValid = true;
      a.aimReach = 260 * t.aim.mag;
      a.fire = t.aim.mag > TC.fireThreshold;
      a.assist = true;
    } else if (t.move.mag > 0.2) {
      // ohne Ziel-Stick schaut die Figur in Laufrichtung
      t.lastAim = Math.atan2(t.move.vy, t.move.vx);
      a.aimAngle = t.lastAim;
      a.aimValid = true;
      a.aimReach = 120;
      a.fire = false;
    } else {
      a.aimAngle = t.lastAim;
      a.aimValid = true;
      a.aimReach = 0;
      a.fire = false;
    }
  };
  input.touch = t;
  return t;
}
