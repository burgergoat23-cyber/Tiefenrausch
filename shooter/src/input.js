// Eingabe: Tastatur und Maus; Touch und Gamepad hängen sich über touch.js und gamepad.js an.
// Liefert pro Logikschritt ein Aktionen-Objekt. Kurze Tastendrücke gehen nicht verloren:
// Einmal-Aktionen (Dash, Waffenwechsel) bleiben stehen, bis ein Logikschritt sie verbraucht hat.

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

// Tasten, die nur das Spiel betreffen (Standardverhalten des Browsers unterdrücken)
const GAME_KEYS = new Set([...Object.keys(MOVE_KEYS), 'Space', 'F3', 'Tab']);

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    device: 'mouse',        // zuletzt benutzt: 'mouse', 'touch' oder 'pad'
    mouseX: 0, mouseY: 0,   // CSS-Pixel relativ zum Canvas
    mouseInside: false,
    mouseLeft: false,
    mouseRight: false,
    // Einmal-Aktionen
    edges: { dash: false, weaponDir: 0, weaponSlot: 0 },
    // UI-Ereignisse (pro Bild abgeholt)
    uiQueue: [],
    touch: null,            // wird von touch.js gesetzt
    pad: null,              // wird von gamepad.js gesetzt
    actions: {
      moveX: 0, moveY: 0,
      aimValid: false, aimAngle: 0, aimReach: 0,
      aimMode: 'mouse', aimScreenX: 0, aimScreenY: 0,
      fire: false, dash: false, weaponDir: 0, weaponSlot: 0, assist: false,
    },
    keys,
    enabled: true,          // im Menü wird Spiel-Eingabe ignoriert
  };

  const onKeyDown = (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    input.device = 'mouse';
    if (GAME_KEYS.has(e.code) && input.enabled) e.preventDefault();
    if (e.code === 'F3') e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') input.edges.dash = true;
    if (e.code >= 'Digit1' && e.code <= 'Digit5') input.edges.weaponSlot = Number(e.code.slice(5));
    if (e.code === 'KeyQ') input.edges.weaponDir = -1;
    if (e.code === 'KeyE') input.edges.weaponDir = 1;
    input.uiQueue.push(e.code);
  };
  const onKeyUp = (e) => {
    keys.delete(e.code);
  };
  const updateMouse = (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  };
  const onMouseMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    input.device = 'mouse';
    input.mouseInside = true;
    updateMouse(e);
  };
  const onMouseDown = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    input.device = 'mouse';
    updateMouse(e);
    if (e.button === 0) input.mouseLeft = true;
    if (e.button === 2) {
      input.mouseRight = true;
      input.edges.dash = true;
    }
  };
  const onMouseUp = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (e.button === 0) input.mouseLeft = false;
    if (e.button === 2) input.mouseRight = false;
  };
  const onWheel = (e) => {
    if (!input.enabled) return;
    e.preventDefault();
    input.edges.weaponDir = e.deltaY > 0 ? 1 : -1;
  };
  const onBlur = () => {
    keys.clear();
    input.mouseLeft = false;
    input.mouseRight = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onMouseMove);
  canvas.addEventListener('pointerdown', onMouseDown);
  window.addEventListener('pointerup', onMouseUp);
  canvas.addEventListener('pointerleave', () => { input.mouseInside = false; });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', onBlur);

  input.releaseAll = onBlur;
  return input;
}

// Aktionen für den nächsten Logikschritt zusammenstellen
export function pollActions(input) {
  const a = input.actions;
  const keys = input.keys;
  let mx = 0;
  let my = 0;
  for (const code in MOVE_KEYS) {
    if (keys.has(code)) {
      mx += MOVE_KEYS[code][0];
      my += MOVE_KEYS[code][1];
    }
  }
  a.moveX = mx;
  a.moveY = my;
  a.fire = input.mouseLeft;
  a.dash = input.edges.dash;
  a.weaponDir = input.edges.weaponDir;
  a.weaponSlot = input.edges.weaponSlot;
  a.aimMode = 'mouse';
  a.assist = false;
  a.aimValid = input.mouseInside || input.device === 'mouse';
  a.aimScreenX = input.mouseX;
  a.aimScreenY = input.mouseY;

  // Touch und Gamepad überschreiben, wenn sie aktiv sind
  if (input.touch) input.touch.apply(a);
  if (input.pad) input.pad.apply(a);

  if (!input.enabled) {
    a.moveX = 0;
    a.moveY = 0;
    a.fire = false;
    a.dash = false;
    a.weaponDir = 0;
    a.weaponSlot = 0;
  }
  return a;
}

// Nach einem Logikschritt: Einmal-Aktionen sind verbraucht
export function consumeEdges(input) {
  input.edges.dash = false;
  input.edges.weaponDir = 0;
  input.edges.weaponSlot = 0;
}

// UI-Tasten des Bildes abholen
export function takeUiKeys(input) {
  const q = input.uiQueue.slice();
  input.uiQueue.length = 0;
  return q;
}

