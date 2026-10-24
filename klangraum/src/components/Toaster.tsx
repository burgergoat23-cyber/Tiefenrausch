import { useToasts } from '../app/toastStore';
import { useT } from '../i18n';
import { Icon } from './Icon';
import styles from './Toaster.module.css';

/** Kurze Meldungen (Fehler freundlich auf Deutsch/Englisch) */
export function Toaster() {
  const t = useT();
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className={styles.stack} aria-label={t('common.notifications')}>
      <div role="status" aria-live="polite" className={styles.inner}>
        {toasts.map((toast) => (
          <div key={toast.id} className={styles.toast} data-tone={toast.tone}>
            <span className={styles.msg}>{t(toast.key, toast.params)}</span>
            <button
              type="button"
              className="kr-icon-btn"
              aria-label={t('common.dismiss')}
              onClick={() => dismiss(toast.id)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
