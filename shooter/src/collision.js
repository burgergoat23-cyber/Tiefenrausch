// Kollisionsfunktionen und räumliches Raster (Spatial Hash). Kein DOM, kein Canvas.

import { clamp } from './utils.js';

// Kreis gegen Kreis
export function circleCircle(ax, ay, ar, bx, by, br) {
  const dx = bx - ax;
  const dy = by - ay;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

// Kreis gegen achsenparalleles Rechteck (x, y = linke obere Ecke)
export function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Schiebt einen Kreis aus einem Rechteck heraus. Schreibt die Normale in out.
// Rückgabe: true, wenn es eine Überlappung gab.
export function pushCircleOutOfRect(e, r, rect, out) {
  const nx = clamp(e.x, rect.x, rect.x + rect.w);
  const ny = clamp(e.y, rect.y, rect.y + rect.h);
  let dx = e.x - nx;
  let dy = e.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    dx /= d;
    dy /= d;
    e.x = nx + dx * r;
    e.y = ny + dy * r;
  } else {
    // Mittelpunkt liegt im Rechteck: entlang der kürzesten Achse hinaus
    const left = e.x - rect.x;
    const right = rect.x + rect.w - e.x;
    const top = e.y - rect.y;
    const bottom = rect.y + rect.h - e.y;
    const m = Math.min(left, right, top, bottom);
    dx = 0;
    dy = 0;
    if (m === left) { e.x = rect.x - r; dx = -1; }
    else if (m === right) { e.x = rect.x + rect.w + r; dx = 1; }
    else if (m === top) { e.y = rect.y - r; dy = -1; }
    else { e.y = rect.y + rect.h + r; dy = 1; }
  }
  if (out) { out.nx = dx; out.ny = dy; }
  return true;
}

// Schiebt einen Kreis aus einem anderen (festen) Kreis heraus
export function pushCircleOutOfCircle(e, r, c, out) {
  let dx = e.x - c.x;
  let dy = e.y - c.y;
  const rr = r + c.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  let d = Math.sqrt(d2);
  if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
  dx /= d;
  dy /= d;
  e.x = c.x + dx * rr;
  e.y = c.y + dy * rr;
  if (out) { out.nx = dx; out.ny = dy; }
  return true;
}

// Strecke (x1,y1)->(x2,y2) gegen Kreis. Rückgabe: Anteil t (0..1) des ersten Kontakts oder -1.
export function segmentCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0; // Start liegt schon im Kreis
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return -1;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

// Strahl (Railgun) gegen Kreis: Ursprung o, Richtung d (normiert), Länge maxLen.
// Rückgabe: Entfernung bis zum Kontakt oder -1.
export function rayCircle(ox, oy, dx, dy, maxLen, cx, cy, r) {
  const t = segmentCircle(ox, oy, ox + dx * maxLen, oy + dy * maxLen, cx, cy, r);
  return t < 0 ? -1 : t * maxLen;
}

// Strecke gegen Rechteck (Slab-Verfahren). Rückgabe: t (0..1) oder -1, Normale in out.
export function segmentRect(x1, y1, x2, y2, rx, ry, rw, rh, out) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  let nx = 0;
  let ny = 0;
  if (Math.abs(dx) < 1e-12) {
    if (x1 < rx || x1 > rx + rw) return -1;
  } else {
    let t1 = (rx - x1) / dx;
    let t2 = (rx + rw - x1) / dx;
    let n = -1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = n; ny = 0; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-12) {
    if (y1 < ry || y1 > ry + rh) return -1;
  } else {
    let t1 = (ry - y1) / dy;
    let t2 = (ry + rh - y1) / dy;
    let n = -1;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = 0; ny = n; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (out) { out.nx = nx; out.ny = ny; }
  return tmin;
}

export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// --- Räumliches Raster ----------------------------------------------------------
// Objekte werden nur über ihren Mittelpunkt eingetragen; Abfragen erweitern den
// Suchbereich um den größten eingetragenen Radius.

export class SpatialHash {
  constructor(width, height, cellSize) {
    this.cell = cellSize;
    this.cols = Math.ceil(width / cellSize) + 1;
    this.rows = Math.ceil(height / cellSize) + 1;
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    this.maxR = 0;
    this.used = [];
  }

  clear() {
    for (let i = 0; i < this.used.length; i++) this.cells[this.used[i]].length = 0;
    this.used.length = 0;
    this.maxR = 0;
  }

  insert(obj) {
    const cx = clamp(Math.floor(obj.x / this.cell), 0, this.cols - 1);
    const cy = clamp(Math.floor(obj.y / this.cell), 0, this.rows - 1);
    const idx = cy * this.cols + cx;
    const list = this.cells[idx];
    if (list.length === 0) this.used.push(idx);
    list.push(obj);
    if (obj.r > this.maxR) this.maxR = obj.r;
  }

  // Füllt out mit Kandidaten im Umkreis r um (x, y). Rückgabe: Anzahl.
  query(x, y, r, out) {
    out.length = 0;
    const m = r + this.maxR;
    const x0 = clamp(Math.floor((x - m) / this.cell), 0, this.cols - 1);
    const x1 = clamp(Math.floor((x + m) / this.cell), 0, this.cols - 1);
    const y0 = clamp(Math.floor((y - m) / this.cell), 0, this.rows - 1);
    const y1 = clamp(Math.floor((y + m) / this.cell), 0, this.rows - 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells[cy * this.cols + cx];
        for (let i = 0; i < list.length; i++) out.push(list[i]);
      }
    }
    return out.length;
  }
}
