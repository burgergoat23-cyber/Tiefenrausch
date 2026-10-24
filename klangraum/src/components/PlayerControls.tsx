import { usePlayer, usePlayerState } from '../app/context';
import { useT } from '../i18n';
import { Icon } from './Icon';
import styles from './PlayerControls.module.css';

export function PlayPauseButton({ big = false }: { big?: boolean }) {
  const t = useT();
  const player = usePlayer();
  const status = usePlayerState((s) => s.status);
  const hasTrack = usePlayerState((s) => s.queue.index >= 0);
  const active = status === 'playing' || status === 'loading';
  const label = active ? t('player.pause') : t('player.play');
  return (
    <button
      type="button"
      className={big ? 'kr-play-btn' : 'kr-icon-btn'}
      aria-label={label}
      title={label}
      disabled={!hasTrack}
      data-status={status}
      onClick={() => player.toggle()}
    >
      <Icon name={active ? 'pause' : 'play'} size={big ? 30 : 26} />
    </button>
  );
}

export function PrevButton() {
  const t = useT();
  const player = usePlayer();
  const hasTrack = usePlayerState((s) => s.queue.index >= 0);
  return (
    <button
      type="button"
      className="kr-icon-btn"
      aria-label={t('player.prev')}
      title={t('player.prev')}
      disabled={!hasTrack}
      onClick={() => player.prev()}
    >
      <Icon name="prev" />
    </button>
  );
}

export function NextButton() {
  const t = useT();
  const player = usePlayer();
  const canNext = usePlayerState(
    (s) =>
      s.queue.index >= 0 && (s.queue.index + 1 < s.queue.items.length || s.queue.repeat !== 'off'),
  );
  return (
    <button
      type="button"
      className="kr-icon-btn"
      aria-label={t('player.next')}
      title={t('player.next')}
      disabled={!canNext}
      onClick={() => player.next()}
    >
      <Icon name="next" />
    </button>
  );
}

export function ShuffleButton() {
  const t = useT();
  const player = usePlayer();
  const on = usePlayerState((s) => s.queue.shuffle);
  const label = on ? t('player.shuffleOn') : t('player.shuffleOff');
  return (
    <button
      type="button"
      className="kr-icon-btn"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={() => player.toggleShuffle()}
    >
      <Icon name="shuffle" size={22} />
    </button>
  );
}

export function RepeatButton() {
  const t = useT();
  const player = usePlayer();
  const mode = usePlayerState((s) => s.queue.repeat);
  const label =
    mode === 'off'
      ? t('player.repeatOff')
      : mode === 'all'
        ? t('player.repeatAll')
        : t('player.repeatOne');
  return (
    <button
      type="button"
      className="kr-icon-btn"
      aria-pressed={mode !== 'off'}
      aria-label={label}
      title={label}
      data-mode={mode}
      onClick={() => player.cycleRepeat()}
    >
      <Icon name={mode === 'one' ? 'repeatOne' : 'repeat'} size={22} />
    </button>
  );
}

/** Die komplette Knopfreihe des großen Players */
export function PlayerControls() {
  return (
    <div className={styles.row}>
      <ShuffleButton />
      <PrevButton />
      <PlayPauseButton big />
      <NextButton />
      <RepeatButton />
    </div>
  );
}
