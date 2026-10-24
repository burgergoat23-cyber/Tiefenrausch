import { useEffect, useState, useSyncExternalStore } from 'react';
import { isAppleTouchDevice } from '../app/setup';
import { useT } from '../i18n';
import { Icon } from './Icon';
import styles from './InstallHint.module.css';

const DISMISS_KEY = 'klangraum.installHintDismissed';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Tipp zum Installieren: am iPhone per Teilen-Menü, bei Chrome/Android mit Knopf */
export function InstallHint() {
  const t = useT();
  const [dismissed, setDismissed] = useState(readDismissed);
  const canPrompt = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => deferred !== null,
  );
  const ios = isAppleTouchDevice();
  if (dismissed || isStandalone() || (!ios && !canPrompt)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // egal
    }
  };

  return (
    <aside className={styles.hint} aria-label={t('install.title')}>
      <img src="./icon-192.png" alt="" width={44} height={44} className={styles.icon} />
      <div className={styles.text}>
        <strong>{t('install.title')}</strong>
        <span className="kr-muted">{ios ? t('install.ios') : t('install.other')}</span>
      </div>
      {!ios && canPrompt && (
        <button
          type="button"
          className="kr-btn kr-btn--primary"
          onClick={() => {
            void deferred?.prompt();
            deferred = null;
            dismiss();
          }}
        >
          {t('install.button')}
        </button>
      )}
      <button
        type="button"
        className="kr-icon-btn"
        aria-label={t('common.dismiss')}
        onClick={dismiss}
      >
        <Icon name="close" size={20} />
      </button>
    </aside>
  );
}

/** Kleiner Hinweis, solange das Gerät offline ist */
export function OfflineBanner() {
  const t = useT();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <p className={styles.offline} role="status">
      {t('install.offline')}
    </p>
  );
}
