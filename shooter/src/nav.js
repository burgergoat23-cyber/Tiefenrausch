// Wegfeld: Breitensuche vom Feld des Spielers aus über ein grobes Raster. Gegner ohne Sichtlinie
// folgen dem Feld und finden so um lange Blöcke und in L-Ecken herum. Reine Logik.

import { obstacleAt } from './world.js';

const CELL = 40;
const REFRESH = 0.25;           // höchstens so oft neu rechnen (oder wenn der Spieler das Feld wechselt)
const CLEAR_SMALL = 18;         // Freiraum für normale Gegner
const CLEAR_LARGE = 34;         // Freiraum für große Gegner (Panzer)
export const LARGE_RADIUS = 24;

function makeField(world, clearance, cols, rows) {
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      blocked[r * cols + c] = obstacleAt(world, (c + 0.5) * CELL, (r + 0.5) * CELL, clearance) ? 1 : 0;
    }
  }
  return { blocked, dist: new Int32Array(cols * rows) };
}

export function createNav(world) {
  const cols = Math.ceil(world.width / CELL);
  const rows = Math.ceil(world.height / CELL);
  return {
    cols,
    rows,
    small: makeField(world, CLEAR_SMALL, cols, rows),
    large: makeField(world, CLEAR_LARGE, cols, rows),
    queue: new Int32Array(cols * rows),
    cell: -1,
    t: -Infinity,
  };
}

function cellOf(nav, x, y) {
  const c = Math.min(nav.cols - 1, Math.max(0, Math.floor(x / CELL)));
  const r = Math.min(nav.rows - 1, Math.max(0, Math.floor(y / CELL)));
  return r * nav.cols + c;
}

// Breitensuche mit 8 Nachbarn, ohne Ecken zu schneiden
function flood(nav, field, start) {
  const { cols, rows, queue } = nav;
  const { blocked, dist } = field;
  dist.fill(-1);
  let head = 0;
  let tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++];
    const c = i % cols;
    const r = (i / cols) | 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (blocked[j] || dist[j] >= 0) continue;
        if (dr && dc && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
        dist[j] = dist[i] + 1;
        queue[tail++] = j;
      }
    }
  }
}

// Pro Logikschritt: Feld neu rechnen, wenn nötig
export function updateNav(run) {
  const nav = run.nav;
  const cell = cellOf(nav, run.player.x, run.player.y);
  if (cell === nav.cell && run.time - nav.t < REFRESH) return;
  nav.cell = cell;
  nav.t = run.time;
  flood(nav, nav.small, cell);
  flood(nav, nav.large, cell);
}

// Richtung zur Nachbarzelle, die dem Spieler am nächsten ist. Rückgabe: false, wenn kein Weg bekannt.
export function flowDir(run, e, out) {
  const nav = run.nav;
  const field = e.r > LARGE_RADIUS ? nav.large : nav.small;
  const c = Math.floor(e.x / CELL);
  const r = Math.floor(e.y / CELL);
  let best = Infinity;
  let bx = 0;
  let by = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= nav.cols || nr >= nav.rows) continue;
      const d = field.dist[nr * nav.cols + nc];
      if (d < 0 || d >= best) continue;
      best = d;
      bx = (nc + 0.5) * CELL - e.x;
      by = (nr + 0.5) * CELL - e.y;
    }
  }
  if (best === Infinity) return false;
  const l = Math.sqrt(bx * bx + by * by) || 1;
  out.x = bx / l;
  out.y = by / l;
  return true;
}
