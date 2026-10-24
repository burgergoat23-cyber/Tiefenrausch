import { describe, expect, it } from 'vitest';
import { seededRandom, tracks } from '../test/fixtures';
import {
  addToEnd,
  clearUpcoming,
  currentItem,
  cycleRepeat,
  emptyQueue,
  move,
  nextIndex,
  playNext,
  prevIndex,
  removeAt,
  setQueue,
  setRepeat,
  setShuffle,
  shuffled,
  type QueueState,
} from './queue';

const ids = (q: QueueState) => q.items.map((i) => i.track.id);

describe('Warteschlange – Grundlagen', () => {
  it('startet leer', () => {
    const q = emptyQueue();
    expect(q.index).toBe(-1);
    expect(currentItem(q)).toBeUndefined();
    expect(nextIndex(q, true)).toBeNull();
    expect(prevIndex(q)).toBeNull();
  });

  it('setQueue beginnt beim gewählten Song', () => {
    const q = setQueue(emptyQueue(), tracks('a', 'b', 'c'), 1);
    expect(ids(q)).toEqual(['a', 'b', 'c']);
    expect(currentItem(q)?.track.id).toBe('b');
  });

  it('jeder Eintrag hat eine eigene uid, auch bei doppelten Songs', () => {
    const q = setQueue(emptyQueue(), tracks('a', 'a', 'a'));
    expect(new Set(q.items.map((i) => i.uid)).size).toBe(3);
  });

  it('Als Nächstes spielen fügt direkt hinter dem aktuellen Song ein', () => {
    let q = setQueue(emptyQueue(), tracks('a', 'b', 'c'), 0);
    q = playNext(q, tracks('x'));
    expect(ids(q)).toEqual(['a', 'x', 'b', 'c']);
    expect(currentItem(q)?.track.id).toBe('a');
  });

  it('Ans Ende hängt hinten an; bei leerer Schlange wird der erste Song aktuell', () => {
    let q = addToEnd(emptyQueue(), tracks('a'));
    expect(currentItem(q)?.track.id).toBe('a');
    q = addToEnd(q, tracks('b', 'c'));
    expect(ids(q)).toEqual(['a', 'b', 'c']);
  });

  it('Umsortieren behält den aktuellen Song', () => {
    let q = setQueue(emptyQueue(), tracks('a', 'b', 'c', 'd'), 1);
    q = move(q, 3, 2); // d vor c
    expect(ids(q)).toEqual(['a', 'b', 'd', 'c']);
    expect(currentItem(q)?.track.id).toBe('b');
    q = move(q, 1, 3); // aktuellen Song nach hinten
    expect(ids(q)).toEqual(['a', 'd', 'c', 'b']);
    expect(currentItem(q)?.track.id).toBe('b');
  });

  it('ungültiges Umsortieren ändert nichts', () => {
    const q = setQueue(emptyQueue(), tracks('a', 'b'));
    expect(move(q, 0, 5)).toBe(q);
    expect(move(q, 1, 1)).toBe(q);
  });

  it('Entfernen vor dem aktuellen Song verschiebt den Index', () => {
    let q = setQueue(emptyQueue(), tracks('a', 'b', 'c'), 2);
    q = removeAt(q, 0);
    expect(ids(q)).toEqual(['b', 'c']);
    expect(currentItem(q)?.track.id).toBe('c');
  });

  it('Entfernen des aktuellen Songs lässt den nächsten nachrücken', () => {
    let q = setQueue(emptyQueue(), tracks('a', 'b', 'c'), 1);
    q = removeAt(q, 1);
    expect(currentItem(q)?.track.id).toBe('c');
    q = removeAt(q, 1); // letzter, aktueller → vorheriger
    expect(currentItem(q)?.track.id).toBe('a');
    q = removeAt(q, 0);
    expect(q.index).toBe(-1);
  });

  it('Als Nächstes leeren entfernt nur die kommenden Songs', () => {
    let q = setQueue(emptyQueue(), tracks('a', 'b', 'c', 'd'), 1);
    q = clearUpcoming(q);
    expect(ids(q)).toEqual(['a', 'b']);
    expect(currentItem(q)?.track.id).toBe('b');
  });
});

