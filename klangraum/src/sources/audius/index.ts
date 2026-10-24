import { z } from 'zod';
import { getJson, safeHttpsUrl, withParams, type FetchLike } from '../http';
import {
  emptyResult,
  SourceError,
  type Album,
  type Artist,
  type MusicSource,
  type Playlist,
  type SearchOptions,
  type SearchResult,
  type Track,
} from '../types';

export const AUDIUS_DISCOVERY = 'https://api.audius.co';
export const AUDIUS_APP_NAME = 'Klangraum';

const artworkSchema = z
  .object({
    '150x150': z.string().optional(),
    '480x480': z.string().optional(),
    '1000x1000': z.string().optional(),
  })
  .nullish();

const userSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  handle: z.string().nullish(),
  profile_picture: artworkSchema,
});

const trackSchema = z.object({
  id: z.string(),
  title: z.string(),
  duration: z.number().nullish(),
  artwork: artworkSchema,
  user: userSchema.partial().nullish(),
  permalink: z.string().nullish(),
  is_streamable: z.boolean().nullish(),
  stream_conditions: z.unknown().nullish(),
  access: z.object({ stream: z.boolean().nullish() }).partial().nullish(),
});

const playlistSchema = z.object({
  id: z.string(),
  playlist_name: z.string(),
  is_album: z.boolean().nullish(),
  artwork: artworkSchema,
  user: userSchema.partial().nullish(),
  track_count: z.number().nullish(),
});

type ApiTrack = z.infer<typeof trackSchema>;
type ApiPlaylist = z.infer<typeof playlistSchema>;
type ApiUser = z.infer<typeof userSchema>;

