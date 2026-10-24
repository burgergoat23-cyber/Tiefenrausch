import type { CSSProperties } from 'react';
import { usePlayer, usePlayerState } from '../app/context';
import { useT } from '../i18n';
import { Icon } from './Icon';
import styles from './VolumeControl.module.css';

/** Lautstärke. Auf iPhone/iPad geht das per Webseite nicht – dann ehrlicher Hinweis statt Regler. */
export function VolumeControl() {
  const t = useT();
  const player = usePlayer();
  const volume = usePlayerState((s) => s.volume);
  const muted = usePlayerState((s) => s.muted);
  if (!player.canSetVolume()) {
    return <p className={styles.hint}>{t('player.volumeFixed')}</p>;
  }
  const shown = muted ? 0 : volume;
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className="kr-icon-btn"
        aria-label={muted ? t('player.unmute') : t('player.mute')}
        title={muted ? t('player.unmute') : t('player.mute')}
        aria-pressed={muted}
        onClick={() => player.toggleMute()}
      >
        <Icon name={muted || volume === 0 ? 'mute' : 'volume'} size={22} />
      </button>
      <input
        type="range"
        className="kr-range"
        min={0}
        max={100}
        step={1}
        value={Math.round(shown * 100)}
        aria-label={t('player.volume')}
        aria-valuetext={`${Math.round(shown * 100)} %`}
        style={{ '--kr-range-fill': `${shown * 100}%` } as CSSProperties}
        onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
      />
    </div>
  );
}
