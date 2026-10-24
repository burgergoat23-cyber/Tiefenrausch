import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { z } from 'zod';
import { trackSchema, type Track } from '../sources/types';

/**
 * Teilen ohne Server: Der Link enthält die Song-Infos (nur Anzeige-Daten, kein Audio), gepackt mit lz-string.
 * Beim Öffnen wird alles mit zod geprüft – ein manipulierter Link kann nichts einschleusen.
 */
export const MAX_SHARED_TRACKS = 100;
const MAX_ENCODED = 60_000;

const sharedSchema = z.object({
  v: z.literal(1),
  n: z.string().max(100).optional(),
  t: z.array(z.unknown()).max(MAX_SHARED_TRACKS),
});

/** Kurze Feldnamen halten den Link klein */
function pack(t: Track) {
  return {
    s: t.sourceId,
    i: t.id,
    t: t.title,
    a: t.artists,
    d: t.durationMs,
    ...(t.album ? { al: t.album } : {}),
    ...(t.artworkUrl ? { w: t.artworkUrl } : {}),
    ...(t.permalink ? { p: t.permalink } : {}),
    ...(t.license ? { l: t.license } : {}),
    ...(t.live ? { lv: true } : {}),
  };
}

function unpack(raw: unknown): Track | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const r = trackSchema.safeParse({
    sourceId: o.s,
    id: o.i,
    title: o.t,
    artists: o.a,
    durationMs: o.d,
    album: o.al,
    artworkUrl: o.w,
    permalink: o.p,
    license: o.l,
    live: o.lv,
  });
  return r.success ? r.data : null;
}

export function encodeShare(tracks: Track[], name?: string): string {
  const body = {
    v: 1,
    ...(name ? { n: name } : {}),
    t: tracks.slice(0, MAX_SHARED_TRACKS).map(pack),
  };
  return compressToEncodedURIComponent(JSON.stringify(body));
}

export interface SharedContent {
  name?: string;
  tracks: Track[];
}

export function decodeShare(encoded: string): SharedContent | null {
  if (!encoded || encoded.length > MAX_ENCODED) return null;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = sharedSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return null;
    const tracks = parsed.data.t.map(unpack).filter((t): t is Track => t !== null);
    if (tracks.length === 0) return null;
    return { name: parsed.data.n, tracks };
  } catch {
    return null;
  }
}

/** Vollständige Adresse zum Teilen, z. B. https://…/klangraum/#/geteilt?d=… */
export function shareUrl(tracks: Track[], name?: string, base = window.location.href): string {
  const url = new URL(base);
  url.hash = `/geteilt?d=${encodeShare(tracks, name)}`;
  url.search = '';
  return url.toString();
}

export type ShareResult = 'shared' | 'copied' | 'failed' | 'cancelled';

/** Teilen-Menü des Geräts (Handy) oder Link in die Zwischenablage (PC) */
export async function shareLink(title: string, url: string): Promise<ShareResult> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === 'function' && matchMedia('(pointer: coarse)').matches) {
    try {
      await nav.share({ title, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
