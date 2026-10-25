import { z } from 'zod';
import { getJson, safeHttpsUrl, withParams, type FetchLike } from '../http';
import {
  emptyResult,
  SourceError,
  type Album,
  type Artist,
  type License,
  type MusicSource,
  type Playlist,
  type SearchOptions,
  type SearchResult,
  type Track,
} from '../types';

export const JAMENDO_API = 'https://api.jamendo.com/v3.0';

const id = z.union([z.string(), z.number()]).transform(String);

const trackSchema = z.object({
  id,
  name: z.string(),
  duration: z.coerce.number().nullish(),
  artist_id: id.nullish(),
  artist_name: z.string().nullish(),
  album_id: id.nullish(),
  album_name: z.string().nullish(),
  album_image: z.string().nullish(),
  image: z.string().nullish(),
  audio: z.string().nullish(),
  license_ccurl: z.string().nullish(),
  shareurl: z.string().nullish(),
});

const albumSchema = z.object({
  id,
  name: z.string(),
  artist_name: z.string().nullish(),
  image: z.string().nullish(),
  releasedate: z.string().nullish(),
});

const artistSchema = z.object({
  id,
  name: z.string(),
  image: z.string().nullish(),
});

const playlistSchema = z.object({
  id,
  name: z.string(),
  user_name: z.string().nullish(),
});

const responseSchema = z.object({
  headers: z.object({
    status: z.string(),
    code: z.coerce.number().optional(),
    error_message: z.string().nullish(),
    results_fullcount: z.coerce.number().optional(),
  }),
  results: z.array(z.unknown()),
});

type ApiTrack = z.infer<typeof trackSchema>;

/** Aus "http://creativecommons.org/licenses/by-nc-sa/3.0/" wird "CC BY-NC-SA 3.0". */
export function parseCcLicense(url: string | null | undefined): License | undefined {
  const safe = safeHttpsUrl(url);
  if (!safe) return undefined;
  const m = /licenses\/([a-z-]+)\/(\d+(?:\.\d+)?)/i.exec(safe);
  if (m && m[1] && m[2]) return { name: `CC ${m[1].toUpperCase()} ${m[2]}`, url: safe };
  if (/publicdomain/i.test(safe)) return { name: 'Public Domain', url: safe };
  return { name: 'Creative Commons', url: safe };
}

