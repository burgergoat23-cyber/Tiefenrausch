// Menüseiten außerhalb des Spiels: Start, Steuerung, Einstellungen, Highscores.

import { CONFIG } from './config.js';
import { el, button } from './menus.js';
import { formatScore, formatTime } from './utils.js';

export function isTouchDevice() {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}

function fullscreenButton() {
  const d = document;
  const can = d.fullscreenEnabled || d.webkitFullscreenEnabled;
  if (!can) return null;
  const b = button('⛶ Vollbild', () => {
    const fs = d.fullscreenElement || d.webkitFullscreenElement;
    if (fs) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else {
      const root = d.documentElement;
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (req) req.call(root).catch?.(() => {});
    }
  }, 'small corner');
  return b;
}

// Startbildschirm. actions = { play, controls, settings, highscores }, info = { bestScore, bestWave }
export function startPage(actions, info) {
  return {
    name: 'start',
    cls: 'start-screen',
    focus: '.primary',
    build(wrap) {
      const title = el('h1', 'game-title');
      for (const [i, ch] of [...CONFIG.title].entries()) {
        const s = el('span', ch === ' ' ? 'gap' : '', ch === ' ' ? ' ' : ch);
        s.style.animationDelay = `${i * 0.07}s`;
        title.appendChild(s);
      }
      wrap.appendChild(title);
      if (info.bestScore > 0) {
        wrap.appendChild(el('p', 'best', `Bester Score ${formatScore(info.bestScore)} · Beste Welle ${info.bestWave}`));
      }
      const col = el('div', 'menu-col');
      col.appendChild(button('SPIELEN', actions.play, 'primary big'));
      col.appendChild(button('Steuerung', actions.controls));
      col.appendChild(button('Einstellungen', actions.settings));
      col.appendChild(button('Highscores', actions.highscores));
      wrap.appendChild(col);
      wrap.appendChild(el('p', 'hint', isTouchDevice()
        ? 'Linker Daumen bewegen · rechter Daumen zielen und schießen'
        : 'WASD bewegen · Maus zielen · Klick schießen · Leertaste Dash'));
      const fs = fullscreenButton();
      if (fs) wrap.appendChild(fs);
      return wrap;
    },
  };
}

const CONTROLS_PC = [
  ['Bewegen', 'WASD oder Pfeiltasten'],
  ['Zielen', 'Maus'],
  ['Schießen', 'linke Maustaste (halten = Dauerfeuer)'],
  ['Dash', 'Leertaste oder rechte Maustaste'],
  ['Waffe wechseln', 'Mausrad, 1 bis 5, Q/E'],
  ['Pause', 'P oder Esc'],
  ['Musik stumm', 'M'],
  ['Debug', 'F3'],
];
const CONTROLS_TOUCH = [
  ['Bewegen', 'linke Bildschirmhälfte: Daumen-Stick'],
  ['Zielen + Schießen', 'rechte Hälfte: Stick, schießt ab 30 % Auslenkung'],
  ['Dash', 'Knopf rechts über dem Ziel-Stick'],
  ['Waffe wechseln', 'Knopf über dem Dash oder Waffenleiste antippen'],
  ['Pause', 'Knopf oben'],
];
const CONTROLS_PAD = [
  ['Bewegen / Zielen', 'linker / rechter Stick'],
  ['Schießen', 'RT'],
  ['Dash', 'LT oder A'],
  ['Waffe wechseln', 'LB / RB'],
  ['Pause', 'Start'],
];

function table(rows) {
  const t = el('table', 'keys');
  for (const [a, b] of rows) {
    const tr = el('tr');
    tr.appendChild(el('th', '', a));
    tr.appendChild(el('td', '', b));
    t.appendChild(tr);
  }
  return t;
}

export function controlsPage(onBack) {
  return {
    name: 'controls',
    onBack,
    build(wrap) {
      wrap.appendChild(el('h2', 'title-sm', 'STEUERUNG'));
      const box = el('div', 'panel');
      const touchFirst = isTouchDevice();
      const blocks = [['Tastatur und Maus', CONTROLS_PC], ['Touch (Handy, Tablet)', CONTROLS_TOUCH], ['Gamepad', CONTROLS_PAD]];
      if (touchFirst) blocks.unshift(blocks.splice(1, 1)[0]);
      for (const [h, rows] of blocks) {
        box.appendChild(el('h3', '', h));
        box.appendChild(table(rows));
      }
      box.appendChild(el('p', 'hint', 'Tipp: Der Dash macht kurz unverwundbar – damit springst du auch über Schockwellen.'));
      wrap.appendChild(box);
      wrap.appendChild(button('Zurück', onBack, 'primary'));
      return wrap;
    },
  };
}

const SHAKE = [['off', 'Aus'], ['low', 'Wenig'], ['normal', 'Normal']];
const EFFECTS = [['low', 'Wenig'], ['normal', 'Normal'], ['high', 'Viel']];

