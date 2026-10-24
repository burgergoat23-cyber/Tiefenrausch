import { useParams } from 'react-router';
import { usePlayer, useSources } from '../app/context';
import { Artwork } from '../components/Artwork';
import { errorText } from '../components/errorText';
import { Icon } from '../components/Icon';
import type { CollectionKind } from '../components/paths';
import { SourceBadge } from '../components/SourceBadge';
import { TrackList } from '../components/TrackList';
import { useAsync } from '../components/useAsync';
import { useT } from '../i18n';
import { SourceError, sourceIdSchema, type Track } from '../sources/types';
import styles from './CollectionPage.module.css';

interface Loaded {
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  tracks: Track[];
}

/** Detailseite für Album, Künstler oder Playlist */
export default function CollectionPage({ kind }: { kind: CollectionKind }) {
  const t = useT();
  const player = usePlayer();
  const registry = useSources();
  const params = useParams();
  const parsedSource = sourceIdSchema.safeParse(params.sourceId);
  const sourceId = parsedSource.success ? parsedSource.data : 'audius';
  const id = params.id ?? '';
  const source = parsedSource.success ? registry.get(sourceId) : undefined;

  const state = useAsync(async (): Promise<Loaded> => {
    if (!source) throw new SourceError(sourceId, 'notFound');
    if (kind === 'album' && source.getAlbum) {
      const a = await source.getAlbum(id);
      return {
        title: a.title,
        subtitle: a.artists.length ? t('collection.by', { name: a.artists.join(', ') }) : undefined,
        artworkUrl: a.artworkUrl,
        tracks: a.tracks ?? [],
      };
    }
    if (kind === 'artist' && source.getArtist) {
      const a = await source.getArtist(id);
      return { title: a.name, artworkUrl: a.imageUrl, tracks: a.tracks ?? [] };
    }
    if (kind === 'playlist' && source.getPlaylist) {
      const p = await source.getPlaylist(id);
      return {
        title: p.title,
        subtitle: p.owner ? t('collection.by', { name: p.owner }) : undefined,
        artworkUrl: p.artworkUrl,
        tracks: p.tracks ?? [],
      };
    }
    throw new SourceError(sourceId, 'notFound');
  }, [source, kind, id]);

  const kindLabel = t(`collection.${kind}`);

  return (
    <div className="kr-page">
      {state.status === 'loading' && <p className="kr-muted">{t('app.loading')}</p>}
      {state.status === 'error' && (
        <div className="kr-section">
          <p className="kr-error-text">{errorText(t, state.error, sourceId)}</p>
          <div>
            <button type="button" className="kr-btn" onClick={state.reload}>
              <Icon name="refresh" size={18} />
              {t('search.retry')}
            </button>
          </div>
        </div>
      )}
      {state.status === 'done' && (
        <>
          <header className={styles.head}>
            <Artwork
              srcs={[state.data.artworkUrl, state.data.tracks[0]?.artworkUrl]}
              seed={state.data.title}
              title={state.data.title}
              label={state.data.subtitle}
              size={160}
              round={kind === 'artist'}
              className={styles.art}
            />
            <div className={styles.info}>
              <p className={styles.kind}>
                <SourceBadge sourceId={sourceId} /> {kindLabel}
              </p>
              <h1>{state.data.title}</h1>
              {state.data.subtitle && <p className="kr-muted">{state.data.subtitle}</p>}
              <p className="kr-muted">{t('track.count', { count: state.data.tracks.length })}</p>
              {state.data.tracks.length > 0 && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="kr-btn kr-btn--primary"
                    onClick={() => player.playTracks(state.data.tracks)}
                  >
                    <Icon name="play" size={18} />
                    {t('collection.playAll')}
                  </button>
                  <button
                    type="button"
                    className="kr-btn"
                    onClick={() => player.playShuffled(state.data.tracks)}
                  >
                    <Icon name="shuffle" size={18} />
                    {t('collection.shuffle')}
                  </button>
                </div>
              )}
            </div>
          </header>
          {state.data.tracks.length === 0 ? (
            <p className="kr-muted">{t('collection.empty')}</p>
          ) : (
            <TrackList tracks={state.data.tracks} label={state.data.title} />
          )}
        </>
      )}
    </div>
  );
}