function parseList<T>(schema: z.ZodType<T>, data: unknown[]): T[] {
  const out: T[] = [];
  for (const item of data) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

interface Fallback {
  artist?: string | null;
  album?: string | null;
  albumId?: string | null;
  image?: string | null;
}

export interface JamendoOptions {
  /** Liefert die Client-ID (aus den Einstellungen oder aus .env). */
  getClientId?: () => string;
  fetch?: FetchLike;
}

/**
 * Jamendo: freie Musik (Creative Commons). Braucht eine kostenlose client_id.
 * Ohne client_id ist die Quelle still deaktiviert.
 */
export class JamendoSource implements MusicSource {
  readonly id = 'jamendo' as const;
  readonly name = 'Jamendo';
  readonly needsLogin = false;
  readonly playbackMode = 'url' as const;
  readonly canUseWebAudio = true;
  readonly allowsOfflineCache = true;

  private readonly fetchImpl: FetchLike;
  private readonly getClientId: () => string;
  /** Stream-Adressen aus den Suchergebnissen, damit wir nicht nochmal fragen müssen */
  private readonly audioById = new Map<string, string>();

  constructor(opts: JamendoOptions = {}) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.getClientId = opts.getClientId ?? (() => import.meta.env.VITE_JAMENDO_CLIENT_ID ?? '');
  }

  private clientId(): string {
    return (this.getClientId() ?? '').trim();
  }

  async isAvailable(): Promise<boolean> {
    return this.clientId().length > 0;
  }

  async countTracks(query: string, signal?: AbortSignal): Promise<number> {
    const clientId = this.clientId();
    const q = query.trim();
    if (!clientId || !q) return 0;
    const url = withParams(`${JAMENDO_API}/tracks/`, {
      client_id: clientId,
      format: 'json',
      search: q,
      limit: 1,
      fullcount: 'true',
    });
    const json = await getJson(this.fetchImpl, 'jamendo', url, { signal });
    const r = responseSchema.safeParse(json);
    return r.success ? (r.data.headers.results_fullcount ?? 0) : 0;
  }

  private async request(
    path: string,
    params: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<unknown[]> {
    const clientId = this.clientId();
    if (!clientId) throw new SourceError('jamendo', 'unavailable');
    const url = withParams(`${JAMENDO_API}${path}`, {
      client_id: clientId,
      format: 'json',
      ...params,
    });
    const json = await getJson(this.fetchImpl, 'jamendo', url, { signal });
    const r = responseSchema.safeParse(json);
    if (!r.success) throw new SourceError('jamendo', 'badResponse');
    if (r.data.headers.status !== 'success') {
      // Code 5 = unbekannte client_id
      const kind = r.data.headers.code === 5 ? 'unavailable' : 'badResponse';
      throw new SourceError('jamendo', kind, r.data.headers.error_message ?? undefined);
    }
    return r.data.results;
  }

  private mapTrack(t: ApiTrack, fb: Fallback = {}): Track {
    if (t.audio) {
      const audio = safeHttpsUrl(t.audio);
      if (audio) this.audioById.set(t.id, audio);
    }
    const artist = t.artist_name ?? fb.artist;
    return {
      id: t.id,
      sourceId: 'jamendo',
      title: t.name,
      artists: artist ? [artist] : [],
      artistId: t.artist_id ?? undefined,
      album: t.album_name ?? fb.album ?? undefined,
      albumId: t.album_id ?? fb.albumId ?? undefined,
      durationMs: Math.max(0, Math.round((t.duration ?? 0) * 1000)),
      artworkUrl: safeHttpsUrl(t.album_image || t.image || fb.image),
      license: parseCcLicense(t.license_ccurl),
      permalink: safeHttpsUrl(t.shareurl),
    };
  }

  private trackParams() {
    return { include: 'licenses', audioformat: 'mp32', imagesize: 300 } as const;
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
    const { type = 'track', limit = 20, offset = 0, signal } = opts;
    const result = emptyResult();
    const q = query.trim();
    if (!q) return result;
    if (type === 'track') {
      const data = await this.request(
        '/tracks/',
        { search: q, limit, offset, ...this.trackParams() },
        signal,
      );
      result.tracks = parseList(trackSchema, data).map((t) => this.mapTrack(t));
    } else if (type === 'album') {
      const data = await this.request(
        '/albums/',
        { namesearch: q, limit, offset, imagesize: 300 },
        signal,
      );
      result.albums = parseList(albumSchema, data).map((a): Album => ({
        id: a.id,
        sourceId: 'jamendo',
        title: a.name,
        artists: a.artist_name ? [a.artist_name] : [],
        artworkUrl: safeHttpsUrl(a.image),
        year: a.releasedate ? Number(a.releasedate.slice(0, 4)) || undefined : undefined,
      }));
    } else if (type === 'artist') {
      const data = await this.request('/artists/', { namesearch: q, limit, offset }, signal);
      result.artists = parseList(artistSchema, data).map((a): Artist => ({
        id: a.id,
        sourceId: 'jamendo',
        name: a.name,
        imageUrl: safeHttpsUrl(a.image),
      }));
    } else {
      const data = await this.request('/playlists/', { namesearch: q, limit, offset }, signal);
      result.playlists = parseList(playlistSchema, data).map((p): Playlist => ({
        id: p.id,
        sourceId: 'jamendo',
        title: p.name,
        owner: p.user_name ?? undefined,
      }));
    }
    return result;
  }

  async getTrack(trackId: string): Promise<Track> {
    const data = await this.request('/tracks/', { id: trackId, ...this.trackParams() });
    const [t] = parseList(trackSchema, data);
    if (!t) throw new SourceError('jamendo', 'notFound');
    return this.mapTrack(t);
  }

  async getTrending(): Promise<Track[]> {
    const data = await this.request('/tracks/', {
      order: 'popularity_week',
      limit: 30,
      ...this.trackParams(),
    });
    return parseList(trackSchema, data).map((t) => this.mapTrack(t));
  }

  /** Für /albums/tracks, /artists/tracks, /playlists/tracks: ein Eintrag mit einer Song-Liste. */
  private async withTracks(path: string, itemId: string) {
    const data = await this.request(path, {
      id: itemId,
      audioformat: 'mp32',
      imagesize: 300,
    });
    const head = z
      .object({
        id,
        name: z.string(),
        artist_name: z.string().nullish(),
        user_name: z.string().nullish(),
        image: z.string().nullish(),
        tracks: z.array(z.unknown()).nullish(),
      })
      .safeParse(data[0]);
    if (!head.success) throw new SourceError('jamendo', 'notFound');
    return head.data;
  }

  async getAlbum(albumId: string): Promise<Album> {
    const a = await this.withTracks('/albums/tracks/', albumId);
    const fb: Fallback = { artist: a.artist_name, album: a.name, albumId: a.id, image: a.image };
    return {
      id: a.id,
      sourceId: 'jamendo',
      title: a.name,
      artists: a.artist_name ? [a.artist_name] : [],
      artworkUrl: safeHttpsUrl(a.image),
      tracks: parseList(trackSchema, a.tracks ?? []).map((t) => this.mapTrack(t, fb)),
    };
  }

  async getArtist(artistId: string): Promise<Artist> {
    const a = await this.withTracks('/artists/tracks/', artistId);
    return {
      id: a.id,
      sourceId: 'jamendo',
      name: a.name,
      imageUrl: safeHttpsUrl(a.image),
      tracks: parseList(trackSchema, a.tracks ?? []).map((t) =>
        this.mapTrack(t, { artist: a.name, image: a.image }),
      ),
    };
  }

  async getPlaylist(playlistId: string): Promise<Playlist> {
    const p = await this.withTracks('/playlists/tracks/', playlistId);
    const tracks = parseList(trackSchema, p.tracks ?? []).map((t) => this.mapTrack(t));
    return {
      id: p.id,
      sourceId: 'jamendo',
      title: p.name,
      owner: p.user_name ?? undefined,
      artworkUrl: tracks[0]?.artworkUrl,
      tracks,
    };
  }

  async getStreamUrl(track: Track): Promise<string> {
    const known = this.audioById.get(track.id);
    if (known) return known;
    await this.getTrack(track.id);
    const url = this.audioById.get(track.id);
    if (!url) throw new SourceError('jamendo', 'notFound');
    return url;
  }
}