// Einstellungen. onChange(settings) speichert und wendet an; onReset löscht alles.
export function settingsPage(settings, onChange, onReset, onBack) {
  return {
    name: 'settings',
    onBack,
    build(wrap) {
      wrap.appendChild(el('h2', 'title-sm', 'EINSTELLUNGEN'));
      const box = el('div', 'panel settings');
      const row = (label, control) => {
        const r = el('div', 'row');
        r.appendChild(el('span', 'label', label));
        r.appendChild(control);
        box.appendChild(r);
      };
      const slider = (key) => {
        const s = el('input', 'slider');
        s.type = 'range';
        s.min = '0';
        s.max = '100';
        s.step = '5';
        s.value = String(Math.round(settings[key] * 100));
        s.dataset.nav = '1';
        s.addEventListener('input', () => {
          settings[key] = Number(s.value) / 100;
          // Regler bewegen hebt die Stummschaltung (Taste M) auf
          if (key === 'musicVolume') settings.musicMuted = false;
          if (key === 'sfxVolume') settings.sfxMuted = false;
          onChange(settings);
        });
        return s;
      };
      const toggle = (key) => {
        const b = button(settings[key] ? 'An' : 'Aus', () => {
          settings[key] = !settings[key];
          b.textContent = settings[key] ? 'An' : 'Aus';
          b.classList.toggle('on', settings[key]);
          onChange(settings);
        }, 'toggle' + (settings[key] ? ' on' : ''));
        return b;
      };
      const cycle = (key, options) => {
        const label = () => options.find((o) => o[0] === settings[key])?.[1] || options[0][1];
        const b = button(label(), () => {
          const i = options.findIndex((o) => o[0] === settings[key]);
          settings[key] = options[(i + 1) % options.length][0];
          b.textContent = label();
          onChange(settings);
        }, 'toggle on');
        return b;
      };
      row('Musik', slider('musicVolume'));
      row('Effekte', slider('sfxVolume'));
      row('Screenshake', cycle('shake', SHAKE));
      row('Effekt-Menge', cycle('effects', EFFECTS));
      row('Schadenszahlen', toggle('damageNumbers'));
      row('Zielhilfe (Touch/Gamepad)', toggle('aimAssist'));
      row('Ziellinie', toggle('aimLine'));
      row('Farbeffekte bei Treffern', toggle('colorFx'));
      row('Vibration', toggle('vibration'));
      row('FPS-Anzeige', toggle('showFps'));
      // Alles zurücksetzen mit Bestätigung
      const resetRow = el('div', 'row');
      const resetBtn = button('Alles zurücksetzen', () => {
        resetBtn.hidden = true;
        confirmBox.hidden = false;
        confirmBox.querySelector('.danger').focus();
      }, 'danger');
      const confirmBox = el('div', 'confirm');
      confirmBox.hidden = true;
      confirmBox.appendChild(el('span', 'label', 'Einstellungen, Highscores und Statistik löschen?'));
      confirmBox.appendChild(button('Ja, löschen', () => onReset(), 'danger'));
      confirmBox.appendChild(button('Nein', () => {
        confirmBox.hidden = true;
        resetBtn.hidden = false;
        resetBtn.focus();
      }));
      resetRow.appendChild(resetBtn);
      resetRow.appendChild(confirmBox);
      box.appendChild(resetRow);
      wrap.appendChild(box);
      wrap.appendChild(button('Zurück', onBack, 'primary'));
      return wrap;
    },
  };
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
}

export function highscoresPage(list, totals, onBack, highlight = -1) {
  return {
    name: 'highscores',
    onBack,
    build(wrap) {
      wrap.appendChild(el('h2', 'title-sm', 'HIGHSCORES'));
      const box = el('div', 'panel');
      if (!list.length) box.appendChild(el('p', 'hint', 'Noch keine Einträge – leg los!'));
      else {
        const t = el('table', 'scores');
        const head = el('tr');
        for (const h of ['#', 'Name', 'Punkte', 'Welle', 'Datum']) head.appendChild(el('th', '', h));
        t.appendChild(head);
        list.forEach((e, i) => {
          const tr = el('tr', i === highlight ? 'me' : '');
          tr.appendChild(el('td', '', String(i + 1)));
          tr.appendChild(el('td', 'name', e.name));
          tr.appendChild(el('td', 'num', formatScore(e.score)));
          tr.appendChild(el('td', 'num', String(e.wave)));
          tr.appendChild(el('td', '', formatDate(e.date)));
          t.appendChild(tr);
        });
        box.appendChild(t);
      }
      box.appendChild(el('h3', '', 'Gesamt'));
      box.appendChild(table([
        ['Spiele', String(totals.games)],
        ['Kills', formatScore(totals.kills)],
        ['Beste Welle', String(totals.bestWave)],
        ['Spielzeit', formatTime(totals.playTime)],
      ]));
      wrap.appendChild(box);
      wrap.appendChild(button('Zurück', onBack, 'primary'));
      return wrap;
    },
  };
}
