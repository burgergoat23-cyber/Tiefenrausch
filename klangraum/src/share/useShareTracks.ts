import { useToasts } from '../app/toastStore';
import type { Track } from '../sources/types';
import { shareLink, shareUrl } from './shareLinks';

/** Teilt Songs als Klangraum-Link (Teilen-Menü am Handy, Zwischenablage am PC) */
export function useShareTracks() {
  const toast = useToasts((s) => s.show);
  return async (title: string, tracks: Track[], name?: string) => {
    const url = shareUrl(tracks, name);
    const r = await shareLink(title, url);
    if (r === 'copied') toast('share.copied');
    else if (r === 'failed') {
      toast('share.failed', undefined, 'error');
      window.prompt(title, url);
    }
  };
}
