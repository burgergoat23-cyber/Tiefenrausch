import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { usePlayer, usePlayerState } from '../app/context';
import { useT } from '../i18n';
import { currentItem } from '../player/queue';
import { useVideoDock } from '../player/videoDock';
import { Icon } from './Icon';
import styles from './VideoDock.module.css';

/**
 * Hält das YouTube-Video sichtbar: groß im Vollbild-Player, sonst als kleines Fenster
 * über dem Mini-Player (YouTube verlangt, dass das Video sichtbar bleibt, mind. 200 × 200 px).
 */
export function VideoDock() {
  const t = useT();
  const player = usePlayer();
  const location = useLocation();
  const isVideo = usePlayerState((s) => currentItem(s.queue)?.track.sourceId === 'youtube');
  const playing = usePlayerState((s) => s.status === 'playing' || s.status === 'loading');
  const host = useVideoDock((s) => s.host);
  const fullSlot = useVideoDock((s) => s.fullSlot);
  const [closed, setClosed] = useState(false);
  const [floatSlot, setFloatSlot] = useState<HTMLDivElement | null>(null);
  const inFull = location.pathname === '/player';

  // Spielt wieder etwas (z. B. über den Mini-Player), kommt das Fenster zurück
  useEffect(() => {
    if (playing) setClosed(false);
  }, [playing]);

  const showFloat = isVideo && !inFull && !closed;
  const target = !isVideo ? null : inFull ? fullSlot : showFloat ? floatSlot : null;

  useEffect(() => {
    document.documentElement.toggleAttribute('data-video-float', showFloat);
    return () => document.documentElement.removeAttribute('data-video-float');
  }, [showFloat]);

  // Das Video-Fenster folgt genau seinem Platzhalter (auch beim Scrollen oder Drehen des Geräts)
  useEffect(() => {
    if (!host) return;
    if (!target) {
      Object.assign(host.style, { visibility: 'hidden', width: '0px', height: '0px' });
      return;
    }
    host.style.visibility = 'visible';
    let raf = 0;
    let last = '';
    const follow = () => {
      const r = target.getBoundingClientRect();
      const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
      if (key !== last) {
        last = key;
        Object.assign(host.style, {
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        });
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [host, target]);

  if (!showFloat) return null;
  return (
    <section className={styles.float} aria-label={t('video.dock')} data-testid="video-float">
      <div className={styles.bar}>
        <UnmuteButton compact />
        <Link
          to="/player"
          className="kr-icon-btn"
          aria-label={t('video.expand')}
          title={t('video.expand')}
        >
          <Icon name="expand" size={20} />
        </Link>
        <button
          type="button"
          className="kr-icon-btn"
          aria-label={t('video.close')}
          title={t('video.close')}
          onClick={() => {
            player.pause();
            setClosed(true);
          }}
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      <div ref={setFloatSlot} className={styles.video} />
    </section>
  );
}

/** Platzhalter im Vollbild-Player – das Video legt sich genau darüber */
export function VideoSlot({ className }: { className?: string }) {
  const setFullSlot = useVideoDock((s) => s.setFullSlot);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setFullSlot(el);
    return () => setFullSlot(null);
  }, [el, setFullSlot]);
  return <div ref={setEl} className={className} data-testid="video-slot" />;
}

/** iPhone/iPad: Video läuft stumm, bis man einmal tippt – dieser Knopf schaltet den Ton ein */
export function UnmuteButton({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const needs = useVideoDock((s) => s.needsUnmute);
  const needsTap = useVideoDock((s) => s.needsTap);
  const unmute = useVideoDock((s) => s.unmute);
  if (needsTap && !needs)
    return (
      <span className={compact ? styles.tapHint : 'kr-muted'} role="status">
        {t('video.tapOnce')}
      </span>
    );
  if (!needs || !unmute) return null;
  return (
    <button
      type="button"
      className={`kr-btn kr-btn--primary ${compact ? styles.unmuteCompact : ''}`}
      onClick={() => unmute()}
    >
      <Icon name="volume" size={18} />
      {t('video.unmute')}
    </button>
  );
}
