import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePlayer } from '../app/context';
import { useToasts } from '../app/toastStore';
import { useT } from '../i18n';
import { sourceName } from '../sources/names';
import type { Track } from '../sources/types';
import { Icon } from './Icon';
import styles from './TrackMenu.module.css';

/** ⋮-Menü an einem Song: Als Nächstes spielen, Ans Ende der Warteschlange, bei der Quelle ansehen */
export function TrackMenu({ track }: { track: Track }) {
  const t = useT();
  const player = usePlayer();
  const toast = useToasts((s) => s.show);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) btnRef.current?.focus();
  };

  // Nach oben aufklappen, wenn unten kein Platz ist (Mini-Player, Menüleiste)
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setUp(window.innerHeight - rect.bottom < 240);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !btnRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <button
        ref={btnRef}
        type="button"
        className="kr-icon-btn"
        aria-label={t('track.actions', { title: track.title })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className={[styles.menu, up ? styles.up : ''].join(' ')}
          onKeyDown={onKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              player.playNext([track]);
              toast('track.addedNext', { title: track.title });
              close();
            }}
          >
            <Icon name="playNext" size={20} />
            {t('track.playNext')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              player.addToQueue([track]);
              toast('track.addedQueue', { title: track.title });
              close();
            }}
          >
            <Icon name="queue" size={20} />
            {t('track.addToQueue')}
          </button>
          {track.permalink && (
            <a
              role="menuitem"
              className={styles.item}
              href={track.permalink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => close(false)}
            >
              <Icon name="external" size={20} />
              {t('track.openAt', { source: sourceName(track.sourceId) })}
            </a>
          )}
          {track.license?.url && (
            <a
              role="menuitem"
              className={styles.item}
              href={track.license.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => close(false)}
            >
              <Icon name="external" size={20} />
              {t('track.license', { license: track.license.name })}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
