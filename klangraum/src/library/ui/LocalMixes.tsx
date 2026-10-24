import { useMemo } from 'react';
import { usePlayer } from '../../app/context';
import { Shelf } from '../../components/Shelf';
import shelf from '../../components/Shelf.module.css';
import { useT } from '../../i18n';
import { useLibrary } from '../libraryStore';
import { localMixes } from '../mixes';
import { PlaylistArt } from './PlaylistArt';

/** Startseite: Mixe aus deiner eigenen Bibliothek */
export function LocalMixes() {
  const t = useT();
  const player = usePlayer();
  const data = useLibrary((s) => s.data);
  const mixes = useMemo(() => localMixes(data, Date.now()), [data]);
  if (mixes.length === 0) return null;
  return (
    <Shelf title={t('mixes.title')} testId="local-mixes">
      {mixes.map((m) => {
        const name = t(`mixes.${m.kind}`);
        return (
          <li key={m.kind} className={shelf.item}>
            <button
              type="button"
              className={shelf.cardMain}
              aria-label={t('mixes.play', { name })}
              onClick={() =>
                m.shuffle ? player.playShuffled(m.tracks) : player.playTracks(m.tracks)
              }
            >
              <span className={shelf.cover}>
                <PlaylistArt playlist={{ name, tracks: m.tracks }} />
              </span>
              <span className={shelf.cardTitle}>{name}</span>
            </button>
            <div className={shelf.meta}>
              <span className={shelf.artist}>{t('track.count', { count: m.tracks.length })}</span>
            </div>
          </li>
        );
      })}
    </Shelf>
  );
}
