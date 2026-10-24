import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useDialogs } from '../app/dialogStore';
import { useToasts } from '../app/toastStore';
import { Icon } from '../components/Icon';
import { TrackList } from '../components/TrackList';
import type { ExtraMenuItem } from '../components/TrackMenu';
import { useT } from '../i18n';
import { useLibrary, usePlaylist } from '../library/libraryStore';
import { LocalHeader } from '../library/ui/LocalHeader';
import { PlaylistArt } from '../library/ui/PlaylistArt';
import { SortableTracks } from '../library/ui/SortableTracks';
import { SharePlaylistButton } from '../share/ShareButtons';
import type { Track } from '../sources/types';

export default function LocalPlaylistPage() {
  const t = useT();
  const { id = '' } = useParams();
  const pl = usePlaylist(id);
  const ready = useLibrary((s) => s.ready);
  const remove = useLibrary((s) => s.removeFromPlaylist);
  const move = useLibrary((s) => s.moveInPlaylist);
  const del = useLibrary((s) => s.deletePlaylist);
  const openDialog = useDialogs((s) => s.open);
  const toast = useToasts((s) => s.show);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const menuExtra = useCallback(
    (_track: Track, index: number): ExtraMenuItem[] => [
      { label: t('library.removeFromPlaylist'), icon: 'trash', onSelect: () => remove(id, index) },
    ],
    [t, remove, id],
  );

  if (!pl)
    return (
      <div className="kr-page">
        <p className="kr-muted">{ready ? t('library.playlistMissing') : t('app.loading')}</p>
      </div>
    );

  return (
    <div className="kr-page">
      <LocalHeader
        art={<PlaylistArt playlist={pl} size={160} />}
        kind={t('library.local')}
        title={pl.name}
        tracks={pl.tracks}
        actions={
          <>
            {pl.tracks.length > 0 && (
              <button
                type="button"
                className="kr-icon-btn"
                aria-pressed={editing}
                aria-label={editing ? t('library.done') : t('library.reorder')}
                title={editing ? t('library.done') : t('library.reorder')}
                onClick={() => setEditing((e) => !e)}
              >
                <Icon name={editing ? 'check' : 'grip'} size={22} />
              </button>
            )}
            <button
              type="button"
              className="kr-icon-btn"
              aria-label={t('library.rename')}
              title={t('library.rename')}
              onClick={() => openDialog({ kind: 'renamePlaylist', id })}
            >
              <Icon name="edit" size={22} />
            </button>
            <SharePlaylistButton name={pl.name} tracks={pl.tracks} />
            <button
              type="button"
              className="kr-icon-btn"
              aria-label={t('library.delete')}
              title={t('library.delete')}
              onClick={() => {
                if (!window.confirm(t('library.deleteConfirm', { name: pl.name }))) return;
                del(id);
                toast('library.deleted', { name: pl.name });
                navigate('/bibliothek');
              }}
            >
              <Icon name="trash" size={22} />
            </button>
          </>
        }
      />
      {pl.tracks.length === 0 ? (
        <p className="kr-muted">{t('library.playlistEmpty')}</p>
      ) : editing ? (
        <SortableTracks
          tracks={pl.tracks}
          label={pl.name}
          onMove={(from, to) => move(id, from, to)}
          onRemove={(i) => remove(id, i)}
        />
      ) : (
        <TrackList tracks={pl.tracks} label={pl.name} menuExtra={menuExtra} />
      )}
    </div>
  );
}