describe('Warteschlange – Wiederholen', () => {
  const base = setQueue(emptyQueue(), tracks('a', 'b', 'c'), 2);

  it('aus: am Ende ist Schluss', () => {
    expect(nextIndex(base, true)).toBeNull();
    expect(nextIndex(base, false)).toBeNull();
    expect(prevIndex({ ...base, index: 0 })).toBeNull();
  });

  it('alle: vom letzten zum ersten und zurück', () => {
    const q = setRepeat(base, 'all');
    expect(nextIndex(q, true)).toBe(0);
    expect(prevIndex({ ...q, index: 0 })).toBe(2);
  });

  it('einer: automatisch derselbe Song, Weiter-Knopf geht weiter', () => {
    const q = setRepeat({ ...base, index: 1 }, 'one');
    expect(nextIndex(q, true)).toBe(1);
    expect(nextIndex(q, false)).toBe(2);
  });

  it('Knopf schaltet aus → alle → einer → aus', () => {
    let q = emptyQueue();
    q = cycleRepeat(q);
    expect(q.repeat).toBe('all');
    q = cycleRepeat(q);
    expect(q.repeat).toBe('one');
    q = cycleRepeat(q);
    expect(q.repeat).toBe('off');
  });
});

describe('Warteschlange – Zufall', () => {
  const list = tracks('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h');

  it('Fisher-Yates behält alle Elemente', () => {
    const r = shuffled([1, 2, 3, 4, 5, 6], seededRandom(1));
    expect([...r].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('mischt gleichmäßig (jede Position etwa gleich oft)', () => {
    const rnd = seededRandom(7);
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[shuffled(['x', 'y', 'z'], rnd).indexOf('x')]! += 1;
    for (const c of counts) expect(c).toBeGreaterThan(850);
  });

  it('Zufall an: aktueller Song bleibt, der Rest wird gemischt, die Reihenfolge gemerkt', () => {
    let q = setQueue(emptyQueue(), list, 2);
    const before = ids(q);
    q = setShuffle(q, true, seededRandom(3));
    expect(q.shuffle).toBe(true);
    expect(currentItem(q)?.track.id).toBe('c');
    expect(ids(q).slice(0, 3)).toEqual(['a', 'b', 'c']); // schon gespielt + aktuell unverändert
    expect([...ids(q)].sort()).toEqual([...before].sort());
    expect(ids(q)).not.toEqual(before);
    // gemerkt: mehrfaches Weiterschalten folgt immer derselben gemischten Reihenfolge
    const order = ids(q);
    expect(ids(q)).toEqual(order);
  });

  it('Zufall aus: ursprüngliche Reihenfolge kommt zurück, aktueller Song läuft weiter', () => {
    let q = setQueue(emptyQueue(), list, 0);
    q = setShuffle(q, true, seededRandom(5));
    q = { ...q, index: 4 };
    const playing = currentItem(q)?.track.id;
    q = setShuffle(q, false);
    expect(ids(q)).toEqual(list.map((t) => t.id));
    expect(currentItem(q)?.track.id).toBe(playing);
    expect(q.original).toBeNull();
  });

  it('bei Zufall startet eine neue Liste mit dem gewählten Song', () => {
    const q = setQueue({ ...emptyQueue(), shuffle: true }, list, 5, seededRandom(9));
    expect(currentItem(q)?.track.id).toBe('f');
    expect(q.index).toBe(0);
    expect(q.original).toHaveLength(list.length);
  });

  it('Songs, die während Zufall dazukommen, bleiben beim Ausschalten erhalten', () => {
    let q = setQueue(emptyQueue(), tracks('a', 'b', 'c'), 0);
    q = setShuffle(q, true, seededRandom(2));
    q = playNext(q, tracks('x'));
    q = addToEnd(q, tracks('y'));
    q = setShuffle(q, false);
    expect(ids(q)).toEqual(['a', 'x', 'b', 'c', 'y']);
  });

  it('Zufall wiederholt nichts doppelt und lässt nichts aus', () => {
    const q = setShuffle(setQueue(emptyQueue(), list, 0), true, seededRandom(11));
    expect(new Set(ids(q)).size).toBe(list.length);
  });
});
