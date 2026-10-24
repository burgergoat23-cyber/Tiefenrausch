import { describe, expect, it } from 'vitest';
import { track } from '../test/fixtures';
import { emptyLibrary, recordPlay, toggleLike } from './library';
import { localMixes } from './mixes';
import { DAY_MS } from './stats';

describe('Eigene Mixe', () => {
  it('Auf Repeat, Lieblingssongs, Wiederentdecken – nur mit genug Songs', () => {
    const now = 100 * DAY_MS;
    let lib = emptyLibrary();
    expect(localMixes(lib, now)).toEqual([]);
    for (const id of ['a', 'b', 'c']) {
      lib = recordPlay(lib, track(id), 1, now - DAY_MS);
      lib = recordPlay(lib, track(id), 1, now - 2 * DAY_MS);
      lib = toggleLike(lib, track(id), 1);
    }
    for (const id of ['x', 'y', 'z']) {
      lib = recordPlay(lib, track(id), 1, now - 50 * DAY_MS);
      lib = recordPlay(lib, track(id), 1, now - 60 * DAY_MS);
    }
    const mixes = localMixes(lib, now);
    expect(mixes.map((m) => m.kind)).toEqual(['repeat', 'liked', 'rediscover']);
    expect(mixes[2]?.tracks.map((t) => t.id).sort()).toEqual(['x', 'y', 'z']);
  });
});
