import type { Track } from '../sources/types';

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueItem {
  /** eigene ID pro Eintrag – derselbe Song darf mehrmals in der Warteschlange stehen */
  uid: string;
  track: Track;
}

/**
 * Die Warteschlange als reiner Zustand (ohne Audio).
 * `items` ist die Reihenfolge, in der gespielt wird – genau so zeigt sie die Oberfläche.
 */
export interface QueueState {
  items: QueueItem[];
  /** aktuelle Position in `items`, -1 = leer */
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Ursprüngliche Reihenfolge (uids), solange Zufall an ist – zum Zurückstellen */
  original: string[] | null;
}

export type Random = () => number;

export function emptyQueue(): QueueState {
  return { items: [], index: -1, shuffle: false, repeat: 'off', original: null };
}

let uidCounter = 0;
export function makeUid(): string {
  uidCounter += 1;
  return `q${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function toItems(tracks: Track[]): QueueItem[] {
  return tracks.map((track) => ({ uid: makeUid(), track }));
}

/** Fisher-Yates: echtes, gleichmäßiges Mischen */
export function shuffled<T>(arr: readonly T[], random: Random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function currentItem(state: QueueState): QueueItem | undefined {
  return state.index >= 0 ? state.items[state.index] : undefined;
}

export function upcomingItems(state: QueueState): QueueItem[] {
  return state.items.slice(state.index + 1);
}

/** Neue Warteschlange, z. B. „Album abspielen“. Bei Zufall startet der gewählte Song, der Rest wird gemischt. */
export function setQueue(
  state: QueueState,
  tracks: Track[],
  startIndex = 0,
  random: Random = Math.random,
): QueueState {
  const items = toItems(tracks);
  if (items.length === 0) return { ...state, items: [], index: -1, original: null };
  const start = clamp(startIndex, 0, items.length - 1);
  if (!state.shuffle) return { ...state, items, index: start, original: null };
  const first = items[start] as QueueItem;
  const rest = items.filter((_, i) => i !== start);
  return {
    ...state,
    items: [first, ...shuffled(rest, random)],
    index: 0,
    original: items.map((i) => i.uid),
  };
}

/**
 * Welcher Eintrag kommt als Nächstes? `auto` = der Song ist von selbst zu Ende.
 * Bei „Wiederholen: einer“ wiederholt sich nur das automatische Weiterspielen; der Weiter-Knopf geht weiter.
 * null = Ende der Warteschlange.
 */
export function nextIndex(state: QueueState, auto: boolean): number | null {
  if (state.items.length === 0) return null;
  if (auto && state.repeat === 'one') return Math.max(0, state.index);
  if (state.index + 1 < state.items.length) return state.index + 1;
  if (state.repeat !== 'off') return 0;
  return null;
}

export function prevIndex(state: QueueState): number | null {
  if (state.items.length === 0) return null;
  if (state.index > 0) return state.index - 1;
  if (state.repeat !== 'off') return state.items.length - 1;
  return null;
}

export function jumpTo(state: QueueState, index: number): QueueState {
  if (state.items.length === 0) return { ...state, index: -1 };
  return { ...state, index: clamp(index, 0, state.items.length - 1) };
}

function insertAfterUid(order: string[], afterUid: string | undefined, uids: string[]): string[] {
  const pos = afterUid ? order.indexOf(afterUid) : -1;
  return [...order.slice(0, pos + 1), ...uids, ...order.slice(pos + 1)];
}

/** „Als Nächstes spielen“: direkt hinter den aktuellen Song */
export function playNext(state: QueueState, tracks: Track[]): QueueState {
  const add = toItems(tracks);
  if (add.length === 0) return state;
  const cur = currentItem(state);
  const at = state.index + 1;
  const items = [...state.items.slice(0, at), ...add, ...state.items.slice(at)];
  const original = state.original
    ? insertAfterUid(
        state.original,
        cur?.uid,
        add.map((i) => i.uid),
      )
    : null;
  return { ...state, items, index: Math.max(0, state.index), original };
}

/** „Ans Ende der Warteschlange“ */
export function addToEnd(state: QueueState, tracks: Track[]): QueueState {
  const add = toItems(tracks);
  if (add.length === 0) return state;
  return {
    ...state,
    items: [...state.items, ...add],
    index: Math.max(0, state.index),
    original: state.original ? [...state.original, ...add.map((i) => i.uid)] : null,
  };
}

/** Umsortieren (Drag & Drop). Der aktuelle Song bleibt der aktuelle Song. */
export function move(state: QueueState, from: number, to: number): QueueState {
  const n = state.items.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return state;
  const cur = currentItem(state);
  const items = [...state.items];
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved as QueueItem);
  const index = cur ? items.findIndex((i) => i.uid === cur.uid) : state.index;
  return { ...state, items, index };
}

/** Entfernt einen Eintrag. Wird der aktuelle entfernt, rückt der nächste nach. */
export function removeAt(state: QueueState, at: number): QueueState {
  if (at < 0 || at >= state.items.length) return state;
  const removed = state.items[at] as QueueItem;
  const items = state.items.filter((_, i) => i !== at);
  let index = state.index;
  if (at < state.index) index -= 1;
  if (items.length === 0) index = -1;
  else index = clamp(index, 0, items.length - 1);
  const original = state.original ? state.original.filter((u) => u !== removed.uid) : null;
  return { ...state, items, index, original };
}

/** Alles nach dem aktuellen Song entfernen */
export function clearUpcoming(state: QueueState): QueueState {
  const keep = state.items.slice(0, state.index + 1);
  const keepIds = new Set(keep.map((i) => i.uid));
  return {
    ...state,
    items: keep,
    original: state.original ? state.original.filter((u) => keepIds.has(u)) : null,
  };
}

/**
 * Zufall an: Alles nach dem aktuellen Song wird gemischt, die ursprüngliche Reihenfolge gemerkt.
 * Zufall aus: ursprüngliche Reihenfolge zurück, der aktuelle Song läuft weiter.
 */
export function setShuffle(
  state: QueueState,
  on: boolean,
  random: Random = Math.random,
): QueueState {
  if (on === state.shuffle) return state;
  if (on) {
    const head = state.items.slice(0, state.index + 1);
    const tail = state.items.slice(state.index + 1);
    return {
      ...state,
      shuffle: true,
      items: [...head, ...shuffled(tail, random)],
      original: state.items.map((i) => i.uid),
    };
  }
  const cur = currentItem(state);
  const byUid = new Map(state.items.map((i) => [i.uid, i]));
  const restored: QueueItem[] = [];
  for (const uid of state.original ?? []) {
    const item = byUid.get(uid);
    if (item) {
      restored.push(item);
      byUid.delete(uid);
    }
  }
  // Was nicht in der alten Reihenfolge war, kommt ans Ende
  for (const item of state.items) if (byUid.has(item.uid)) restored.push(item);
  const index = cur ? restored.findIndex((i) => i.uid === cur.uid) : state.index;
  return { ...state, shuffle: false, items: restored, index, original: null };
}

export function setRepeat(state: QueueState, repeat: RepeatMode): QueueState {
  return { ...state, repeat };
}

export function cycleRepeat(state: QueueState): QueueState {
  const next: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };
  return setRepeat(state, next[state.repeat]);
}
