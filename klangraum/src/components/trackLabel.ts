import type { TFunction } from '../i18n';
import { sourceName } from '../sources/names';
import type { Track } from '../sources/types';

/** Vorlesetext für „Song abspielen“ – gleich in Listen und Kacheln */
export function trackPlayLabel(t: TFunction, track: Track): string {
  const artists = track.artists.join(', ') || t('track.unknownArtist');
  return [
    t('track.play', { title: track.title }),
    artists,
    t('track.source', { source: sourceName(track.sourceId) }),
    track.license ? t('track.license', { license: track.license.name }) : '',
  ]
    .filter(Boolean)
    .join(', ');
}
