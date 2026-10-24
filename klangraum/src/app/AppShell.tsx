import { Suspense, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Icon, type IconName } from '../components/Icon';
import { LiveAnnouncer } from '../components/LiveAnnouncer';
import { MiniPlayer } from '../components/MiniPlayer';
import { Toaster } from '../components/Toaster';
import { useT, type TKey } from '../i18n';
import { usePlayerState } from './context';
import styles from './AppShell.module.css';

const NAV: { to: string; icon: IconName; label: TKey }[] = [
  { to: '/', icon: 'home', label: 'nav.home' },
  { to: '/suche', icon: 'search', label: 'nav.search' },
  { to: '/bibliothek', icon: 'library', label: 'nav.library' },
  { to: '/anpassen', icon: 'customize', label: 'nav.customize' },
  { to: '/einstellungen', icon: 'settings', label: 'nav.settings' },
];

function PageFallback() {
  const t = useT();
  return (
    <div className="kr-page">
      <p className="kr-muted">{t('app.loading')}</p>
    </div>
  );
}

/** Grundgerüst: Menü (unten am Handy, links am PC), Inhalt, Mini-Player, Meldungen */
export function AppShell() {
  const t = useT();
  const location = useLocation();
  const hasTrack = usePlayerState((s) => s.queue.index >= 0);
  const inFullPlayer = location.pathname === '/player';
  const showMini = hasTrack && !inFullPlayer;
  const mainRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Der Vollbild-Player liegt über allem: Menü dahinter für Tastatur und Screenreader sperren
  useEffect(() => {
    navRef.current?.toggleAttribute('inert', inFullPlayer);
  }, [inFullPlayer]);

  // Beim Seitenwechsel nach oben scrollen und den Fokus auf den Inhalt setzen (Screenreader)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (inFullPlayer) return;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, inFullPlayer]);

  return (
    <div className={styles.shell} data-mini={showMini || undefined}>
      <a
        href="#main"
        className="kr-skip-link"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {t('app.skipToContent')}
      </a>
      <nav ref={navRef} className={styles.nav} aria-label={t('nav.main')}>
        <span className={styles.brand} aria-hidden="true">
          <Icon name="note" size={22} />
          {t('app.name')}
        </span>
        <ul>
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'} className={styles.link}>
                <Icon name={item.icon} size={22} />
                <span className={styles.linkText}>{t(item.label)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      {showMini && (
        <div className={styles.miniSlot}>
          <MiniPlayer />
        </div>
      )}
      <Toaster />
      <LiveAnnouncer />
    </div>
  );
}
