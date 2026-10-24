import { z } from 'zod';
import { safeHttpsUrl, withParams, type FetchLike } from '../http';
import {
  emptyResult,
  SourceError,
  type MusicSource,
  type Playlist,
  type SearchOptions,
  type SearchResult,
  type SearchType,
  type SourceErrorKind,
  type Track,
} from '../types';

export const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
/** Kategorie „Musik“ bei YouTube */
const MUSIC_CATEGORY = '10';
const CACHE_SIZE = 30;

const videoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,20}$/);

const thumbsSchema = z
  .object({
    default: z.object({ url: z.string() }).optional(),
    medium: z.object({ url: z.string() }).optional(),
    high: z.object({ url: z.string() }).optional(),
  })
  .partial()
  .optional();

const snippetSchema = z.object({
  title: z.string(),
  channelTitle: z.string().optional(),
  thumbnails: thumbsSchema,
  liveBroadcastContent: z.string().optional(),
});

const videoSchema = z.object({
  id: videoIdSchema,
  snippet: snippetSchema.optional(),
  contentDetails: z
    .object({
      duration: z.string().optional(),
      contentRating: z.object({ ytRating: z.string().optional() }).partial().optional(),
    })
    .partial()
    .optional(),
  status: z.object({ embeddable: z.boolean().optional() }).partial().optional(),
});
type ApiVideo = z.infer<typeof videoSchema>;

const searchItemSchema = z.object({
  id: z.object({ videoId: videoIdSchema.optional(), playlistId: z.string().optional() }),
  snippet: snippetSchema,
});

const listSchema = z.object({ items: z.array(z.unknown()) });

/** YouTube liefert Titel mit HTML-Zeichen wie &amp; oder &#39; – hier werden sie normal lesbar */
export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return named[code.toLowerCase()] ?? m;
  });
}

/** "PT1H2M3S" → Millisekunden */
export function parseIsoDuration(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? '');
  if (!m) return 0;
  const [d, h, min, s] = [m[1], m[2], m[3], m[4]].map((x) => Number(x ?? 0)) as [
    number,
    number,
    number,
    number,
  ];
  return (((d * 24 + h) * 60 + min) * 60 + s) * 1000;
}

/** „Künstler - Topic“ und „KünstlerVEVO“ sind Kanäle des Künstlers selbst */
function cleanChannel(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return (
    name
      .replace(/\s+-\s+Topic$/i, '')
      .replace(/VEVO$/, '')
      .trim() || name
  );
}

function thumb(t: z.infer<typeof thumbsSchema>): string | undefined {
  // medium = 16:9 ohne schwarze Balken (high hat oben/unten Balken)
  return safeHttpsUrl(t?.medium?.url ?? t?.high?.url ?? t?.default?.url);
}

function errorKind(status: number, body: unknown): SourceErrorKind {
  const err = (body as { error?: { errors?: { reason?: string }[]; message?: string } })?.error;
  const reasons = (err?.errors ?? []).map((e) => e.reason ?? '');
  const msg = err?.message ?? '';
  if (reasons.some((r) => /quotaExceeded|dailyLimitExceeded|rateLimitExceeded/.test(r))) {
    return 'quota';
  }
  if (
    reasons.some((r) => /keyInvalid|accessNotConfigured|ipRefererBlocked|forbidden/.test(r)) ||
    /API key/i.test(msg) ||
    status === 400 ||
    status === 403
  ) {
    return 'badKey';
  }
  if (status === 404) return 'notFound';
  if (status === 429) return 'rateLimit';
  return 'network';
}

export interface YouTubeOptions {
  getApiKey?: () => string;
  fetch?: FetchLike;
  /** Land für die Musik-Charts (z. B. 'DE') */
  getRegionCode?: () => string;
}

/**
 * YouTube über die offiziellen Wege: Suche mit der YouTube Data API,
 * Abspielen im offiziellen, sichtbaren YouTube-Player (siehe player/youtubeOutput.ts).
 * Es wird nie Ton aus Videos herausgelöst oder gespeichert.
 */
export class YouTubeSource implements MusicSource {
  readonly id = 'youtube' as const;
  readonly name = 'YouTube';
  readonly needsLogin = false;
  readonly searchTypes: SearchType[] = ['track', 'playlist'];
  readonly costlySearch = true;
  readonly playbackMode = 'external' as const;
  readonly canUseWebAudio = false;
  readonly allowsOfflineCache = false;

  private readonly fetchImpl: FetchLike;
  private readonly getApiKey: () => string;
  private readonly getRegionCode: () => string;
  /** Spart Kontingent: gleiche Suche → gleiche Antwort */
  private readonly cache = new Map<string, unknown>();

