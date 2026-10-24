import type { SourceId } from '../sources/types';

export type CollectionKind = 'album' | 'artist' | 'playlist';

/** Adresse der Detailseite, z. B. #/album/jamendo/12345 */
export function collectionPath(kind: CollectionKind, sourceId: SourceId, id: string) {
  return `/${kind}/${sourceId}/${encodeURIComponent(id)}`;
}
