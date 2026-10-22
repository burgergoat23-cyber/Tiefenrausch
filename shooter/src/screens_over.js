// Game-Over-Bildschirm: Punkte zählen hoch, Statistik, Highscore-Kürzel, Nochmal/Menü, Konfetti bei Rekord.

import { CONFIG } from './config.js';
import { el, button } from './menus.js';
import { upgradeDef } from './upgrades.js';
import { formatScore, formatTime } from './utils.js';
import { cleanName } from './storage.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function confetti(wrap) {
  const box = el('div', 'confetti');
  const colors = ['#3ff3ff', '#ff3b6b', '#ffe23f', '#7dff3a', '#b65cff', '#ff8a1f'];
  for (let i = 0; i < 70; i++) {
    const c = el('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 1.2}s`;
    c.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(c);
  }
  wrap.appendChild(box);
}

// summary: runSummary(run); hs: { rank, isBest, entry } oder null; actions: { again, menu, rename(name), sound(name) }
export function gameOverPage(summary, hs, levels, actions) {
  let nameInput = null;
  let againBtn = null;
  let menuBtn = null;
  let menuByHover = false;  // „Menü“ nur mit der Maus überfahren: Enter bleibt „Nochmal“
  let raf = 0;
  // kurz nach dem Erscheinen keine Auswahl (Leertaste/Gamepad-A vom Dash starten sonst sofort neu)
  const openedAt = performance.now();
  const locked = () => performance.now() - openedAt < CONFIG.gameOverLock * 1000;
  const unlessLocked = (fn) => () => { if (!locked()) fn(); };
  return {
    name: 'gameover',
    cls: 'over-screen',
    focus: '.primary',
    onBack: unlessLocked(actions.menu),
    onHide() {
      cancelAnimationFrame(raf);
    },
    onKey(code) {
      const a = document.activeElement;
      if ((code === 'Enter' || code === 'Space') && locked()) return true;
      if (code === 'Backspace') return true; // nur Esc/Gamepad-B führen zum Startbildschirm (Tippfehler im Kürzel)
      if (nameInput && a === nameInput) {
        // Gamepad: Schreibmarke zwischen den 3 Stellen bewegen (Tastatur bleibt im Feld nativ)
        if (code === 'ArrowLeft' || code === 'ArrowRight') {
          const cur = Math.max(1, nameInput.selectionStart || 0);
          const p = Math.min(3, Math.max(1, cur + (code === 'ArrowRight' ? 1 : -1)));
          nameInput.setSelectionRange(p, p);
          return true;
        }
        if (code === 'ArrowUp' || code === 'ArrowDown') {
          cycleLetter(nameInput, code === 'ArrowUp' ? 1 : -1, actions.rename);
          return true;
        }
        if (code === 'Enter' || code === 'Escape') {
          againBtn.focus();
          return true;
        }
        return false;
      }
      if (code === 'Enter') {
        if (a === menuBtn && !menuByHover) return false; // per Tastatur/Gamepad markiert: den auslösen
        actions.again();
        return true;
      }
      return false;
    },
    build(wrap) {
      wrap.appendChild(el('h1', 'over-title', 'GAME OVER'));
      if (summary.deathBy) wrap.appendChild(el('p', 'death', `Besiegt von: ${summary.deathBy}`));
      const scoreEl = el('div', 'over-score', '0');
      wrap.appendChild(scoreEl);
      // Punkte zählen hoch
      const t0 = performance.now();
      const dur = Math.min(1600, 400 + summary.score / 20);
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        scoreEl.textContent = formatScore(summary.score * e);
        if (k < 1) raf = requestAnimationFrame(tick);
        else if (hs && hs.isBest) scoreEl.classList.add('pop');
      };
      raf = requestAnimationFrame(tick);

      if (hs) {
        const box = el('div', 'hs-box');
        box.appendChild(el('p', hs.isBest ? 'new-best' : 'rank', hs.isBest ? 'NEUER HIGHSCORE!' : `Platz ${hs.rank + 1} in den Highscores`));
        const row = el('label', 'name-row');
        row.appendChild(el('span', 'label', 'Kürzel:'));
        nameInput = el('input', 'name-input');
        nameInput.type = 'text';
        nameInput.maxLength = 3;
        nameInput.value = hs.entry.name;
        nameInput.autocomplete = 'off';
        nameInput.spellcheck = false;
        nameInput.setAttribute('autocapitalize', 'characters');
        nameInput.dataset.nav = '1';
        nameInput.addEventListener('input', () => {
          const v = nameInput.value.toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g, '').slice(0, 3);
          nameInput.value = v;
          if (v.length) actions.rename(cleanName(v));
        });
        nameInput.addEventListener('focus', () => nameInput.select());
        row.appendChild(nameInput);
        box.appendChild(row);
        wrap.appendChild(box);
        if (hs.isBest) {
          confetti(wrap);
          actions.sound('fanfare');
        }
      }

      const grid = el('div', 'stats');
      const stat = (label, value) => {
        const s = el('div', 'stat');
        s.appendChild(el('span', 'v', value));
        s.appendChild(el('span', 'l', label));
        grid.appendChild(s);
      };
      stat('Welle', String(summary.wave));
      stat('Spielzeit', formatTime(summary.time));
      stat('Kills', String(summary.kills));
      stat('Treffer', `${summary.accuracy} %`);
      stat('Höchste Kombo', String(summary.maxCombo));
      stat('Lieblingswaffe', summary.favoriteWeapon);
      wrap.appendChild(grid);

      const kills = el('div', 'kill-list');
      for (const [type, n] of Object.entries(summary.killsByType)) {
        const def = CONFIG.enemies[type] || CONFIG.bosses[type];
        if (!def) continue;
        const chip = el('span', 'chip');
        const dot = el('i', 'dot');
        dot.style.background = def.color;
        chip.appendChild(dot);
        chip.appendChild(el('span', '', `${def.name.charAt(0) + def.name.slice(1).toLowerCase()} ${n}`));
        kills.appendChild(chip);
      }
      if (kills.childNodes.length) wrap.appendChild(kills);

      const ups = Object.entries(levels).filter(([, v]) => v > 0);
      if (ups.length) {
        const list = el('div', 'kill-list');
        for (const [id, v] of ups) list.appendChild(el('span', 'chip', `${upgradeDef(id).name} ${v}`));
        wrap.appendChild(list);
      }

      const col = el('div', 'menu-row');
      againBtn = button('Nochmal', unlessLocked(actions.again), 'primary big');
      col.appendChild(againBtn);
      menuBtn = button('Menü', unlessLocked(actions.menu));
      menuBtn.addEventListener('focus', () => { menuByHover = !!menuBtn.dataset.hoverFocus; });
      col.appendChild(menuBtn);
      wrap.appendChild(col);
      wrap.appendChild(el('p', 'hint', 'Enter oder „Nochmal“ für eine neue Runde'));
      return wrap;
    },
  };
}

// Pfeil hoch/runter im Namensfeld: Buchstabe an der Schreibmarke ändern (für Gamepad)
function cycleLetter(input, dir, rename) {
  const v = (input.value || 'AAA').padEnd(3, 'A').split('');
  const pos = Math.min(2, Math.max(0, (input.selectionStart ?? 1) - 1));
  const i = LETTERS.indexOf(v[pos]);
  v[pos] = LETTERS[(i + dir + LETTERS.length) % LETTERS.length];
  input.value = v.join('');
  input.setSelectionRange(pos + 1, pos + 1);
  rename(cleanName(input.value));
}
