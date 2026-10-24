import { useEffect, useRef } from 'react';
import { usePlayer, usePlayerState } from '../app/context';
import { Icon } from '../components/Icon';
import { useT } from '../i18n';
import type { Track } from '../sources/types';
import { activeLine, useLyrics, type LyricLine } from './lyrics';
import styles from './LyricsView.module.css';

/** Zeilen etwas früher hervorheben – fühlt sich beim Mitsingen natürlicher an */
const LEAD_MS = 250;
/** Nach eigenem Scrollen so lange nicht automatisch mitscrollen */
const MANUAL_SCROLL_PAUSE_MS = 4000;

function SyncedLyrics({ lines }: { lines: LyricLine[] }) {
  const t = useT();
  const player = usePlayer();
  const pos = usePlayerState((s) => s.positionMs);
  const active = activeLine(lines, pos + LEAD_MS);
  const boxRef = useRef<HTMLOListElement>(null);
  const manualUntil = useRef(0);

  useEffect(() => {
    if (Date.now() < manualUntil.current) return;
    const box = boxRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-line="${Math.max(0, active)}"]`);
    if (!box || !el) return;
    const top = el.offsetTop - box.clientHeight * 0.35;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top, behavior: calm ? 'auto' : 'smooth' });
  }, [active]);

  const markManual = () => {
    manualUntil.current = Date.now() + MANUAL_SCROLL_PAUSE_MS;
  };

  return (
    <ol
      ref={boxRef}
      className={styles.lines}
      aria-label={t('lyrics.title')}
      onWheel={markManual}
      onTouchMove={markManual}
      onPointerMove={(e) => {
        // Mit der Maus über dem Text: nicht wegscrollen, damit man die Zeile auch trifft
        if (e.pointerType === 'mouse') markManual();
      }}
      data-testid="lyrics-synced"
    >
      {lines.map((l, i) => (
        <li key={i} data-line={i}>
          <button
            type="button"
            className={styles.line}
            data-state={i === active ? 'active' : i < active ? 'past' : 'future'}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => {
              manualUntil.current = 0;
              player.seek(l.timeMs);
            }}
          >
            {l.text || '♪'}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Songtext zum laufenden Song: synchron (läuft mit, Zeile antippen = dorthin springen) oder als Text */
export function LyricsView({ track, compact = false }: { track: Track; compact?: boolean }) {
  const t = useT();
  const [state, retry] = useLyrics(track, true);
  return (
    <div className={styles.wrap} data-compact={compact || undefined} data-testid="lyrics">
      {state.status === 'loading' && <p className={styles.note}>{t('lyrics.loading')}</p>}
      {state.status === 'none' && <p className={styles.note}>{t('lyrics.none')}</p>}
      {state.status === 'error' && (
        <div className={styles.note}>
          <p>{t('lyrics.error')}</p>
          <button type="button" className="kr-btn" onClick={retry}>
            <Icon name="refresh" size={18} />
            {t('search.retry')}
          </button>
        </div>
      )}
      {state.status === 'done' &&
        (state.lyrics.instrumental && !state.lyrics.synced && !state.lyrics.plain ? (
          <p className={styles.note}>{t('lyrics.instrumental')}</p>
        ) : state.lyrics.synced ? (
          <SyncedLyrics lines={state.lyrics.synced} />
        ) : (
          <div className={styles.plain} data-testid="lyrics-plain">
            {state.lyrics.plain}
          </div>
        ))}
      {state.status === 'done' && (
        <p className={styles.credit}>
          {t('lyrics.credit')}{' '}
          <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer">
            LRCLIB
          </a>
        </p>
      )}
    </div>
  );
}
