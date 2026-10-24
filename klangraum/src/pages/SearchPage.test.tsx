import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useSettings } from '../app/settingsStore';
import { defaultSettings } from '../storage/settings';
import { emptyResult, SourceError, type MusicSource, type SearchResult } from '../sources/types';
import { renderWithServices } from '../test/renderApp';
import { track } from '../test/fixtures';
import SearchPage from './SearchPage';

function source(
  id: 'audius' | 'jamendo',
  search: (q: string) => Promise<SearchResult>,
): MusicSource {
  return {
    id,
    name: id === 'audius' ? 'Audius' : 'Jamendo',
    needsLogin: false,
    playbackMode: 'url',
    canUseWebAudio: true,
    allowsOfflineCache: false,
    isAvailable: async () => true,
    search,
    getTrack: async (tid) => track(tid),
    getStreamUrl: async (t) => `https://stream.test/${t.id}`,
  };
}

describe('Suche', () => {
  it('zeigt Ergebnisse nach und nach – eine langsame Quelle blockiert nicht', async () => {
    useSettings.setState({ settings: { ...defaultSettings(), language: 'de' } });
    let releaseSlow: (r: SearchResult) => void = () => {};
    const fast = source('audius', async () => ({
      ...emptyResult(),
      tracks: [track('schnell', { title: 'Schneller Song' })],
    }));
    const slow = source('jamendo', () => new Promise((r) => (releaseSlow = r)));
    renderWithServices(<SearchPage />, [fast, slow], '/?q=test');

    expect(await screen.findByText('Schneller Song')).toBeInTheDocument();
    expect(screen.getByText('Jamendo sucht …')).toBeInTheDocument();

    await act(async () => {
      releaseSlow({
        ...emptyResult(),
        tracks: [track('lahm', { sourceId: 'jamendo', title: 'Langsamer Song' })],
      });
    });
    expect(await screen.findByText('Langsamer Song')).toBeInTheDocument();
  });

  it('freundliche Meldung, wenn eine Quelle ausfällt – die andere zeigt trotzdem Ergebnisse', async () => {
    useSettings.setState({ settings: { ...defaultSettings(), language: 'de' } });
    const broken = source('audius', async () => {
      throw new SourceError('audius', 'network');
    });
    const fine = source('jamendo', async () => ({
      ...emptyResult(),
      tracks: [track('j', { sourceId: 'jamendo', title: 'Freier Song' })],
    }));
    renderWithServices(<SearchPage />, [broken, fine], '/?q=test');
    expect(
      await screen.findByText('Audius antwortet gerade nicht – versuch es gleich nochmal.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Freier Song')).toBeInTheDocument();
  });

  it('Antippen spielt den Song und merkt sich die Suche', async () => {
    useSettings.setState({ settings: { ...defaultSettings(), language: 'de' } });
    const user = userEvent.setup();
    const src = source('audius', async () => ({
      ...emptyResult(),
      tracks: [track('a', { title: 'Erster' }), track('b', { title: 'Zweiter' })],
    }));
    const { player, output } = renderWithServices(<SearchPage />, [src], '/?q=lied');
    await user.click(await screen.findByRole('button', { name: /„Zweiter“ abspielen/ }));
    await waitFor(() => expect(output.loaded).toEqual(['https://stream.test/b']));
    expect(player.state.queue.items).toHaveLength(2);
    expect(useSettings.getState().settings.searchHistory).toEqual(['lied']);
  });
});
