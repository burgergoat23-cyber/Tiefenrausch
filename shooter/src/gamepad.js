// Gamepad (Standard-Belegung): linker Stick bewegen, rechter Stick zielen, RT schießen, LT oder A Dash,
// LB/RB Waffe wechseln, Start Pause. In Menüs: Steuerkreuz/Stick bewegen, A bestätigen, B zurück.

const DEAD = 0.2;
const B = { A: 0, B: 1, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

function pressed(pad, i) {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

function axis(v) {
  return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD);
}

export function createGamepad(input) {
  const g = {
    prev: new Array(17).fill(false),
    mx: 0, my: 0, ax: 0, ay: 0, fire: false,
    lastAim: 0,
    repeatT: 0,
    lastDir: '',
  };

  // pro Bild aufrufen. menuKey(code) gibt Menü-Tasten weiter, wenn ein Menü offen ist.
  g.poll = (dt, menuIsOpen, menuKey) => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) {
      // getrennt: letzte Stick- und Abzugswerte nicht weiter anwenden
      g.mx = g.my = g.ax = g.ay = 0;
      g.fire = false;
      g.prev.fill(false);
      g.lastDir = '';
      return;
    }
    const now = pad.buttons.map((_, i) => pressed(pad, i));
    const edge = (i) => now[i] && !g.prev[i];
    g.mx = axis(pad.axes[0] || 0);
    g.my = axis(pad.axes[1] || 0);
    g.ax = axis(pad.axes[2] || 0);
    g.ay = axis(pad.axes[3] || 0);
    g.fire = pad.buttons[B.RT] ? pad.buttons[B.RT].value > 0.3 || pad.buttons[B.RT].pressed : false;
    const any = now.some((v) => v) || Math.abs(g.mx) + Math.abs(g.my) + Math.abs(g.ax) + Math.abs(g.ay) > 0;
    if (any) input.device = 'pad';

    if (menuIsOpen) {
      // Menü: Richtung mit Wiederholung
      let dir = '';
      if (now[B.UP] || g.my < -0.5) dir = 'ArrowUp';
      else if (now[B.DOWN] || g.my > 0.5) dir = 'ArrowDown';
      else if (now[B.LEFT] || g.mx < -0.5) dir = 'ArrowLeft';
      else if (now[B.RIGHT] || g.mx > 0.5) dir = 'ArrowRight';
      if (dir) {
        g.repeatT -= dt;
        if (dir !== g.lastDir) {
          menuKey(dir);
          g.repeatT = 0.38;
        } else if (g.repeatT <= 0) {
          menuKey(dir);
          g.repeatT = 0.12;
        }
      }
      g.lastDir = dir;
      if (edge(B.A)) menuKey('Enter');
      if (edge(B.B) || edge(B.START)) menuKey('Escape');
    } else {
      if (edge(B.A) || edge(B.LT)) input.edges.dash = true;
      if (edge(B.LB)) input.edges.weaponDir = -1;
      if (edge(B.RB)) input.edges.weaponDir = 1;
      if (edge(B.START)) input.uiQueue.push('KeyP');
    }
    g.prev = now;
  };

  g.apply = (a) => {
    if (input.device !== 'pad') return;
    a.moveX = g.mx;
    a.moveY = g.my;
    a.aimMode = 'stick';
    const am = Math.sqrt(g.ax * g.ax + g.ay * g.ay);
    if (am > 0.3) g.lastAim = Math.atan2(g.ay, g.ax);
    else if (Math.abs(g.mx) + Math.abs(g.my) > 0.3) g.lastAim = Math.atan2(g.my, g.mx);
    a.aimAngle = g.lastAim;
    a.aimValid = true;
    a.aimReach = 260 * Math.min(1, am);
    a.fire = g.fire;
    a.assist = true;
  };

  input.pad = g;
  return g;
}
