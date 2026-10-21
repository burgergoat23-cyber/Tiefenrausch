// Speichern im localStorage: Einstellungen, Highscores, Gesamtstatistik.
// Fehler (z. B. privater Modus, voller Speicher) werden abgefangen – das Spiel läuft dann ohne Speichern.

import { CONFIG } from './config.js';

const PREFIX = 'neonarena_';

export const DEFAULT_SETTINGS = {
  musicVolume: CONFIG.audio.musicVolume,
  sfxVolume: CONFIG.audio.sfxVolume,
  musicMuted: false,
  sfxMuted: false,
  shake: 'normal',        // off, low, normal
  effects: 'normal',      // low, normal, high
  damageNumbers: true,
  aimAssist: true,
  aimLine: true,
  showFps: false,
  vibration: true,
  colorFx: true,
  lastName: 'AAA',
  rotateHintShown: false,
};

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function load(key, fallback) {
  try {
    const s = storage();
    if (!s) return fallback;
    const raw = s.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    const s = storage();
    if (s) s.removeItem(PREFIX + key);
  } catch { /* egal */ }
}

// --- Einstellungen ---------------------------------------------------------------

export function loadSettings() {
  const stored = load('settings', {});
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (stored && typeof stored[k] === typeof DEFAULT_SETTINGS[k]) out[k] = stored[k];
  }
  return out;
}

export function saveSettings(settings) {
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = settings[k];
  return save('settings', out);
}

// --- Highscores (reine Funktionen + Speichern) -------------------------------------

export function sortHighscores(list) {
  return list.sort((a, b) => b.score - a.score || b.wave - a.wave || a.date - b.date);
}

// Eintrag einsortieren, auf max Einträge begrenzen. Rückgabe: { list, rank } (rank -1 = nicht drin)
export function insertHighscore(list, entry, max = CONFIG.scoring.highscoreCount) {
  const next = sortHighscores([...list, entry]).slice(0, max);
  return { list: next, rank: next.indexOf(entry) };
}

export function qualifies(list, score, max = CONFIG.scoring.highscoreCount) {
  if (score <= 0) return false;
  return list.length < max || score > list[list.length - 1].score;
}

export function cleanName(s) {
  const n = String(s || '').toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g, '').slice(0, 3);
  return n.padEnd(3, 'A');
}

export function loadHighscores() {
  const list = load('highscores', []);
  if (!Array.isArray(list)) return [];
  return sortHighscores(list.filter((e) => e && typeof e.score === 'number')).slice(0, CONFIG.scoring.highscoreCount);
}

export function saveHighscores(list) {
  return save('highscores', list);
}

// --- Gesamtstatistik ---------------------------------------------------------------

export function emptyTotals() {
  return { games: 0, kills: 0, bestWave: 0, bestScore: 0, playTime: 0, bossesKilled: 0 };
}

export function loadTotals() {
  return { ...emptyTotals(), ...load('totals', {}) };
}

// Runde in die Gesamtstatistik einrechnen (rein)
export function addRunToTotals(totals, run) {
  return {
    games: totals.games + 1,
    kills: totals.kills + run.stats.kills,
    bestWave: Math.max(totals.bestWave, run.waves.number),
    bestScore: Math.max(totals.bestScore, run.score.score),
    playTime: totals.playTime + run.stats.time,
    bossesKilled: (totals.bossesKilled || 0) + run.stats.bossesKilled,
  };
}

export function saveTotals(t) {
  return save('totals', t);
}

// Alles löschen (Einstellungen, Highscores, Statistik)
export function resetAll() {
  for (const k of ['settings', 'highscores', 'totals']) remove(k);
}
