import { Artwork, TrackArtwork } from '../../components/Artwork';
import { CoverMosaic } from '../../components/Shelf';
import type { LocalPlaylist } from '../library';

/** Cover einer eigenen Playlist: vier Cover als Collage, sonst das erste oder ein gestaltetes */
export function PlaylistArt({
  playlist,
  size = '100%',
  className,
}: {
  playlist: Pick<LocalPlaylist, 'name' | 'tracks'>;
  size?: number | string;
  className?: string;
}) {
  const first = playlist.tracks[0];
  if (playlist.tracks.length >= 4)
    return (
      <span className={className} style={{ display: 'block', width: size, aspectRatio: '1' }}>
        <CoverMosaic tracks={playlist.tracks} />
      </span>
    );
  if (first) return <TrackArtwork track={first} size={size} className={className} />;
  return (
    <Artwork
      srcs={[]}
      seed={playlist.name}
      title={playlist.name}
      size={size}
      className={className}
    />
  );
}
