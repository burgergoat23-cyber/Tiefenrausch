import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePlayerState } from '../app/context';
import { Artwork } from '../components/Artwork';
import { Icon } from '../components/Icon';
import { PlayerControls } from '../components/PlayerControls';
import { ProgressBar } from '../components/ProgressBar';
import { SourceBadge } from '../components/SourceBadge';
import { VideoSlot } from '../components/VideoDock';
import { VolumeControl } from '../components/VolumeControl';
import { isAppleTouchDevice } from '../app/setup';
import { useT } from '../i18n';
import { currentItem } from '../player/queue';
import { sourceName } from '../sources/names';
import styles from './PlayerPage.module.css';

/** Vollbild-Player, Vorlage „Großes Cover“ (weitere Vorlagen folgen in Phase 4) */
export default function PlayerPage() {
  const t = useT();
  const navigate = useNavigate();
  const track = usePlayerState((s) => currentItem(s.queue)?.track ?? null);
  const buffering = usePlayerState((s) => s.buffering || s.status === 'loading');
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const artists = track ? track.artists.join(', ') || t('track.unknownArtist') : '';

  return (
    <section
      className={styles.overlay}
      aria-label={t('player.nowPlaying')}
      data-testid="full-player"
    >
      {track?.artworkUrl && (
        <div
          className={styles.backdrop}
          style={{ backgroundImage: `url("${track.artworkUrl}")` }}
          aria-hidden="true"
        />
      )}
      <header className={styles.top}>
        <button
          ref={closeRef}
          type="button"
          className="kr-icon-btn"
          aria-label={t('player.close')}
          onClick={close}
        >
          <Icon name="chevronDown" size={28} />
        </button>
        <span className={styles.topTitle}>{t('player.nowPlaying')}</span>
        <Link
          to="/warteschlange"
          className="kr-icon-btn"
          aria-label={t('player.queue')}
          title={t('player.queue')}
        >
          <Icon name="queue" size={24} />
        </Link>
      </header>
      {!track ? (
        <div className={styles.empty}>
          <p>{t('player.nothingPlaying')}</p>
          <p className="kr-muted">{t('player.nothingPlayingHint')}</p>
        </div>
      ) : (
        <div className={styles.body}>
          {track.sourceId === 'youtube' ? (
            <div className={styles.videoWrap}>
              <VideoSlot className={styles.video} />
              {isAppleTouchDevice() && <p className={styles.videoHint}>{t('video.tapHint')}</p>}
            </div>
          ) : (
            <div className={styles.coverWrap}>
              <Artwork src={track.artworkUrl} size="100%" className={styles.cover} />
            </div>
          )}
          <div className={styles.panel}>
            <div className={styles.info}>
              <h1 className={styles.title}>{track.title}</h1>
              <p className={styles.artist}>{buffering ? t('player.buffering') : artists}</p>
              <p className={styles.meta}>
                <SourceBadge sourceId={track.sourceId} />
                <span>{sourceName(track.sourceId)}</span>
                {track.album && <span>· {track.album}</span>}
              </p>
              {track.license && (
                <p className={styles.meta}>
                  {track.license.url ? (
                    <a href={track.license.url} target="_blank" rel="noopener noreferrer">
                      {t('track.license', { license: track.license.name })}
                    </a>
                  ) : (
                    t('track.license', { license: track.license.name })
                  )}
                  {' · '}
                  {artists}
                </p>
              )}
            </div>
            <ProgressBar />
            <PlayerControls />
            <div className={styles.volume}>
              <VolumeControl />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
