import { Icon } from '../components/Icon';
import { useT } from '../i18n';
import type { Track } from '../sources/types';
import { useShareTracks } from './useShareTracks';

export function SharePlaylistButton({ name, tracks }: { name: string; tracks: Track[] }) {
  const t = useT();
  const share = useShareTracks();
  if (tracks.length === 0) return null;
  return (
    <button
      type="button"
      className="kr-icon-btn"
      aria-label={t('share.share')}
      title={t('share.share')}
      onClick={() => void share(name, tracks, name)}
    >
      <Icon name="share" size={22} />
    </button>
  );
}
