import { useState, type CSSProperties } from 'react';
import { usePlayer, usePlayerState } from '../app/context';
import { currentItem } from '../player/queue';
import { useT } from '../i18n';
import { formatDuration } from './format';
import styles from './ProgressBar.module.css';

/** Fortschritt mit Spulen. Beim Ziehen wird erst beim Loslassen gesprungen (kein Stottern). */
export function ProgressBar() {
  const t = useT();
  const player = usePlayer();
  const position = usePlayerState((s) => s.positionMs);
  const duration = usePlayerState((s) => s.durationMs);
  const hasTrack = usePlayerState((s) => s.queue.index >= 0);
  const live = usePlayerState((s) => !!currentItem(s.queue)?.track.live);
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? position;
  const max = Math.max(duration, 1);
  const fill = `${Math.min(100, (value / max) * 100)}%`;

  const commit = () => {
    if (drag !== null) player.seek(drag);
    setDrag(null);
  };

  if (live) {
    return (
      <div className={styles.live} title={t('player.liveHint')}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span>{t('player.live')}</span>
        <span className="kr-visually-hidden">{t('player.liveHint')}</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <input
        type="range"
        className="kr-range"
        min={0}
        max={max}
        step={1000}
        value={Math.min(value, max)}
        disabled={!hasTrack || duration <= 0}
        aria-label={t('player.position')}
        aria-valuetext={t('player.positionText', {
          pos: formatDuration(value),
          dur: formatDuration(duration),
        })}
        style={{ '--kr-range-fill': fill } as CSSProperties}
        onPointerDown={() => setDrag(position)}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (drag === null)
            player.seek(v); // Tastatur: sofort springen
          else setDrag(v);
        }}
        onPointerUp={commit}
        onPointerCancel={commit}
        onBlur={commit}
      />
      <div className={styles.times} aria-hidden="true">
        <span>{formatDuration(value)}</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  );
}
