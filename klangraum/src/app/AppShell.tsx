import { Suspense, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { DialogHost } from '../components/DialogHost';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Icon, type IconName } from '../components/Icon';
import { LiveAnnouncer } from '../components/LiveAnnouncer';
import { MiniPlayer } from '../components/MiniPlayer';
import { Toaster } from '../components/Toaster';
import { VideoDock } from '../components/VideoDock';
import { useT, type TKey } from '../i18n';
import { usePlayerState } from './context';
import { useKeyboardShortcuts } from './shortcuts';
import styles from './AppShell.module.css';

interface NavItem {
  to: string;
  icon: IconName;
  label: TKey;
  /** auch unten in der Leiste am Handy (dort ist nur Platz für fünf) */
  tab?: boolean;
}

/** Seitenleiste in Gruppen (am PC/iPad); am Handy nur die Punkte mit `tab` */
const NAV_GROUPS: { title?: TKey; items: NavItem[] }[] = [
  {
    items: [
      { to: '/', icon: 'home', label: 'nav.home', tab: true },
      { to: '/suche', icon: 'search', label: 'nav.search', tab: true },
      { to: '/radio', icon: 'radio', label: 'nav.radio', tab: true },
    ],
  },
  {
    title: 'nav.libraryGroup',
    items: [
      { to: '/bibliothek', icon: 'library', label: 'nav.library', tab: true },
      { to: '/bibliothek/lieblingssongs', icon: 'heart', label: 'library.liked' },
      { to: '/rueckblick', icon: 'chart', label: 'stats.title' },
      { to: '/warteschlange', icon: 'queue', label: 'nav.queue' },
    ],
  },
  {
    title: 'nav.designGroup',
    items: [
      { to: '/anpassen', icon: 'customize', label: 'nav.customize' },
      { to: '/einstellungen', icon: 'settings', label: 'nav.settings', tab: true },
    ],
  },
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
  useKeyboardShortcuts();

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
          {t('app.name')}
        </span>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={styles.group}>
            {group.title && <h2 className={styles.groupTitle}>{t(group.title)}</h2>}
            <ul>
              {group.items.map((item) => (
                <li key={item.to} data-tab={item.tab || undefined}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/' || item.to === '/bibliothek'}
                    className={styles.link}
                  >
                    <Icon name={item.icon} size={22} />
                    <span className={styles.linkText}>{t(item.label)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
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
      <VideoDock />
      <DialogHost />
      <Toaster />
      <LiveAnnouncer />
    </div>
  );
}
