import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { usePlayer, useSources } from '../app/context';
import { useSettings } from '../app/settingsStore';
import { Icon } from '../components/Icon';
import { TrackList } from '../components/TrackList';
import { useT } from '../i18n';
import {
  countCatalog,
  DISCOVER_GENRES,
  loadCatalogPage,
  mergeUnique,
  useStation,
  type CatalogCount,
} from '../library/catalog';
import { trackKey, type Track } from '../sources/types';
import styles from './DiscoverPage.module.css';

/** Höchstens so viele Zeilen gleichzeitig anzeigen (das Handy bleibt flüssig); gespielt wird alles */
const MAX_ROWS = 1500;

/** Entdecken: unendlich viele freie Songs nach Genre, beim Scrollen wird nachgeladen */
export default function DiscoverPage() {
  const t = useT();
  const player = usePlayer();
  const registry = useSources();
  const sources = useSettings((s) => s.settings.sources);
  const favGenre = useSettings((s) => s.settings.favoriteGenres[0]);
  const [genre, setGenre] = useState<string>(favGenre ?? DISCOVER_GENRES[0]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  /** Seiten hintereinander ohne neue Songs (manche Quellen ignorieren das Blättern) */
  const stale = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const run = useRef(0);
  const tracksRef = useRef<Track[]>([]);

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    const id = run.current;
    try {
      const r = await loadCatalogPage(registry, genre, page, {
        isEnabled: (s) => sources[s.id] ?? true,
      });
      if (id !== run.current) return;
      const merged = mergeUnique(tracksRef.current, r.tracks);
      stale.current = merged.length === tracksRef.current.length ? stale.current + 1 : 0;
      tracksRef.current = merged;
      setTracks(merged);
      setPage((p) => p + 1);
      setDone(r.done || stale.current >= 2);
      setFailed(false);
    } catch {
      if (id === run.current) setFailed(true);
    } finally {
      if (id === run.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [registry, genre, page, done, sources]);

  // Wie viele Songs es insgesamt gibt (nur Quellen, die das verraten)
  const [count, setCount] = useState<CatalogCount | null>(null);
  useEffect(() => {
    let alive = true;
    setCount(null);
    void countCatalog(registry, genre, { isEnabled: (s) => sources[s.id] ?? true }).then((c) => {
      if (alive) setCount(c);
    });
    return () => {
      alive = false;
    };
  }, [registry, genre, sources]);

  // Neues Genre: von vorn
  useEffect(() => {
    run.current += 1;
    busy.current = false;
    stale.current = 0;
    tracksRef.current = [];
    setTracks([]);
    setPage(0);
    setDone(false);
    setFailed(false);
  }, [genre]);

  // Automatisch nachladen, wenn das Listenende sichtbar wird
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || failed || tracks.length >= MAX_ROWS) return;
    if (typeof IntersectionObserver === 'undefined') {
      if (page === 0) void loadMore();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done, failed, page, tracks.length]);

  const startMix = () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j] as Track, shuffled[i] as Track];
    }
    const first = shuffled[0] as Track;
    useStation.getState().set({ genre, nextPage: page, anchorKey: trackKey(first) });
    player.playTracks(shuffled);
  };

  return (
    <div className="kr-page">
      <p className="kr-label">{t('discover.label')}</p>
      <div className="kr-section-head">
        <h1>{t('discover.title')}</h1>
        <Link to="/radio" className="kr-btn">
          <Icon name="radio" size={18} />
          {t('nav.radio')}
        </Link>
      </div>
      <div className="kr-chips kr-chips--scroll" role="group" aria-label={t('discover.genre')}>
        {DISCOVER_GENRES.map((g) => (
          <button
            key={g}
            type="button"
            className="kr-chip"
            aria-pressed={genre === g}
            onClick={() => setGenre(g)}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="kr-section-head">
        <div role="status" data-testid="discover-count">
          {count === null ? (
            <p className="kr-muted">{t('discover.counting')}</p>
          ) : count.total > 0 ? (
            <>
              <p className={styles.total}>
                {t('discover.total', { count: count.total.toLocaleString(), genre })}
              </p>
              <p className="kr-muted">
                {count.youtubePlaylists > 0 &&
                  `${t('discover.youtubeCounted', { playlists: count.youtubePlaylists })} `}
                {count.counted.length > 0 &&
                  t('discover.counted', { sources: count.counted.join(', ') })}
                {count.uncounted.length > 0 &&
                  ` ${t('discover.uncounted', { sources: count.uncounted.join(', ') })}`}
              </p>
            </>
          ) : (
            <p className="kr-muted">{t('discover.noCount')}</p>
          )}
        </div>
        <button
          type="button"
          className="kr-btn kr-btn--primary"
          disabled={tracks.length === 0}
          onClick={startMix}
        >
          <Icon name="shuffle" size={18} />
          {t('discover.endless')}
        </button>
      </div>
      {tracks.length > 0 && (
        <TrackList tracks={tracks.slice(0, MAX_ROWS)} label={t('discover.listLabel', { genre })} />
      )}
      <div ref={sentinel} />
      {loading && <p className="kr-muted">{t('app.loading')}</p>}
      {failed && (
        <button type="button" className="kr-btn" onClick={() => void loadMore()}>
          <Icon name="refresh" size={18} />
          {t('search.retry')}
        </button>
      )}
      {!loading && !failed && !done && tracks.length >= MAX_ROWS && (
        <button type="button" className="kr-btn" onClick={() => void loadMore()}>
          {t('discover.more')}
        </button>
      )}
      {done && <p className="kr-muted">{t('discover.end')}</p>}
      <p className="kr-muted">{t('discover.about')}</p>
    </div>
  );
}
