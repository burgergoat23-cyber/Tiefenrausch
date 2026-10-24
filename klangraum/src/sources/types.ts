import { z } from 'zod';

export const SOURCE_IDS = [
  'audius',
  'jamendo',
  'archive',
  'radio',
  'youtube',
  'local',
  'spotify',
] as const;
export const sourceIdSchema = z.enum(SOURCE_IDS);
export type SourceId = z.infer<typeof sourceIdSchema>;

export type SearchType = 'track' | 'album' | 'artist' | 'playlist';

/** Nur http(s)-Adressen – nie javascript:, data: o. Ä. */
export const webUrlSchema = z.url({ protocol: /^https?$/ }).max(2000);

export const licenseSchema = z.object({
  name: z.string().max(80),
  url: webUrlSchema.optional(),
});
export type License = z.infer<typeof licenseSchema>;

/** Ein Song – egal aus welcher Quelle. Gespeichert werden nur Anzeige-Infos, nie Audio. */
export const trackSchema = z.object({
  id: z.string().min(1).max(200),
  sourceId: sourceIdSchema,
  title: z.string().max(500),
  artists: z.array(z.string().max(300)).max(20),
  album: z.string().max(500).optional(),
  albumId: z.string().max(200).optional(),
  artistId: z.string().max(200).optional(),
  durationMs: z.number().int().nonnegative(),
  artworkUrl: webUrlSchema.optional(),
  license: licenseSchema.optional(),
  explicit: z.boolean().optional(),
  permalink: webUrlSchema.optional(),
  /** Live-Stream (Radio): keine Länge, kein Spulen */
  live: z.boolean().optional(),
});
export type Track = z.infer<typeof trackSchema>;

/** Playlist ohne Songs (z. B. als Kachel) – zum Merken im Zwischenspeicher */
export const playlistSummarySchema = z.object({
  id: z.string().min(1).max(200),
  sourceId: sourceIdSchema,
  title: z.string().max(500),
  owner: z.string().max(300).optional(),
  artworkUrl: webUrlSchema.optional(),
  trackCount: z.number().int().nonnegative().optional(),
});

export interface Album {
  id: string;
  sourceId: SourceId;
  title: string;
  artists: string[];
  artworkUrl?: string;
  trackCount?: number;
  year?: number;
  tracks?: Track[];
}

export interface Artist {
  id: string;
  sourceId: SourceId;
  name: string;
  imageUrl?: string;
  tracks?: Track[];
}

export interface Playlist {
  id: string;
  sourceId: SourceId;
  title: string;
  owner?: string;
  artworkUrl?: string;
  trackCount?: number;
  tracks?: Track[];
}

export interface SearchResult {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}

export interface SearchOptions {
  type?: SearchType;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface MusicSource {
  id: SourceId;
  name: string;
  needsLogin: boolean;
  /** Welche Such-Arten die Quelle kann (fehlt = alle) */
  searchTypes?: SearchType[];
  /** Suchen kosten Kontingent (YouTube) → nur nach Enter/„Suchen“, nicht schon beim Tippen */
  costlySearch?: boolean;
  isAvailable(): Promise<boolean>;
  search(query: string, opts?: SearchOptions): Promise<SearchResult>;
  getTrack(id: string): Promise<Track>;
  getAlbum?(id: string): Promise<Album>;
  getArtist?(id: string): Promise<Artist>;
  getPlaylist?(id: string): Promise<Playlist>;
  getTrending?(): Promise<Track[]>;
  /** 'url' = wir spielen selbst über <audio> ab; 'external' = Quelle spielt selbst ab (Spotify) */
  playbackMode: 'url' | 'external';
  getStreamUrl?(track: Track): Promise<string>;
  /** false bei Spotify (DRM) → kein EQ/Visualizer/Crossfade */
  canUseWebAudio: boolean;
  allowsOfflineCache: boolean;
}

/** Eindeutiger Schlüssel überall in der App: `${sourceId}:${id}` */
export function trackKey(t: { sourceId: SourceId; id: string }): string {
  return `${t.sourceId}:${t.id}`;
}

export function emptyResult(): SearchResult {
  return { tracks: [], albums: [], artists: [], playlists: [] };
}

export type SourceErrorKind =
  | 'network'
  | 'unavailable'
  | 'notFound'
  | 'rateLimit'
  | 'badResponse'
  /** Tages-Kontingent verbraucht (YouTube) */
  | 'quota'
  /** API-Schlüssel ungültig oder gesperrt */
  | 'badKey';

/** Fehler einer Quelle. Die Oberfläche macht daraus eine freundliche Meldung. */
export class SourceError extends Error {
  readonly sourceId: SourceId;
  readonly kind: SourceErrorKind;

  constructor(sourceId: SourceId, kind: SourceErrorKind, message?: string) {
    super(message ?? `${sourceId}: ${kind}`);
    this.name = 'SourceError';
    this.sourceId = sourceId;
    this.kind = kind;
  }
}
