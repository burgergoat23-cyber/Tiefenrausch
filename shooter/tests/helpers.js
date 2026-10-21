// Gemeinsame Hilfen für die Logik-Tests.

import { createRun } from '../src/run.js';

export const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

export function idleActions(over = {}) {
  return {
    moveX: 0, moveY: 0, aimValid: true, aimAngle: 0, aimReach: 0, aimMode: 'stick',
    fire: false, dash: false, weaponDir: 0, weaponSlot: 0, assist: false, ...over,
  };
}

// Runde ohne Wellen (für gezielte Tests)
export function quietRun(seed = 7, layout = 0) {
  return createRun({ seed, layout, noWaves: true });
}
