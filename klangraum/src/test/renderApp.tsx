import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ServicesContext } from '../app/context';
import { PlayerEngine } from '../player/engine';
import type { OutputListener, PlaybackOutput } from '../player/output';
import { createRegistry } from '../sources/registry';
import type { MusicSource } from '../sources/types';

export class SilentOutput implements PlaybackOutput {
  readonly kind = 'url' as const;
  loaded: string[] = [];
  private l: OutputListener | null = null;
  setListener(l: OutputListener) {
    this.l = l;
  }
  load(url: string) {
    this.loaded.push(url);
  }
  async play() {
    this.l?.onPlaying();
  }
  pause() {
    this.l?.onPause();
  }
  seek() {}
  setVolume() {}
  setMuted() {}
  stop() {}
  unlock() {}
  canSetVolume() {
    return true;
  }
}

/** Rendert eine Seite mit echtem Router, echter Engine und nachgebauten Quellen */
export function renderWithServices(ui: ReactElement, sources: MusicSource[], path = '/') {
  const registry = createRegistry(sources);
  const output = new SilentOutput();
  const player = new PlayerEngine({ getSource: (id) => registry.get(id), output });
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [path] });
  const utils = render(
    <ServicesContext.Provider value={{ player, sources: registry }}>
      <RouterProvider router={router} />
    </ServicesContext.Provider>,
  );
  return { ...utils, player, output, router };
}
