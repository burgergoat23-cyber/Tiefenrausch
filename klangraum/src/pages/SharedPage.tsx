import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useToasts } from '../app/toastStore';
import { Icon } from '../components/Icon';
import { TrackList } from '../components/TrackList';
import { useT } from '../i18n';
import { useLibrary } from '../library/libraryStore';
import { LocalHeader } from '../library/ui/LocalHeader';
import { PlaylistArt } from '../library/ui/PlaylistArt';
import { decodeShare } from '../share/shareLinks';

/** Geöffneter Teilen-Link: Songs ansehen, abspielen, in die eigene Bibliothek übernehmen */
export default function SharedPage() {
  const t = useT();
  const [params] = useSearchParams();
  const shared = useMemo(() => decodeShare(params.get('d') ?? ''), [params]);
  const create = useLibrary((s) => s.createPlaylist);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const toast = useToasts((s) => s.show);
  const [saved, setSaved] = useState(false);

  if (!shared)
    return (
      <div className="kr-page">
        <h1>{t('share.title')}</h1>
        <p className="kr-muted">{t('share.broken')}</p>
        <Link to="/" className="kr-btn">
          {t('errors.backHome')}
        </Link>
      </div>
    );

  const single = shared.tracks.length === 1 && !shared.name;
  const first = shared.tracks[0];
  const title = shared.name ?? first?.title ?? t('share.title');
  const save = () => {
    if (single && first) {
      if (toggleLike(first)) toast('library.likedToast', { title: first.title });
    } else {
      create(title, shared.tracks);
      toast('library.added', { name: title });
    }
    setSaved(true);
  };

  return (
    <div className="kr-page">
      <p className="kr-label">{t('share.received')}</p>
      <LocalHeader
        art={<PlaylistArt playlist={{ name: title, tracks: shared.tracks }} size={160} />}
        kind={single ? t('share.song') : t('collection.playlist')}
        title={title}
        tracks={shared.tracks}
        actions={
          <button type="button" className="kr-btn" disabled={saved} onClick={save}>
            <Icon name={saved ? 'check' : single ? 'heart' : 'listPlus'} size={18} />
            {saved ? t('share.saved') : single ? t('library.like') : t('share.save')}
          </button>
        }
      />
      <TrackList tracks={shared.tracks} label={title} />
      <p className="kr-muted">{t('share.about')}</p>
    </div>
  );
}