/** Wandelt eine Liste aus der API um und überspringt kaputte Einträge, statt alles abzubrechen. */
function parseList<T>(schema: z.ZodType<T>, data: unknown): T[] {
  if (!Array.isArray(data)) return [];
  const out: T[] = [];
  for (const item of data) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

function pickArtwork(a: z.infer<typeof artworkSchema>): string | undefined {
  return safeHttpsUrl(a?.['480x480'] ?? a?.['1000x1000'] ?? a?.['150x150']);
}

function isPlayable(t: ApiTrack): boolean {
  if (t.is_streamable === false) return false;
  if (t.stream_conditions) return false; // bezahlte / gesperrte Songs
  if (t.access && t.access.stream === false) return false;
  return true;
}

export function mapAudiusTrack(t: ApiTrack): Track {
  const artist = t.user?.name || t.user?.handle || '';
  const permalink = t.permalink ? safeHttpsUrl(`https://audius.co${t.permalink}`) : undefined;
  return {
    id: t.id,
    sourceId: 'audius',
    title: t.title,
    artists: artist ? [artist] : [],
    artistId: t.user?.id,
    durationMs: Math.max(0, Math.round((t.duration ?? 0) * 1000)),
    artworkUrl: pickArtwork(t.artwork),
    permalink,
  };
}

function mapPlaylist(p: ApiPlaylist): Playlist {
  return {
    id: p.id,
    sourceId: 'audius',
    title: p.playlist_name,
    owner: p.user?.name ?? undefined,
    artworkUrl: pickArtwork(p.artwork),
    trackCount: p.track_count ?? undefined,
  };
}

function mapAlbum(p: ApiPlaylist): Album {
  return {
    id: p.id,
    sourceId: 'audius',
    title: p.playlist_name,
    artists: p.user?.name ? [p.user.name] : [],
    artworkUrl: pickArtwork(p.artwork),
    trackCount: p.track_count ?? undefined,
  };
}

function mapArtist(u: ApiUser): Artist {
  return {
    id: u.id,
    sourceId: 'audius',
    name: u.name || u.handle || '?',
    imageUrl: pickArtwork(u.profile_picture),
  };
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export interface AudiusOptions {
  fetch?: FetchLike;
  random?: () => number;
}

/**
 * Audius: öffentliche API ohne Schlüssel.
 * Zuerst fragen wir api.audius.co nach Servern; antwortet einer nicht, nehmen wir den nächsten.
 */
export class AudiusSource implements MusicSource {
  readonly id = 'audius' as const;
  readonly name = 'Audius';
  readonly needsLogin = false;
  readonly playbackMode = 'url' as const;
  readonly canUseWebAudio = true;
  readonly allowsOfflineCache = false;

  private readonly fetchImpl: FetchLike;
  private readonly random: () => number;
  private hosts: string[] | null = null;
  private hostsPromise: Promise<string[]> | null = null;

  constructor(opts: AudiusOptions = {}) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.random = opts.random ?? Math.random;
  }

  async isAvailable(): Promise<boolean> {
    // Server schon mal im Hintergrund suchen, damit der erste Song schneller startet
    void this.getHosts().catch(() => {});
    return true;
  }

  /** Liste der Server, der zuletzt funktionierende steht vorne. */
  async getHosts(): Promise<string[]> {
    if (this.hosts) return this.hosts;
    this.hostsPromise ??= this.discover();
    try {
      this.hosts = await this.hostsPromise;
      return this.hosts;
    } finally {
      this.hostsPromise = null;
    }
  }

  private async discover(): Promise<string[]> {
    let found: string[] = [];
    try {
      const json = await getJson(this.fetchImpl, 'audius', AUDIUS_DISCOVERY, { timeoutMs: 6000 });
      const data = (json as { data?: unknown }).data;
      if (Array.isArray(data)) {
        found = data
          .map((h) => safeHttpsUrl(h))
          .filter((h): h is string => !!h)
          .map((h) => h.replace(/\/+$/, ''));
      }
    } catch {
      // Kein Problem: dann nehmen wir direkt api.audius.co
    }
    const hosts = shuffle(found, this.random).slice(0, 3);
    if (!hosts.includes(AUDIUS_DISCOVERY)) hosts.push(AUDIUS_DISCOVERY);
    return hosts;
  }

  private async request(
    path: string,
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
  ): Promise<unknown> {
    const hosts = await this.getHosts();
    let lastErr: unknown = null;
    for (const host of [...hosts]) {
      const url = withParams(`${host}/v1${path}`, { ...params, app_name: AUDIUS_APP_NAME });
      try {
        const json = await getJson(this.fetchImpl, 'audius', url, { signal, timeoutMs: 8000 });
        // Funktionierenden Server nach vorne holen
        this.hosts = [host, ...hosts.filter((h) => h !== host)];
        return (json as { data?: unknown }).data;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (err instanceof SourceError && err.kind === 'notFound') throw err;
        lastErr = err;
      }
    }
    this.hosts = null; // beim nächsten Mal neu suchen
    if (lastErr instanceof SourceError) throw lastErr;
    throw new SourceError('audius', 'network');
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
    const { type = 'track', limit = 20, offset = 0, signal } = opts;
    const result = emptyResult();
    const q = query.trim();
    if (!q) return result;
    if (type === 'track') {
      const data = await this.request('/tracks/search', { query: q, limit, offset }, signal);
      result.tracks = parseList(trackSchema, data).filter(isPlayable).map(mapAudiusTrack);
    } else if (type === 'artist') {
      const data = await this.request('/users/search', { query: q, limit, offset }, signal);
      result.artists = parseList(userSchema, data).map(mapArtist);
    } else {
      const data = await this.request('/playlists/search', { query: q, limit, offset }, signal);
      const lists = parseList(playlistSchema, data);
      if (type === 'album') result.albums = lists.filter((p) => p.is_album).map(mapAlbum);
      else result.playlists = lists.filter((p) => !p.is_album).map(mapPlaylist);
    }
    return result;
  }

  async getTrack(id: string): Promise<Track> {
    const data = await this.request(`/tracks/${encodeURIComponent(id)}`);
    const r = trackSchema.safeParse(Array.isArray(data) ? data[0] : data);
    if (!r.success) throw new SourceError('audius', 'notFound');
    return mapAudiusTrack(r.data);
  }

  async getTrending(): Promise<Track[]> {
    const data = await this.request('/tracks/trending', { time: 'week' });
    return parseList(trackSchema, data).filter(isPlayable).slice(0, 30).map(mapAudiusTrack);
  }

  private async playlistWithTracks(id: string) {
    const enc = encodeURIComponent(id);
    const [meta, tracks] = await Promise.all([
      this.request(`/playlists/${enc}`),
      this.request(`/playlists/${enc}/tracks`),
    ]);
    const p = playlistSchema.safeParse(Array.isArray(meta) ? meta[0] : meta);
    if (!p.success) throw new SourceError('audius', 'notFound');
    return {
      playlist: p.data,
      tracks: parseList(trackSchema, tracks).filter(isPlayable).map(mapAudiusTrack),
    };
  }

  async getAlbum(id: string): Promise<Album> {
    const { playlist, tracks } = await this.playlistWithTracks(id);
    return { ...mapAlbum(playlist), tracks };
  }

  async getPlaylist(id: string): Promise<Playlist> {
    const { playlist, tracks } = await this.playlistWithTracks(id);
    return { ...mapPlaylist(playlist), tracks };
  }

  async getArtist(id: string): Promise<Artist> {
    const enc = encodeURIComponent(id);
    const [user, tracks] = await Promise.all([
      this.request(`/users/${enc}`),
      this.request(`/users/${enc}/tracks`, { limit: 50 }),
    ]);
    const u = userSchema.safeParse(Array.isArray(user) ? user[0] : user);
    if (!u.success) throw new SourceError('audius', 'notFound');
    return {
      ...mapArtist(u.data),
      tracks: parseList(trackSchema, tracks).filter(isPlayable).map(mapAudiusTrack),
    };
  }

  async getStreamUrl(track: Track): Promise<string> {
    const hosts = await this.getHosts();
    const host = hosts[0] ?? AUDIUS_DISCOVERY;
    return withParams(`${host}/v1/tracks/${encodeURIComponent(track.id)}/stream`, {
      app_name: AUDIUS_APP_NAME,
    });
  }
}
