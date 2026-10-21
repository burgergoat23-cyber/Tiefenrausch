// Menüs als HTML-Overlay über dem Canvas. Bedienbar mit Maus, Touch, Tastatur (Pfeile + Enter) und Gamepad.
// Jede Seite baut ihr DOM selbst; Elemente mit data-nav sind per Tastatur/Gamepad erreichbar.

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function button(label, onClick, cls = '') {
  const b = el('button', 'btn ' + cls, label);
  b.type = 'button';
  b.dataset.nav = '1';
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onClick(ev);
  });
  return b;
}

export function createMenus(root, sfx) {
  const menus = {
    root,
    current: null,      // { name, node, onBack, onKey }
    sfx: sfx || (() => {}),
  };
  root.addEventListener('pointerover', (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-nav]');
    if (t && t !== document.activeElement && ev.pointerType === 'mouse' && t.tagName !== 'INPUT') {
      t.focus({ preventScroll: true });
      menus.sfx('hover');
    }
  });
  root.addEventListener('click', (ev) => {
    if (ev.target.closest && ev.target.closest('[data-nav]')) menus.sfx('click');
  }, true);
  // Tasten im Menü sofort behandeln (sonst löst Enter auf einem Knopf doppelt aus)
  window.addEventListener('keydown', (ev) => {
    if (!menus.current || ev.repeat) return;
    // in Textfeldern normal tippen lassen (nur Enter, Esc und Pfeil hoch/runter gehen ans Menü)
    const typing = ev.target && ev.target.tagName === 'INPUT' && ev.target.type === 'text';
    if (typing && !['Enter', 'Escape', 'ArrowUp', 'ArrowDown'].includes(ev.code)) return;
    if (menuKey(menus, ev.code)) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }, true);
  return menus;
}

// Seite zeigen. page = { name, build(container) -> node, onBack?, onKey?, focus? }
export function showMenu(menus, page) {
  hideMenu(menus, true);
  const wrap = el('div', 'screen ' + (page.cls || ''));
  wrap.dataset.name = page.name;
  const node = page.build(wrap);
  if (node && node !== wrap) wrap.appendChild(node);
  menus.root.appendChild(wrap);
  menus.root.classList.add('active');
  menus.current = { ...page, node: wrap };
  // sanft einblenden
  requestAnimationFrame(() => wrap.classList.add('in'));
  const first = page.focus ? wrap.querySelector(page.focus) : wrap.querySelector('[data-nav]');
  if (first) first.focus({ preventScroll: true });
  return wrap;
}

export function hideMenu(menus, instant = false) {
  const cur = menus.current;
  if (!cur) return;
  menus.current = null;
  const node = cur.node;
  if (cur.onHide) cur.onHide();
  if (instant) node.remove();
  else {
    node.classList.remove('in');
    node.classList.add('out');
    setTimeout(() => node.remove(), 180);
  }
  if (!menus.current) menus.root.classList.remove('active');
}

export function menuOpen(menus, name) {
  return !!menus.current && (!name || menus.current.name === name);
}

function navItems(menus) {
  if (!menus.current) return [];
  return [...menus.current.node.querySelectorAll('[data-nav]')].filter((n) => !n.disabled && n.offsetParent !== null);
}

// Fokus in eine Richtung bewegen (nächstes Element in Pfeilrichtung)
export function moveFocus(menus, dx, dy) {
  const items = navItems(menus);
  if (!items.length) return;
  const cur = document.activeElement;
  if (!items.includes(cur)) {
    items[0].focus({ preventScroll: true });
    return;
  }
  const r0 = cur.getBoundingClientRect();
  const cx = r0.left + r0.width / 2;
  const cy = r0.top + r0.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const it of items) {
    if (it === cur) continue;
    const r = it.getBoundingClientRect();
    const x = r.left + r.width / 2 - cx;
    const y = r.top + r.height / 2 - cy;
    const along = x * dx + y * dy;
    if (along <= 4) continue;
    const across = Math.abs(x * dy - y * dx);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  if (!best) {
    // am Rand: in der Liste weiterspringen (umlaufend)
    const i = items.indexOf(cur);
    const step = dx + dy > 0 ? 1 : -1;
    best = items[(i + step + items.length) % items.length];
  }
  best.focus({ preventScroll: true });
  menus.sfx('hover');
}

// Schieberegler mit links/rechts verstellen
function nudgeSlider(dir) {
  const a = document.activeElement;
  if (!a || a.tagName !== 'INPUT' || a.type !== 'range') return false;
  const step = Number(a.step) || 1;
  a.value = String(Math.min(Number(a.max), Math.max(Number(a.min), Number(a.value) + dir * step)));
  a.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// Tastendruck an das offene Menü geben. Rückgabe: true, wenn verbraucht.
export function menuKey(menus, code) {
  const cur = menus.current;
  if (!cur) return false;
  if (cur.onKey && cur.onKey(code)) return true;
  switch (code) {
    case 'ArrowUp': case 'KeyW': moveFocus(menus, 0, -1); return true;
    case 'ArrowDown': case 'KeyS': moveFocus(menus, 0, 1); return true;
    case 'ArrowLeft': case 'KeyA':
      if (nudgeSlider(-1)) return true;
      moveFocus(menus, -1, 0);
      return true;
    case 'ArrowRight': case 'KeyD':
      if (nudgeSlider(1)) return true;
      moveFocus(menus, 1, 0);
      return true;
    case 'Enter': case 'Space': {
      const a = document.activeElement;
      if (a && cur.node.contains(a) && a.dataset.nav) {
        if (a.tagName === 'INPUT' && a.type === 'range') return true;
        a.click();
      }
      return true;
    }
    case 'Escape': case 'Backspace':
      if (cur.onBack) {
        cur.onBack();
        return true;
      }
      return false;
    default:
      return false;
  }
}
