import { lazy, Suspense } from 'react';
import { useDialogs } from '../app/dialogStore';
import {
  AddToPlaylistDialog,
  NewPlaylistDialog,
  RenamePlaylistDialog,
} from '../library/ui/PlaylistDialogs';

const SleepTimerDialog = lazy(() => import('../player/ui/SleepTimerDialog'));
const ShortcutsDialog = lazy(() => import('./ShortcutsDialog'));

/** Zeigt das gerade angeforderte Fenster (höchstens eins) */
export function DialogHost() {
  const current = useDialogs((s) => s.current);
  const close = useDialogs((s) => s.close);
  if (!current) return null;
  switch (current.kind) {
    case 'addToPlaylist':
      return <AddToPlaylistDialog tracks={current.tracks} onClose={close} />;
    case 'newPlaylist':
      return <NewPlaylistDialog tracks={current.tracks} onClose={close} />;
    case 'renamePlaylist':
      return <RenamePlaylistDialog id={current.id} onClose={close} />;
    case 'sleepTimer':
      return (
        <Suspense fallback={null}>
          <SleepTimerDialog onClose={close} />
        </Suspense>
      );
    case 'shortcuts':
      return (
        <Suspense fallback={null}>
          <ShortcutsDialog onClose={close} />
        </Suspense>
      );
  }
}
