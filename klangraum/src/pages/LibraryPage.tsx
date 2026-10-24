import { Link } from 'react-router';
import { useDialogs } from '../app/dialogStore';
import { Icon, type IconName } from '../components/Icon';
import { useT, type TKey } from '../i18n';
import { recentTracks } from '../library/library';
import { useLibrary } from '../library/libraryStore';
import { PlaylistArt } from '../library/ui/PlaylistArt';
import { TrackShelf } from '../components/Shelf';
import { useMemo } from 'react';
import styles from './LibraryPage.module.css';

function NavRow({
  to,
  icon,
  label,
  count,
}: {
  to: string;
  icon: IconName;
  label: TKey;
  count?: string;
}) {
  const t = useT();
  return (
    <li>
      <Link to={to} className={styles.navRow}>
        <span className={styles.navIcon}>
          <Icon name={icon} size={22} />
        </span>
        <span className={styles.navLabel}>{t(label)}</span>
        {count && <span className={styles.navCount}>{count}</span>}
        <span className={styles.chev} aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  );
}

export default function LibraryPage() {
  const t = useT();
  const data = useLibrary((s) => s.data);
  const openDialog = useDialogs((s) => s.open);
  const recent = useMemo(() => recentTracks(data, 20).map((r) => r.track), [data]);

  return (
    <div className="kr-page">
      <h1>{t('library.title')}</h1>
      <ul className={styles.nav}>
        <NavRow
          to="/bibliothek/lieblingssongs"
          icon="heart"
          label="library.liked"
          count={String(data.likes.length)}
        />
        <NavRow to="/bibliothek/verlauf" icon="clock" label="library.history" />
        <NavRow to="/rueckblick" icon="chart" label="stats.title" />
        <NavRow to="/warteschlange" icon="queue" label="nav.queue" />
      </ul>

      {recent.length > 0 && <TrackShelf title={t('library.history')} tracks={recent} />}

      <section className="kr-section" aria-labelledby="lib-pl">
        <div className="kr-section-head">
          <h2 id="lib-pl">{t('library.playlists')}</h2>
          <button
            type="button"
            className="kr-btn"
            onClick={() => openDialog({ kind: 'newPlaylist' })}
          >
            <Icon name="plus" size={18} />
            {t('library.newPlaylist')}
          </button>
        </div>
        {data.playlists.length === 0 ? (
          <p className="kr-muted">{t('library.noPlaylists')}</p>
        ) : (
          <ul className={styles.grid}>
            {data.playlists.map((p) => (
              <li key={p.id}>
                <Link to={`/bibliothek/playlist/${p.id}`} className={styles.card}>
                  <PlaylistArt playlist={p} className={styles.cardArt} />
                  <span className={styles.cardTitle}>{p.name}</span>
                  <span className={styles.cardSub}>
                    {t('track.count', { count: p.tracks.length })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
