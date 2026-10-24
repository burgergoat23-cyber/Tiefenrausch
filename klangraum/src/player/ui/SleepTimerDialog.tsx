import { Dialog } from '../../components/Dialog';
import styles from '../../components/Dialog.module.css';
import { formatDuration } from '../../components/format';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import {
  remainingMs,
  setSleepTimer,
  SLEEP_MINUTES,
  startSleepMinutes,
  useSleepTimer,
} from '../sleepTimer';

export default function SleepTimerDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  const mode = useSleepTimer((s) => s.mode);
  const now = useSleepTimer((s) => s.now);
  const left = remainingMs(mode, now);
  return (
    <Dialog title={t('sleep.title')} onClose={onClose}>
      {mode.kind !== 'off' && (
        <p className="kr-muted" role="status">
          {left !== null
            ? t('sleep.activeTime', { time: formatDuration(left) })
            : t('sleep.activeEnd')}
        </p>
      )}
      <ul className={styles.options}>
        {SLEEP_MINUTES.map((m) => (
          <li key={m}>
            <button
              type="button"
              className={styles.option}
              aria-pressed={mode.kind === 'time' && mode.minutes === m}
              onClick={() => {
                startSleepMinutes(m);
                onClose();
              }}
            >
              <Icon name="clock" size={20} />
              <span className={styles.optionText}>{t('sleep.minutes', { n: m })}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={styles.option}
            aria-pressed={mode.kind === 'endOfTrack'}
            onClick={() => {
              setSleepTimer({ kind: 'endOfTrack' });
              onClose();
            }}
          >
            <Icon name="note" size={20} />
            <span className={styles.optionText}>{t('sleep.endOfTrack')}</span>
          </button>
        </li>
        {mode.kind !== 'off' && (
          <li>
            <button
              type="button"
              className={styles.option}
              onClick={() => {
                setSleepTimer({ kind: 'off' });
                onClose();
              }}
            >
              <Icon name="close" size={20} />
              <span className={styles.optionText}>{t('sleep.off')}</span>
            </button>
          </li>
        )}
      </ul>
    </Dialog>
  );
}
