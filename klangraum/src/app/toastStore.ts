import { create } from 'zustand';
import type { TKey, TParams } from '../i18n';

export interface Toast {
  id: number;
  key: TKey;
  params?: TParams;
  tone: 'info' | 'error';
}

interface ToastStore {
  toasts: Toast[];
  show(key: TKey, params?: TParams, tone?: Toast['tone']): void;
  dismiss(id: number): void;
}

let nextId = 1;
const TIMEOUT_MS = 5000;

/** Kurze Meldungen unten am Bildschirm (Texte immer über i18n-Schlüssel) */
export const useToasts = create<ToastStore>()((set, get) => ({
  toasts: [],
  show: (key, params, tone = 'info') => {
    const id = nextId++;
    // Gleiche Meldung nicht doppelt stapeln
    const others = get().toasts.filter(
      (t) => !(t.key === key && JSON.stringify(t.params) === JSON.stringify(params)),
    );
    set({ toasts: [...others, { id, key, params, tone }].slice(-3) });
    setTimeout(() => get().dismiss(id), TIMEOUT_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
