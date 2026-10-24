import type { ReactNode } from 'react';
import { usePlayer } from '../../app/context';
import styles from '../../pages/CollectionPage.module.css';
import { formatDuration } from '../../components/format';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import type { Track } from '../../sources/types';

/** Kopf für eigene Listen (Lieblingssongs, Playlists, Verlauf): Bild, Titel, Abspielen, Zufall */
export function LocalHeader({
  art,
  kind,
  title,
  tracks,
  actions,
}: {
  art: ReactNode;
  kind: string;
  title: string;
  tracks: Track[];
  actions?: ReactNode;
}) {
  const t = useT();
  const player = usePlayer();
  const total = tracks.reduce((sum, tr) => sum + (tr.live ? 0 : tr.durationMs), 0);
  return (
    <header className={styles.head}>
      <span className={styles.art} style={{ width: 160 }}>
        {art}
      </span>
      <div className={styles.info}>
        <p className={styles.kind}>{kind}</p>
        <h1>{title}</h1>
        <p className="kr-muted">
          {t('track.count', { count: tracks.length })}
          {total > 0 && ` · ${formatDuration(total)}`}
        </p>
        <div className={styles.actions}>
          {tracks.length > 0 && (
            <>
              <button
                type="button"
                className="kr-btn kr-btn--primary"
                onClick={() => player.playTracks(tracks)}
              >
                <Icon name="play" size={18} />
                {t('collection.playAll')}
              </button>
              <button type="button" className="kr-btn" onClick={() => player.playShuffled(tracks)}>
                <Icon name="shuffle" size={18} />
                {t('collection.shuffle')}
              </button>
            </>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
