// Cheats für den Debug-Modus (F3): G = unverwundbar, N = nächste Welle, K = alle töten, B = Boss sofort.

import { killEnemy } from './enemies.js';
import { startWave } from './wave_director.js';
import { CONFIG } from './config.js';

export function killAll(run) {
  for (const e of run.enemies) if (!e.dead) killEnemy(run, e, '');
  run.waves.warnings.length = 0;
  run.waves.queue.length = 0;
}

export function nextWave(run) {
  killAll(run);
  if (run.waves.plan) run.waves.groupIdx = run.waves.plan.groups.length;
  startWave(run, run.waves.number + 1);
}

// Springt zur nächsten Bosswelle
export function bossNow(run) {
  killAll(run);
  const every = CONFIG.waves.bossEvery;
  const n = Math.ceil((run.waves.number + 1) / every) * every;
  startWave(run, n);
}
