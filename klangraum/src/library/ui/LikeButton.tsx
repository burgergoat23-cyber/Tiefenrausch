import { useToasts } from '../../app/toastStore';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import type { Track } from '../../sources/types';
import { useIsLiked, useLibrary } from '../libraryStore';

/** Herz: Song zu den Lieblingssongs (nochmal tippen = entfernen) */
export function LikeButton({ track, size = 22 }: { track: Track; size?: number }) {
  const t = useT();
  const liked = useIsLiked(track);
  const toggle = useLibrary((s) => s.toggleLike);
  const toast = useToasts((s) => s.show);
  return (
    <button
      type="button"
      className="kr-icon-btn kr-like"
      aria-label={t('library.likeLabel', { title: track.title })}
      aria-pressed={liked}
      data-liked={liked || undefined}
      onClick={() => {
        const now = toggle(track);
        toast(now ? 'library.likedToast' : 'library.unlikedToast', { title: track.title });
      }}
    >
      <Icon name={liked ? 'heartFilled' : 'heart'} size={size} />
    </button>
  );
}
