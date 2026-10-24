import { create } from 'zustand';
import type { Track } from '../sources/types';

export type DialogRequest =
  | { kind: 'addToPlaylist'; tracks: Track[] }
  | { kind: 'newPlaylist'; tracks?: Track[] }
  | { kind: 'renamePlaylist'; id: string }
  | { kind: 'sleepTimer' }
  | { kind: 'shortcuts' };

interface DialogStore {
  current: DialogRequest | null;
  open(req: DialogRequest): void;
  close(): void;
}

/** Es ist immer höchstens ein Fenster offen; DialogHost zeigt es an */
export const useDialogs = create<DialogStore>()((set) => ({
  current: null,
  open: (current) => set({ current }),
  close: () => set({ current: null }),
}));
