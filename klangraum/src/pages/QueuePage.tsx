import { usePlayer, usePlayerState } from '../app/context';
import { useDialogs } from '../app/dialogStore';
import { Icon } from '../components/Icon';
import { RepeatButton, ShuffleButton } from '../components/PlayerControls';
import { QueueItemBody, UpNextList } from '../components/QueueList';
import styles from '../components/QueueList.module.css';
import { useT } from '../i18n';

export default function QueuePage() {
  const t = useT();
  const player = usePlayer();
  const queue = usePlayerState((s) => s.queue);
  const current = queue.index >= 0 ? queue.items[queue.index] : undefined;
  const upcoming = queue.items.slice(queue.index + 1);
  const played = queue.index > 0 ? queue.items.slice(0, queue.index) : [];
  const openDialog = useDialogs((s) => s.open);
  const saveable = queue.items.filter((i) => !i.track.live).map((i) => i.track);
  return (
    <div className="kr-page">
      <div className="kr-section-head">
        <h1>{t('queue.title')}</h1>
        <div className={styles.tools}>
          {saveable.length > 0 && (
            <button
              type="button"
              className="kr-icon-btn"
              aria-label={t('queue.saveAsPlaylist')}
              title={t('queue.saveAsPlaylist')}
              onClick={() => openDialog({ kind: 'newPlaylist', tracks: saveable })}
            >
              <Icon name="listPlus" size={22} />
            </button>
          )}
          <ShuffleButton />
          <RepeatButton />
        </div>
      </div>

      {!current && <p className="kr-muted">{t('queue.empty')}</p>}

      {current && (
        <section className="kr-section" aria-labelledby="q-now">
          <h2 id="q-now">{t('queue.nowPlaying')}</h2>
          <div className={`${styles.row} ${styles.current}`}>
            <span className={styles.main}>
              <QueueItemBody item={current} />
            </span>
          </div>
        </section>
      )}

      {current && (
        <section className="kr-section" aria-labelledby="q-next">
          <div className="kr-section-head">
            <h2 id="q-next">{t('queue.upNext')}</h2>
            {upcoming.length > 0 && (
              <button type="button" className="kr-btn" onClick={() => player.clearUpcoming()}>
                <Icon name="trash" size={18} />
                {t('queue.clear')}
              </button>
            )}
          </div>
          <UpNextList />
        </section>
      )}

      {played.length > 0 && (
        <section className="kr-section" aria-labelledby="q-played">
          <h2 id="q-played">{t('queue.history')}</h2>
          <ol className={styles.list}>
            {played.map((item, i) => (
              <li key={item.uid} className={`${styles.row} ${styles.played}`}>
                <button
                  type="button"
                  className={styles.main}
                  aria-label={t('track.play', { title: item.track.title })}
                  onClick={() => player.jumpTo(i)}
                >
                  <QueueItemBody item={item} />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
