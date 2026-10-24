import { useMemo } from 'react';
import { Artwork } from '../components/Artwork';
import { TrackList } from '../components/TrackList';
import { useT } from '../i18n';
import { useLibrary } from '../library/libraryStore';
import { LocalHeader } from '../library/ui/LocalHeader';

export default function LikedPage() {
  const t = useT();
  const likes = useLibrary((s) => s.data.likes);
  const tracks = useMemo(() => likes.map((l) => l.track), [likes]);
  const title = t('library.liked');
  return (
    <div className="kr-page">
      <LocalHeader
        art={<Artwork srcs={[]} seed="liked-songs" title={title} size={160} />}
        kind={t('library.title')}
        title={title}
        tracks={tracks}
      />
      {tracks.length === 0 ? (
        <p className="kr-muted">{t('library.likedEmpty')}</p>
      ) : (
        <TrackList tracks={tracks} label={title} />
      )}
    </div>
  );
}
