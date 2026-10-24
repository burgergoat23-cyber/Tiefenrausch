import { memo, useCallback } from 'react';
import { usePlayer, usePlayerState } from '../app/context';
import { useT } from '../i18n';
import { currentItem } from '../player/queue';
import { sourceName } from '../sources/names';
import { trackKey, type Track } from '../sources/types';
import { Artwork } from './Artwork';
import { formatDuration } from './format';
import { SourceBadge } from './SourceBadge';
import { TrackMenu } from './TrackMenu';
import styles from './TrackList.module.css';

interface RowProps {
  track: Track;
  index: number;
  active: boolean;
  playing: boolean;
  onPlay(index: number): void;
}

const TrackRow = memo(function TrackRow({ track, index, active, playing, onPlay }: RowProps) {
  const t = useT();
  const artists = track.artists.join(', ') || t('track.unknownArtist');
  const label = [
    t('track.play', { title: track.title }),
    artists,
    t('track.source', { source: sourceName(track.sourceId) }),
    track.license ? t('track.license', { license: track.license.name }) : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <li className={styles.row} data-active={active || undefined}>
      <button
        type="button"
        className={styles.main}
        aria-label={label}
        aria-current={active ? 'true' : undefined}
        onClick={() => onPlay(index)}
      >
        <span className={styles.art}>
          <Artwork src={track.artworkUrl} size={44} />
          {active && playing && <span className={styles.eq} aria-hidden="true" />}
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{track.title}</span>
          <span className={styles.meta}>
            <SourceBadge sourceId={track.sourceId} />
            <span className={styles.artist}>{artists}</span>
            {track.license && <span className={styles.license}>· {track.license.name}</span>}
          </span>
        </span>
        <span className={styles.dur}>
          {track.durationMs > 0 ? formatDuration(track.durationMs) : ''}
        </span>
      </button>
      <TrackMenu track={track} />
    </li>
  );
});

interface Props {
  tracks: Track[];
  /** Wird beim Abspielen aufgerufen (z. B. um die Suche im Verlauf zu merken) */
  onPlayed?(): void;
  label?: string;
}

/** Song-Liste. Antippen spielt den Song und stellt die ganze Liste in die Warteschlange. */
export function TrackList({ tracks, onPlayed, label }: Props) {
  const player = usePlayer();
  const currentKey = usePlayerState((s) => {
    const item = currentItem(s.queue);
    return item ? trackKey(item.track) : null;
  });
  const playing = usePlayerState((s) => s.status === 'playing');
  const onPlay = useCallback(
    (index: number) => {
      player.playTracks(tracks, index);
      onPlayed?.();
    },
    [player, tracks, onPlayed],
  );
  return (
    <ol className={styles.list} aria-label={label}>
      {tracks.map((track, i) => (
        <TrackRow
          key={`${trackKey(track)}-${i}`}
          track={track}
          index={i}
          active={currentKey === trackKey(track)}
          playing={playing}
          onPlay={onPlay}
        />
      ))}
    </ol>
  );
}
