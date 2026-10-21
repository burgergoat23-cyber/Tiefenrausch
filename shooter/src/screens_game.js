// Menüseiten während des Spiels: Upgrade-Auswahl (Pause und Game Over folgen in Meilenstein 9).

import { CONFIG } from './config.js';
import { el, button } from './menus.js';
import { drawIcon } from './icons.js';
import { upgradeDef, level } from './upgrades.js';

function iconCanvas(id, size, color) {
  const c = el('canvas', 'icon');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = size * dpr;
  c.height = size * dpr;
  c.style.width = size + 'px';
  c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawIcon(ctx, id, size / 2, size / 2, size * 0.8, color, 2.4);
  return c;
}

// Upgrade-Karten: erst antippen/anwählen (Vorschau), dann bestätigen
export function upgradePage(cards, levels, onChoose) {
  let selected = -1;
  const openedAt = performance.now();
  const locked = () => performance.now() - openedAt < CONFIG.upgradeConfirmLock * 1000;
  const nodes = [];
  let confirmBtn = null;

  function select(i) {
    if (locked()) return;
    if (selected === i) {
      confirm();
      return;
    }
    selected = i;
    nodes.forEach((n, k) => n.classList.toggle('selected', k === i));
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Nehmen: ' + upgradeDef(cards[i]).name;
    nodes[i].focus({ preventScroll: true });
  }
  function confirm() {
    if (selected < 0 || locked()) return;
    onChoose(cards[selected]);
  }

  return {
    name: 'upgrade',
    cls: 'upgrade-screen',
    focus: '.card',
    build(wrap) {
      wrap.appendChild(el('h2', 'title-sm', 'UPGRADE WÄHLEN'));
      wrap.appendChild(el('p', 'hint', 'Karte antippen, dann bestätigen · Tasten 1–3, Enter'));
      const row = el('div', 'cards');
      cards.forEach((id, i) => {
        const def = upgradeDef(id);
        const lv = level(levels, id);
        const card = el('button', 'card');
        card.type = 'button';
        card.dataset.nav = '1';
        card.appendChild(el('span', 'card-key', String(i + 1)));
        card.appendChild(iconCanvas(def.icon, 56, '#3ff3ff'));
        card.appendChild(el('span', 'card-name', def.name));
        card.appendChild(el('span', 'card-desc', def.desc));
        card.appendChild(el('span', 'card-level', `Stufe ${lv} → ${lv + 1}` + (lv + 1 === def.max ? ' (max)' : '')));
        card.addEventListener('click', (ev) => {
          ev.stopPropagation();
          select(i);
        });
        card.addEventListener('focus', () => {
          if (selected >= 0 && selected !== i && !locked()) {
            selected = i;
            nodes.forEach((n, k) => n.classList.toggle('selected', k === i));
            confirmBtn.textContent = 'Nehmen: ' + def.name;
          }
        });
        nodes.push(card);
        row.appendChild(card);
      });
      wrap.appendChild(row);
      confirmBtn = button('Karte wählen', confirm, 'primary');
      confirmBtn.disabled = true;
      wrap.appendChild(confirmBtn);
      return wrap;
    },
    onKey(code) {
      if (code >= 'Digit1' && code <= 'Digit3') {
        const i = Number(code.slice(5)) - 1;
        if (i < cards.length) select(i);
        return true;
      }
      if (code === 'Enter' || code === 'Space') {
        const a = document.activeElement;
        const i = nodes.indexOf(a);
        if (i >= 0) select(i);
        else if (a === confirmBtn) confirm();
        return true;
      }
      return false;
    },
  };
}
