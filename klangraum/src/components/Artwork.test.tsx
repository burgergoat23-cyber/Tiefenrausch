import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { track } from '../test/fixtures';
import { Artwork, TrackArtwork } from './Artwork';

describe('Gestaltetes Cover (ohne Bild)', () => {
  it('groß: Künstler oben, Titel unten; Farbe bleibt für denselben Song gleich', () => {
    const { container } = render(
      <Artwork seed="Album A" title="Mein Song" label="Künstlerin" size="100%" />,
    );
    const art = container.querySelector('[data-placeholder]') as HTMLElement;
    expect(art).toHaveTextContent('Künstlerin');
    expect(art).toHaveTextContent('Mein Song');
    const color = art.dataset.sleeve;
    const again = render(<Artwork seed="Album A" title="Mein Song" size="100%" />).container;
    expect((again.querySelector('[data-placeholder]') as HTMLElement).dataset.sleeve).toBe(color);
  });

  it('klein (Listen): nur Anfangsbuchstaben, kein doppelter Titel', () => {
    const { container } = render(<Artwork title="Mein Song" label="Künstlerin" size={48} />);
    expect(container).toHaveTextContent(/^MS$/);
  });

  it('Radiosender: eigene Kachel statt verpixeltem Website-Symbol', () => {
    const station = track('r', {
      sourceId: 'radio',
      title: 'Welle Nord',
      artists: ['Germany'],
      artworkUrl: 'https://radio.test/favicon.ico',
      live: true,
    });
    const { container } = render(<TrackArtwork track={station} size="100%" />);
    expect(container).toHaveTextContent('Germany');
    expect(container).toHaveTextContent('Welle Nord');
    // Das Logo ist da, wird aber erst gezeigt, wenn es groß genug geladen hat
    expect(container.querySelector('img')?.getAttribute('data-ok')).toBeNull();
  });

  it('Live-Music-Archive-Konzerte bekommen das gestaltete Cover statt des Archiv-Logos', () => {
    const concert = track('a1/t01.mp3', {
      sourceId: 'archive',
      title: 'Intro',
      album: 'Live im Park 1999',
      artworkUrl: 'https://archive.org/services/img/a1',
      license: { name: 'Live Music Archive' },
    });
    const { container } = render(<TrackArtwork track={concert} size="100%" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('Live im Park 1999');
  });
});
