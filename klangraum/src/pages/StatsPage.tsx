import { useMemo, useState } from 'react';
import { usePlayer } from '../app/context';
import { Artwork } from '../components/Artwork';
import { Icon } from '../components/Icon';
import { TrackList } from '../components/TrackList';
import { useT } from '../i18n';
import { useLibrary } from '../library/libraryStore';
import { computeStats, favoriteDaytime, periodStart, type Period } from '../library/stats';
import styles from './StatsPage.module.css';
import { drawStatsCard, shareCard } from '../library/statsCard';
import { useToasts } from '../app/toastStore';

const PERIODS: Period[] = ['week', 'month', 'year', 'all'];

export default function StatsPage() {
  const t = useT();
  const player = usePlayer();
  const data = useLibrary((s) => s.data);
  const [period, setPeriod] = useState<Period>('month');
  const stats = useMemo(() => {
    const now = Date.now();
    return computeStats(data, periodStart(period, now), now);
  }, [data, period]);
  const maxHour = Math.max(1, ...stats.hours);
  const daytime = favoriteDaytime(stats.hours);
  const topTracks = stats.topTracks.map((s) => s.track);
  const minutes = Math.round(stats.ms / 60000);
  const toast = useToasts((s) => s.show);
  const [busy, setBusy] = useState(false);
  const onShare = async () => {
    setBusy(true);
    try {
      const appUrl = `${window.location.origin}${window.location.pathname}`;
      const blob = await drawStatsCard(stats, {
        heading: t('stats.cardHeading'),
        period: t(`stats.periods.${period}`),
        minutesLabel: t('stats.minutes'),
        artistsLabel: t('stats.topArtists'),
        tracksLabel: t('stats.topTracks'),
        footer: t('stats.cardFooter', { url: appUrl.replace(/^https?:\/\//, '') }),
      });
      const r = blob
        ? await shareCard(blob, 'klangraum-rueckblick.png', t('stats.title'))
        : 'failed';
      if (r === 'downloaded') toast('stats.cardSaved');
      else if (r === 'failed') toast('share.failed', undefined, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kr-page">
      <p className="kr-label">{t('stats.label')}</p>
      <h1>{t('stats.title')}</h1>
      <div className="kr-chips" role="group" aria-label={t('stats.period')}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            className="kr-chip"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {t(`stats.periods.${p}`)}
          </button>
        ))}
      </div>

      {stats.plays === 0 ? (
        <p className="kr-muted">{t('stats.empty')}</p>
      ) : (
        <>
          <div>
            <button
              type="button"
              className="kr-btn kr-btn--primary"
              disabled={busy}
              onClick={() => void onShare()}
            >
              <Icon name="share" size={18} />
              {t('stats.shareCard')}
            </button>
          </div>
          <dl className={styles.numbers}>
            <div>
              <dt>{t('stats.minutes')}</dt>
              <dd>{minutes.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('stats.songs')}</dt>
              <dd>{stats.plays.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('stats.artists')}</dt>
              <dd>{stats.artists.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('stats.streak')}</dt>
              <dd>{t('stats.days', { n: stats.streak })}</dd>
            </div>
          </dl>

          {stats.topArtists.length > 0 && (
            <section className="kr-section" aria-labelledby="st-artists">
              <h2 id="st-artists">{t('stats.topArtists')}</h2>
              <ol className={styles.artists}>
                {stats.topArtists.slice(0, 5).map((a, i) => (
                  <li key={a.name} className={styles.artist}>
                    <span className={styles.rank}>{i + 1}</span>
                    <Artwork
                      srcs={[a.sample.artworkUrl]}
                      seed={a.name}
                      title={a.name}
                      size={56}
                      round
                    />
                    <span className={styles.artistText}>
                      <span className={styles.artistName}>{a.name}</span>
                      <span className="kr-muted">
                        {t('stats.artistPlays', {
                          n: a.plays,
                          min: Math.max(1, Math.round(a.ms / 60000)),
                        })}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="kr-section" aria-labelledby="st-tracks">
            <div className="kr-section-head">
              <h2 id="st-tracks">{t('stats.topTracks')}</h2>
              <button
                type="button"
                className="kr-btn kr-btn--primary"
                onClick={() => player.playTracks(topTracks)}
              >
                <Icon name="play" size={18} />
                {t('collection.playAll')}
              </button>
            </div>
            <TrackList tracks={topTracks} label={t('stats.topTracks')} />
          </section>

          <section className="kr-section" aria-labelledby="st-hours">
            <h2 id="st-hours">{t('stats.when')}</h2>
            {daytime && <p className="kr-muted">{t(`stats.daytime.${daytime}`)}</p>}
            <div className={styles.hours} aria-hidden="true">
              {stats.hours.map((n, h) => (
                <span key={h} className={styles.hour}>
                  <span className={styles.bar} style={{ height: `${(n / maxHour) * 100}%` }} />
                  {h % 6 === 0 && <span className={styles.hourLabel}>{h}</span>}
                </span>
              ))}
            </div>
          </section>
        </>
      )}
      <p className="kr-muted">{t('stats.private')}</p>
    </div>
  );
}
