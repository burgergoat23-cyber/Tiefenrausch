import { usePlayer, usePlayerState } from '../../app/context';
import { useDialogs } from '../../app/dialogStore';
import { formatDuration } from '../../components/format';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import { useShareTracks } from '../../share/useShareTracks';
import type { Track } from '../../sources/types';
import { remainingMs, useSleepTimer } from '../sleepTimer';
import { usePlayerView } from './playerView';
import styles from './PlayerTools.module.css';

/** Werkzeugleiste im großen Player: Songtext, Schlaf-Timer, Teilen */
export function PlayerTools({ track }: { track: Track }) {
  const t = useT();
  const lyrics = usePlayerView((s) => s.lyrics);
  const setLyrics = usePlayerView((s) => s.setLyrics);
  const openDialog = useDialogs((s) => s.open);
  const mode = useSleepTimer((s) => s.mode);
  const now = useSleepTimer((s) => s.now);
  const left = remainingMs(mode, now);
  const share = useShareTracks();
  const player = usePlayer();
  const rate = usePlayerState((s) => s.rate);
  // Reihenfolge beim Antippen: normal → slowed → sped up → normal
  const nextRate = rate === 1 ? 0.8 : rate < 1 ? 1.25 : 1;
  const rateName = rate === 1 ? t('tempo.normal') : rate < 1 ? t('tempo.slowed') : t('tempo.sped');
  return (
    <div className={styles.tools}>
      {!track.live && (
        <button
          type="button"
          className={styles.tool}
          aria-pressed={lyrics}
          onClick={() => setLyrics(!lyrics)}
        >
          <Icon name="lyrics" size={22} />
          <span>{t('lyrics.title')}</span>
        </button>
      )}
      <button
        type="button"
        className={styles.tool}
        aria-pressed={mode.kind !== 'off'}
        onClick={() => openDialog({ kind: 'sleepTimer' })}
      >
        <Icon name="moon" size={22} />
        <span>
          {left !== null
            ? formatDuration(left)
            : mode.kind === 'endOfTrack'
              ? t('sleep.short')
              : t('sleep.title')}
        </span>
      </button>
      {!track.live && (
        <button
          type="button"
          className={styles.tool}
          aria-pressed={rate !== 1}
          aria-label={t('tempo.label', { name: rateName })}
          onClick={() => player.setRate(nextRate)}
        >
          <Icon name="tempo" size={22} />
          <span>{rate === 1 ? t('tempo.title') : rateName}</span>
        </button>
      )}
      <button
        type="button"
        className={styles.tool}
        onClick={() => void share(track.title, [track])}
      >
        <Icon name="share" size={22} />
        <span>{t('share.share')}</span>
      </button>
    </div>
  );
}
