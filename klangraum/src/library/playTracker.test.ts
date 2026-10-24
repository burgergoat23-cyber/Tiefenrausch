import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { initialPlayerState, type PlayerState } from '../player/engine';
import { setQueue } from '../player/queue';
import { track } from '../test/fixtures';
import { trackPlays } from './playTracker';

function setup(durationMs = 180000) {
  const store = createStore<PlayerState>(() => ({
    ...initialPlayerState(),
    queue: setQueue(
      initialPlayerState().queue,
      [track('a', { durationMs }), track('b')],
      0,
      Math.random,
    ),
    status: 'playing',
    durationMs,
  }));
  const onPlay = vi.fn();
  const onMore = vi.fn();
  trackPlays(store, onPlay, onMore);
  store.setState({ positionMs: 0 }); // erster Durchlauf merkt sich den Song
  const tick = (to: number) => store.setState({ positionMs: to });
  return { store, onPlay, onMore, tick };
}

describe('Gehörte Songs zählen', () => {
  it('zählt nach 30 Sekunden echter Abspielzeit genau einmal', () => {
    const { onPlay, tick } = setup();
    for (let p = 1000; p <= 29000; p += 1000) tick(p);
    expect(onPlay).not.toHaveBeenCalled();
    for (let p = 30000; p <= 40000; p += 1000) tick(p);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('Spulen zählt nicht', () => {
    const { onPlay, tick } = setup();
    tick(1000);
    tick(120000);
    tick(121000);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('pausiert zählt nicht, kurze Songs zählen ab der Hälfte', () => {
    const { store, onPlay, tick } = setup(20000);
    store.setState({ status: 'paused' });
    for (let p = 1000; p <= 15000; p += 1000) tick(p);
    expect(onPlay).not.toHaveBeenCalled();
    store.setState({ status: 'playing' });
    for (let p = 16000; p <= 20000; p += 1000) tick(p);
    // 16→20 s = 4 s gehört: noch nicht die Hälfte (10 s)
    expect(onPlay).not.toHaveBeenCalled();
    tick(0);
    for (let p = 1000; p <= 6000; p += 1000) tick(p);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('meldet weitere Hörzeit beim Songwechsel', () => {
    const { store, onMore, tick } = setup();
    for (let p = 1000; p <= 45000; p += 1000) tick(p);
    store.setState({ queue: { ...store.getState().queue, index: 1 } });
    expect(onMore).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 15000);
  });
});
