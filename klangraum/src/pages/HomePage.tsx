import { Link } from 'react-router';
import { usePlayer } from '../app/context';
import { errorText } from '../components/errorText';
import { Icon } from '../components/Icon';
import { TrackShelf } from '../components/Shelf';
import { ForYouSection } from './ForYouSection';
import { useAsync } from '../components/useAsync';
import { useT, type TKey } from '../i18n';
import { useActiveSources } from '../sources/useActiveSources';
import type { MusicSource } from '../sources/types';

function greetingKey(hour: number): TKey {
  if (hour < 5) return 'home.night';
  if (hour < 11) return 'home.morning';
  if (hour < 18) return 'home.day';
  if (hour < 23) return 'home.evening';
  return 'home.night';
}

function TrendingSection({ source }: { source: MusicSource }) {
  const t = useT();
  const player = usePlayer();
  const state = useAsync(() => source.getTrending?.() ?? Promise.resolve([]), [source]);
  const title =
    source.id === 'radio'
      ? t('home.radio')
      : source.id === 'archive'
        ? t('home.archive')
        : source.id === 'youtube'
          ? t('home.youtube')
          : t('home.trendingOn', { source: source.name });
  const tracks = state.status === 'done' ? state.data : [];
  const playAll = (
    <button type="button" className="kr-btn" onClick={() => player.playTracks(tracks)}>
      <Icon name="play" size={16} />
      {t('collection.playAll')}
    </button>
  );
  if (state.status === 'done' && tracks.length > 0) {
    return <TrackShelf title={title} tracks={tracks} actions={playAll} />;
  }
  return (
    <section className="kr-section" aria-label={title}>
      <h2>{title}</h2>
      {state.status === 'loading' && <p className="kr-muted">{t('app.loading')}</p>}
      {state.status === 'error' && (
        <div className="kr-section-head">
          <p className="kr-error-text">{errorText(t, state.error, source.id)}</p>
          <button type="button" className="kr-btn" onClick={state.reload}>
            <Icon name="refresh" size={18} />
            {t('search.retry')}
          </button>
        </div>
      )}
      {state.status === 'done' && <p className="kr-muted">{t('forYou.empty')}</p>}
    </section>
  );
}

export default function HomePage() {
  const t = useT();
  const { sources, ready } = useActiveSources();
  const trending = sources.filter((s) => s.getTrending);
  return (
    <div className="kr-page">
      <header className="kr-section">
        <h1>{t(greetingKey(new Date().getHours()))}</h1>
        <p className="kr-muted">{t('home.intro')}</p>
      </header>
      {ready && sources.length === 0 && (
        <div className="kr-card kr-section">
          <p>{t('home.noSources')}</p>
          <div>
            <Link to="/einstellungen" className="kr-btn">
              {t('home.toSettings')}
            </Link>
          </div>
        </div>
      )}
      {ready && sources.length > 0 && <ForYouSection sources={sources} />}
      {trending.map((s) => (
        <TrendingSection key={s.id} source={s} />
      ))}
    </div>
  );
}
