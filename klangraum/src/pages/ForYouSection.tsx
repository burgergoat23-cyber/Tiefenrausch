import { useMemo } from 'react';
import { Link } from 'react-router';
import { usePlayer } from '../app/context';
import { useSettings } from '../app/settingsStore';
import { Icon } from '../components/Icon';
import { TrackList } from '../components/TrackList';
import { useAsync } from '../components/useAsync';
import { useT } from '../i18n';
import { loadForYou } from '../library/forYou';
import { createTrackCache } from '../storage/cache';
import { safeLocalStorage } from '../storage/settings';
import type { MusicSource } from '../sources/types';

const cache = createTrackCache(safeLocalStorage());

/** „Für dich“: Mix aus Lieblingskünstlern (YouTube) und Lieblingsgenres (Audius + Radio) */
export function ForYouSection({ sources }: { sources: MusicSource[] }) {
  const t = useT();
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
  return (
    <section className="kr-section" aria-label={title} data-testid="for-you">
      <div className="kr-section-head">
        <div>
          <h2>{title}</h2>
          {artists.length > 0 && (
            <p className="kr-muted">{t('forYou.with', { artists: artists.join(', ') })}</p>
          )}
        </div>
        {data && data.mix.length > 0 && (
          <div className="kr-chips">
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
      {state.status === 'loading' && <p className="kr-muted">{t('app.loading')}</p>}
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
      {data && data.mix.length > 0 && <TrackList tracks={data.mix.slice(0, 12)} label={title} />}
      {data && data.stations.length > 0 && (
        <>
          <h3>{t('forYou.stations', { genres: genres.join(', ') })}</h3>
          <TrackList
            tracks={data.stations}
            label={t('forYou.stations', { genres: genres.join(', ') })}
          />
        </>
      )}
    </section>
  );
}
