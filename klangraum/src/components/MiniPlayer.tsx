import { Link } from 'react-router';
import { usePlayerState } from '../app/context';
import { useT } from '../i18n';
import { currentItem } from '../player/queue';
import { TrackArtwork } from './Artwork';
import { Icon } from './Icon';
import {
  NextButton,
  PlayPauseButton,
  PrevButton,
  RepeatButton,
  ShuffleButton,
} from './PlayerControls';
import { SourceBadge } from './SourceBadge';
import { VolumeControl } from './VolumeControl';
import styles from './MiniPlayer.module.css';

function MiniProgress() {
  const pos = usePlayerState((s) => s.positionMs);
  const dur = usePlayerState((s) => s.durationMs);
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  return (
    <div className={styles.progress} aria-hidden="true">
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Immer sichtbar unten, sobald etwas in der Warteschlange ist */
export function MiniPlayer() {
  const t = useT();
  const track = usePlayerState((s) => currentItem(s.queue)?.track ?? null);
  const buffering = usePlayerState((s) => s.buffering || s.status === 'loading');
  if (!track) return null;
  const artists = track.artists.join(', ') || t('track.unknownArtist');
  return (
    <section className={styles.mini} aria-label={t('player.mini')} data-testid="mini-player">
      <MiniProgress />
      <Link
        to="/player"
        className={styles.info}
        aria-label={`${t('player.open')}: ${track.title} – ${artists}`}
      >
        <TrackArtwork track={track} size={44} eager />
        <span className={styles.text}>
          <span className={styles.title}>{track.title}</span>
          <span className={styles.meta}>
            <SourceBadge sourceId={track.sourceId} />
            <span className={styles.artist}>{buffering ? t('player.buffering') : artists}</span>
          </span>
        </span>
      </Link>
      <div className={styles.controls}>
        <span className={styles.wideOnly}>
          <ShuffleButton />
        </span>
        <span className={styles.wideOnly}>
          <PrevButton />
        </span>
        <PlayPauseButton />
        <NextButton />
        <span className={styles.wideOnly}>
          <RepeatButton />
        </span>
      </div>
      <div className={styles.actions}>
        <span className={styles.volume}>
          <VolumeControl />
        </span>
        <Link
          to="/warteschlange"
          className={`kr-icon-btn ${styles.wideOnly}`}
          aria-label={t('player.queue')}
          title={t('player.queue')}
        >
          <Icon name="queue" size={22} />
        </Link>
      </div>
    </section>
  );
}
