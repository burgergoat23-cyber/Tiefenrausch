import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePlayer } from '../app/context';
import { useSettings } from '../app/settingsStore';
import { Icon } from '../components/Icon';
import { MediaCard } from '../components/MediaCard';
import { CoverMosaic, Shelf, TrackShelf } from '../components/Shelf';
import { useAsync } from '../components/useAsync';
import { useT } from '../i18n';
import { loadForYou } from '../library/forYou';
import { createCache } from '../storage/cache';
import { safeLocalStorage } from '../storage/settings';
import type { MusicSource } from '../sources/types';
import styles from './ForYouSection.module.css';

const cache = createCache(safeLocalStorage());

/** „Für dich“: Mix aus Lieblingskünstlern (YouTube) und Lieblingsgenres (Audius + Radio) */
export function ForYouSection({ sources }: { sources: MusicSource[] }) {
  const t = useT();
  const navigate = useNavigate();
  const player = usePlayer();
  const artists = useSettings((s) => s.settings.favoriteArtists);
  const genres = useSettings((s) => s.settings.favoriteGenres);
  const picked = useMemo(
    () => ({
      youtube: sources.find((s) => s.id === 'youtube'),
      audius: sources.find((s) => s.id === 'audius'),
      radio: sources.find((s) => s.id === 'radio'),
    }),
    [sources],
  );
  const state = useAsync(
    () => loadForYou(artists, genres, picked, cache),
    [artists.join('|'), genres.join('|'), picked],
  );

  if (artists.length === 0 && genres.length === 0) {
    return (
      <section className="kr-section kr-card" aria-label={t('forYou.title')}>
        <h2>{t('forYou.title')}</h2>
        <p className="kr-muted">{t('forYou.setup')}</p>
      </section>
    );
  }

  const title = genres.length
    ? t('forYou.titleGenres', { genres: genres.join(', ') })
    : t('forYou.title');
  const data = state.status === 'done' ? state.data : null;
  const genresText = genres.join(', ');
  return (
    <section className={styles.forYou} aria-label={title} data-testid="for-you">
      <div className={styles.hero}>
        <div className={styles.heroArt}>
          <CoverMosaic tracks={data?.mix ?? []} />
        </div>
        <div className={styles.heroText}>
          <h2 className={styles.heroTitle}>{title}</h2>
          {artists.length > 0 && (
            <p className={styles.heroSub}>{t('forYou.with', { artists: artists.join(', ') })}</p>
          )}
          {data && data.mix.length > 0 && (
            <p className={styles.heroCount}>{t('forYou.mixCount', { count: data.mix.length })}</p>
          )}
          {state.status === 'loading' && <p className={styles.heroCount}>{t('app.loading')}</p>}
        </div>
        {data && data.mix.length > 0 && (
          <div className={styles.heroButtons}>
            <button
              type="button"
              className="kr-btn kr-btn--primary"
              onClick={() => player.playTracks(data.mix)}
            >
              <Icon name="play" size={18} />
              {t('forYou.playMix')}
            </button>
            <button type="button" className="kr-btn" onClick={() => player.playShuffled(data.mix)}>
              <Icon name="shuffle" size={18} />
              {t('forYou.shuffle')}
            </button>
          </div>
        )}
      </div>

      {artists.length > 0 && (
        <div
          className="kr-chips kr-chips--scroll"
          role="group"
          aria-label={t('forYou.yourArtists')}
        >
          {artists.map((a) => (
            <button
              key={a}
              type="button"
              className="kr-chip"
              onClick={() => navigate(`/suche?q=${encodeURIComponent(a)}`)}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {data?.artistsNeedYouTube && (
        <div className="kr-card kr-section">
          <p>{t('forYou.needYouTube', { artists: artists.join(', ') })}</p>
          <div>
            <Link to="/einstellungen" className="kr-btn">
              {t('forYou.toSettings')}
            </Link>
          </div>
        </div>
      )}
      {data && data.mix.length === 0 && data.stations.length === 0 && (
        <div className="kr-section-head">
          <p className="kr-muted">{t('forYou.empty')}</p>
          <button type="button" className="kr-btn" onClick={state.reload}>
            <Icon name="refresh" size={18} />
            {t('search.retry')}
          </button>
        </div>
      )}
      {data && data.mix.length > 0 && (
        <TrackShelf title={t('forYou.mix')} tracks={data.mix.slice(0, 24)} level={3} />
      )}
      {data && data.playlists.length > 0 && (
        <Shelf title={t('forYou.playlists', { genres: genresText })} level={3}>
          {data.playlists.map((p) => (
            <MediaCard
              key={p.id}
              kind="playlist"
              sourceId={p.sourceId}
              id={p.id}
              title={p.title}
              subtitle={p.owner}
              artworkUrl={p.artworkUrl}
            />
          ))}
        </Shelf>
      )}
      {data && data.stations.length > 0 && (
        <TrackShelf
          title={t('forYou.stations', { genres: genresText })}
          tracks={data.stations}
          level={3}
        />
      )}
    </section>
  );
}