  constructor(opts: YouTubeOptions = {}) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.getApiKey = opts.getApiKey ?? (() => import.meta.env.VITE_YOUTUBE_API_KEY ?? '');
    this.getRegionCode = opts.getRegionCode ?? (() => '');
  }

  private key(): string {
    return (this.getApiKey() ?? '').trim();
  }

  async isAvailable(): Promise<boolean> {
    return this.key().length > 0;
  }

  private async request(
    path: string,
    params: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<unknown[]> {
    const key = this.key();
    if (!key) throw new SourceError('youtube', 'unavailable');
    const url = withParams(`${YOUTUBE_API}${path}`, { ...params, key });
    const cacheKey = withParams(path, params);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached as unknown[];

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new SourceError('youtube', 'network', String(err));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // leer lassen – unten entscheidet der Status
    }
    if (!res.ok) throw new SourceError('youtube', errorKind(res.status, body));
    const r = listSchema.safeParse(body);
    if (!r.success) throw new SourceError('youtube', 'badResponse');
    if (this.cache.size >= CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(cacheKey, r.data.items);
    return r.data.items;
  }

  private mapVideo(v: ApiVideo): Track | null {
    if (!v.snippet) return null;
    if (v.status?.embeddable === false) return null; // darf nicht eingebettet werden
    if (v.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') return null;
    const live = v.snippet.liveBroadcastContent === 'live';
    if (v.snippet.liveBroadcastContent === 'upcoming') return null;
    const artist = cleanChannel(v.snippet.channelTitle);
    return {
      id: v.id,
      sourceId: 'youtube',
      title: decodeEntities(v.snippet.title),
      artists: artist ? [decodeEntities(artist)] : [],
      durationMs: live ? 0 : parseIsoDuration(v.contentDetails?.duration),
      artworkUrl: thumb(v.snippet.thumbnails),
      permalink: `https://www.youtube.com/watch?v=${v.id}`,
      ...(live ? { live: true } : {}),
    };
  }

  /** Lädt Details (Länge, darf eingebettet werden?) für bis zu 50 Videos – kostet nur 1 Einheit */
  private async videos(ids: string[], signal?: AbortSignal): Promise<Track[]> {
    if (ids.length === 0) return [];
    const items = await this.request(
      '/videos',
      { part: 'snippet,contentDetails,status', id: ids.slice(0, 50).join(','), maxResults: 50 },
      signal,
    );
    const byId = new Map<string, Track>();
    for (const item of items) {
      const p = videoSchema.safeParse(item);
      if (!p.success) continue;
      const t = this.mapVideo(p.data);
      if (t) byId.set(t.id, t);
    }
    // Reihenfolge der Suche beibehalten
    return ids.map((id) => byId.get(id)).filter((t): t is Track => !!t);
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
    const { type = 'track', limit = 20, signal } = opts;
    const result = emptyResult();
    const q = query.trim();
    if (!q || (type !== 'track' && type !== 'playlist')) return result;
    const items = await this.request(
      '/search',
      {
        part: 'snippet',
        q,
        type: type === 'track' ? 'video' : 'playlist',
        maxResults: Math.min(limit, 25),
        safeSearch: 'moderate',
        ...(type === 'track'
          ? { videoCategoryId: MUSIC_CATEGORY, videoEmbeddable: 'true', videoSyndicated: 'true' }
          : {}),
      },
      signal,
    );
    const parsed = items
      .map((i) => searchItemSchema.safeParse(i))
      .filter((r) => r.success)
      .map((r) => r.data);
    if (type === 'track') {
      const ids = parsed.map((p) => p.id.videoId).filter((id): id is string => !!id);
      result.tracks = await this.videos(ids, signal);
    } else {
      result.playlists = parsed
        .filter((p) => p.id.playlistId && /^[A-Za-z0-9_-]{10,64}$/.test(p.id.playlistId))
        .map((p): Playlist => ({
          id: p.id.playlistId as string,
          sourceId: 'youtube',
          title: decodeEntities(p.snippet.title),
          owner: cleanChannel(p.snippet.channelTitle),
          artworkUrl: thumb(p.snippet.thumbnails),
        }));
    }
    return result;
  }

  async getTrending(): Promise<Track[]> {
    const region = this.getRegionCode().toUpperCase();
    const items = await this.request('/videos', {
      part: 'snippet,contentDetails,status',
      chart: 'mostPopular',
      videoCategoryId: MUSIC_CATEGORY,
      regionCode: /^[A-Z]{2}$/.test(region) ? region : undefined,
      maxResults: 25,
    });
    return items
      .map((i) => videoSchema.safeParse(i))
      .filter((r) => r.success)
      .map((r) => this.mapVideo(r.data))
      .filter((t): t is Track => !!t);
  }

  async getTrack(id: string): Promise<Track> {
    const [t] = await this.videos([id]);
    if (!t) throw new SourceError('youtube', 'notFound');
    return t;
  }

  async getPlaylist(id: string): Promise<Playlist> {
    const [meta, items] = await Promise.all([
      this.request('/playlists', { part: 'snippet', id }),
      this.request('/playlistItems', { part: 'contentDetails', playlistId: id, maxResults: 50 }),
    ]);
    const head = z.object({ id: z.string(), snippet: snippetSchema }).safeParse(meta[0]);
    if (!head.success) throw new SourceError('youtube', 'notFound');
    const ids = items
      .map((i) => z.object({ contentDetails: z.object({ videoId: videoIdSchema }) }).safeParse(i))
      .filter((r) => r.success)
      .map((r) => r.data.contentDetails.videoId);
    return {
      id,
      sourceId: 'youtube',
      title: decodeEntities(head.data.snippet.title),
      owner: cleanChannel(head.data.snippet.channelTitle),
      artworkUrl: thumb(head.data.snippet.thumbnails),
      tracks: await this.videos(ids),
    };
  }
}
