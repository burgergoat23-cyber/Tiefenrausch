import type { ReactNode } from 'react';
import { memo, useCallback } from 'react';
import { usePlayer, usePlayerState } from '../app/context';
import { useT } from '../i18n';
import { currentItem } from '../player/queue';
import { trackKey, type Track } from '../sources/types';
import { TrackArtwork } from './Artwork';
import { Icon } from './Icon';
import { SourceBadge } from './SourceBadge';
import { trackPlayLabel } from './trackLabel';
import { TrackMenu } from './TrackMenu';
import styles from './Shelf.module.css';

/** Reihe zum seitlichen Wischen (wie bei Spotify) */
export function Shelf({
  title,
  level = 2,
  actions,
  children,
  testId,
}: {
  title: string;
  level?: 2 | 3;
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section className={styles.shelf} aria-label={title} data-testid={testId}>
      <div className={styles.head}>
        <Heading className={styles.title}>{title}</Heading>
        {actions}
      </div>
      <ul className={styles.row}>{children}</ul>
    </section>
  );
}

const TrackCard = memo(function TrackCard({
  track,
  index,
  active,
  onPlay,
}: {
  track: Track;
  index: number;
  active: boolean;
  onPlay(index: number): void;
}) {
  const t = useT();
  const artists = track.artists.join(', ') || t('track.unknownArtist');
  return (
    <li className={styles.item} data-active={active || undefined}>
      <button
        type="button"
        className={styles.cardMain}
        aria-label={trackPlayLabel(t, track)}
        aria-current={active ? 'true' : undefined}
        onClick={() => onPlay(index)}
      >
        <span className={styles.cover}>
          <TrackArtwork track={track} size="100%" className={styles.coverImg} />
          <span className={styles.playHint} aria-hidden="true">
            <Icon name="play" size={22} />
          </span>
        </span>
        <span className={styles.cardTitle}>{track.title}</span>
      </button>
      <div className={styles.meta}>
        <SourceBadge sourceId={track.sourceId} />
        <span className={styles.artist}>{track.live ? t('player.live') : artists}</span>
        <TrackMenu track={track} />
      </div>
    </li>
  );
});

/** Songs als Cover-Kacheln. Antippen spielt den Song und stellt die ganze Reihe in die Warteschlange. */
export function TrackShelf({
  title,
  tracks,
  level,
  actions,
  testId,
}: {
  title: string;
  tracks: Track[];
  level?: 2 | 3;
  actions?: ReactNode;
  testId?: string;
}) {
  const player = usePlayer();
  const currentKey = usePlayerState((s) => {
    const item = currentItem(s.queue);
    return item ? trackKey(item.track) : null;
  });
  const onPlay = useCallback((index: number) => player.playTracks(tracks, index), [player, tracks]);
  return (
    <Shelf title={title} level={level} actions={actions} testId={testId}>
      {tracks.map((track, i) => (
        <TrackCard
          key={`${trackKey(track)}-${i}`}
          track={track}
          index={i}
          active={currentKey === trackKey(track)}
          onPlay={onPlay}
        />
      ))}
    </Shelf>
  );
}

/** Vier Cover als Collage (z. B. für „Für dich“) */
export function CoverMosaic({ tracks }: { tracks: Track[] }) {
  const four = tracks.slice(0, 4);
  return (
    <span className={styles.mosaic} aria-hidden="true">
      {four.map((t, i) => (
        <TrackArtwork
          key={`${trackKey(t)}-${i}`}
          track={t}
          size="100%"
          className={styles.mosaicImg}
        />
      ))}
    </span>
  );
}
