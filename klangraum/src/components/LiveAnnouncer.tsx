import { useEffect, useState } from 'react';
import { usePlayerState } from '../app/context';
import { useT } from '../i18n';
import { currentItem } from '../player/queue';

/** Sagt Screenreadern beim Songwechsel an, was jetzt läuft */
export function LiveAnnouncer() {
  const t = useT();
  const item = usePlayerState((s) => currentItem(s.queue));
  const started = usePlayerState((s) => s.status === 'playing');
  const [text, setText] = useState('');
  const [announcedUid, setAnnouncedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!item || !started || item.uid === announcedUid) return;
    setAnnouncedUid(item.uid);
    setText(
      t('player.announce', {
        title: item.track.title,
        artist: item.track.artists.join(', ') || t('track.unknownArtist'),
      }),
    );
  }, [item, started, announcedUid, t]);

  return (
    <div
      className="kr-visually-hidden"
      aria-live="polite"
      aria-atomic="true"
      data-testid="announcer"
    >
      {text}
    </div>
  );
}
