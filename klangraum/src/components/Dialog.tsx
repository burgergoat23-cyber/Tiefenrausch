import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useT } from '../i18n';
import { Icon } from './Icon';
import styles from './Dialog.module.css';

/**
 * Fenster über allem (natives <dialog>: Fokus bleibt drin, Escape schließt).
 * Klick auf den abgedunkelten Rand schließt auch.
 */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (typeof d.showModal === 'function') {
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
    } else {
      d.setAttribute('open', '');
    }
    return () => {
      if (d.open && typeof d.close === 'function') d.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={styles.box}>
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className="kr-icon-btn"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <Icon name="close" size={22} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
