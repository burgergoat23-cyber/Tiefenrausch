import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useToasts } from '../../app/toastStore';
import { Dialog } from '../../components/Dialog';
import styles from '../../components/Dialog.module.css';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import type { Track } from '../../sources/types';
import { MAX_NAME } from '../library';
import { useLibrary } from '../libraryStore';
import { PlaylistArt } from './PlaylistArt';

function NameForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: string;
  submitLabel: string;
  onSubmit(name: string): void;
}) {
  const t = useT();
  const [name, setName] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name);
  };
  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor="pl-name">{t('library.playlistName')}</label>
      <input
        id="pl-name"
        className="kr-input"
        value={name}
        maxLength={MAX_NAME}
        autoFocus
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
      />
      <div className={styles.row}>
        <button type="submit" className="kr-btn kr-btn--primary" disabled={!name.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function useDefaultName() {
  const t = useT();
  const count = useLibrary((s) => s.data.playlists.length);
  return t('library.defaultName', { n: count + 1 });
}

/** Neue Playlist anlegen (optional gleich mit Songs) und hinspringen */
export function NewPlaylistDialog({ tracks, onClose }: { tracks?: Track[]; onClose(): void }) {
  const t = useT();
  const create = useLibrary((s) => s.createPlaylist);
  const toast = useToasts((s) => s.show);
  const navigate = useNavigate();
  const initial = useDefaultName();
  return (
    <Dialog title={t('library.newPlaylist')} onClose={onClose}>
      <NameForm
        initial={initial}
        submitLabel={t('library.create')}
        onSubmit={(name) => {
          const id = create(name, tracks);
          onClose();
          if (tracks?.length) toast('library.added', { name: name.trim() });
          navigate(`/bibliothek/playlist/${id}`);
        }}
      />
    </Dialog>
  );
}

export function RenamePlaylistDialog({ id, onClose }: { id: string; onClose(): void }) {
  const t = useT();
  const pl = useLibrary((s) => s.data.playlists.find((p) => p.id === id));
  const rename = useLibrary((s) => s.renamePlaylist);
  if (!pl) return null;
  return (
    <Dialog title={t('library.rename')} onClose={onClose}>
      <NameForm
        initial={pl.name}
        submitLabel={t('settings.save')}
        onSubmit={(name) => {
          rename(id, name);
          onClose();
        }}
      />
    </Dialog>
  );
}

/** „Zu Playlist hinzufügen“: Liste der eigenen Playlists, oben „Neue Playlist“ */
export function AddToPlaylistDialog({ tracks, onClose }: { tracks: Track[]; onClose(): void }) {
  const t = useT();
  const playlists = useLibrary((s) => s.data.playlists);
  const add = useLibrary((s) => s.addToPlaylist);
  const create = useLibrary((s) => s.createPlaylist);
  const toast = useToasts((s) => s.show);
  const initial = useDefaultName();
  const [creating, setCreating] = useState(playlists.length === 0);

  return (
    <Dialog title={t('library.addTo')} onClose={onClose}>
      {creating ? (
        <NameForm
          initial={initial}
          submitLabel={t('library.create')}
          onSubmit={(name) => {
            create(name, tracks);
            toast('library.added', { name: name.trim() });
            onClose();
          }}
        />
      ) : (
        <ul className={styles.options}>
          <li>
            <button type="button" className={styles.option} onClick={() => setCreating(true)}>
              <Icon name="plus" size={22} />
              <span className={styles.optionText}>{t('library.newPlaylist')}</span>
            </button>
          </li>
          {playlists.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={styles.option}
                onClick={() => {
                  const n = add(p.id, tracks);
                  toast(n > 0 ? 'library.added' : 'library.alreadyIn', { name: p.name });
                  onClose();
                }}
              >
                <PlaylistArt playlist={p} size={44} />
                <span className={styles.optionText}>
                  {p.name}
                  <span className={styles.optionSub}>
                    {t('track.count', { count: p.tracks.length })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
