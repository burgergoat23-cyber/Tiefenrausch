import { z } from 'zod';
import { getJson, safeHttpsUrl, withParams, type FetchLike } from '../http';
import {
  emptyResult,
  SourceError,
  type MusicSource,
  type SearchOptions,
  type SearchResult,
  type SearchType,
  type Track,
} from '../types';

/** Öffentliche Server des freien Verzeichnisses radio-browser.info (fällt einer aus, nehmen wir den nächsten) */
export const RADIO_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

/** Formate, die alle Browser (auch Safari am iPhone) direkt abspielen */
const PLAYABLE_CODECS = new Set(['MP3', 'AAC', 'AAC+']);

const num = z.union([z.number(), z.string()]).transform((v) => Number(v));

const stationSchema = z.object({
  stationuuid: z.string().regex(/^[0-9a-f-]{8,64}$/i),
  name: z.string(),
  url_resolved: z.string().optional(),
  homepage: z.string().optional(),
  favicon: z.string().optional(),
  tags: z.string().optional(),
  country: z.string().optional(),
  codec: z.string().optional(),
  bitrate: num.optional(),
  hls: num.optional(),
  lastcheckok: num.optional(),
});
type Station = z.infer<typeof stationSchema>;

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export interface RadioOptions {
  fetch?: FetchLike;
  random?: () => number;
  /** Ländercode für „Beliebte Sender“ (z. B. 'DE'), leer = weltweit */
  getCountryCode?: () => string;
}

/**
 * Internetradio über radio-browser.info: zehntausende Sender, die ihre Streams öffentlich anbieten.
 * Ein Sender ist bei uns ein „Song“ ohne Länge (live).
 */
export class RadioSource implements MusicSource {
  readonly id = 'radio' as const;
  readonly name = 'Internetradio';
  readonly needsLogin = false;
  readonly searchTypes: SearchType[] = ['track'];
  readonly playbackMode = 'url' as const;
  /** Radio-Streams erlauben meist kein Web Audio (CORS) – ehrlich: kein EQ/Visualizer */
  readonly canUseWebAudio = false;
  readonly allowsOfflineCache = false;

  private readonly fetchImpl: FetchLike;
  private readonly getCountryCode: () => string;
  private servers: string[];
  private readonly streamById = new Map<string, string>();

  constructor(opts: RadioOptions = {}) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.getCountryCode = opts.getCountryCode ?? (() => '');
    this.servers = shuffle(RADIO_SERVERS, opts.random ?? Math.random);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private async request(
    path: string,
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
  ): Promise<unknown> {
    let lastErr: unknown = null;
    for (const server of [...this.servers]) {
      try {
        const json = await getJson(
          this.fetchImpl,
          'radio',
          withParams(`${server}${path}`, params),
          {
            signal,
            timeoutMs: 8000,
          },
        );
        this.servers = [server, ...this.servers.filter((s) => s !== server)];
        return json;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (err instanceof SourceError && err.kind === 'notFound') throw err;
        lastErr = err;
      }
    }
    if (lastErr instanceof SourceError) throw lastErr;
    throw new SourceError('radio', 'network');
  }

  /** Nur Sender, die sicher (https), funktionierend und in jedem Browser abspielbar sind */
  private toTracks(data: unknown): Track[] {
    if (!Array.isArray(data)) return [];
    const out: Track[] = [];
    const seen = new Set<string>();
    for (const item of data) {
      const r = stationSchema.safeParse(item);
      if (!r.success) continue;
      const s = r.data;
      if (seen.has(s.stationuuid)) continue;
      // Nur echte https-Streams: http-Streams blockiert der Browser auf https-Seiten
      const stream = s.url_resolved?.startsWith('https://')
        ? safeHttpsUrl(s.url_resolved)
        : undefined;
      if (!stream) continue;
      if (s.hls === 1 || s.lastcheckok === 0) continue;
      if (!PLAYABLE_CODECS.has((s.codec ?? '').toUpperCase())) continue;
      seen.add(s.stationuuid);
      this.streamById.set(s.stationuuid, stream);
      out.push(this.mapStation(s));
    }
    return out;
  }

  private mapStation(s: Station): Track {
    const tags = (s.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    return {
      id: s.stationuuid,
      sourceId: 'radio',
      title: s.name.trim() || 'Radio',
      artists: [s.country?.trim() || 'Internetradio'],
      album: tags || undefined,
      durationMs: 0,
      artworkUrl: safeHttpsUrl(s.favicon),
      permalink: safeHttpsUrl(s.homepage),
      live: true,
    };
  }

  private baseParams(limit: number) {
    return {
      limit,
      hidebroken: 'true',
      is_https: 'true',
      order: 'clickcount',
      reverse: 'true',
    };
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
    const { type = 'track', limit = 20, signal } = opts;
    const result = emptyResult();
    const q = query.trim();
    if (!q || type !== 'track') return result;
    // Nach Sendername UND nach Musikrichtung (z. B. „rock“) suchen
    const [byName, byTag] = await Promise.allSettled([
      this.request('/json/stations/search', { ...this.baseParams(limit), name: q }, signal),
      this.request(
        '/json/stations/search',
        { ...this.baseParams(limit), tag: q.toLowerCase() },
        signal,
      ),
    ]);
    if (byName.status === 'rejected' && byTag.status === 'rejected') throw byName.reason;
    const list = [
      ...(byName.status === 'fulfilled' && Array.isArray(byName.value) ? byName.value : []),
      ...(byTag.status === 'fulfilled' && Array.isArray(byTag.value) ? byTag.value : []),
    ];
    result.tracks = this.toTracks(list).slice(0, limit);
    return result;
  }

  async getTrending(): Promise<Track[]> {
    const country = this.getCountryCode().toUpperCase();
    const data = await this.request('/json/stations/search', {
      ...this.baseParams(40),
      countrycode: /^[A-Z]{2}$/.test(country) ? country : undefined,
    });
    return this.toTracks(data).slice(0, 30);
  }

  async getTrack(id: string): Promise<Track> {
    const data = await this.request(`/json/stations/byuuid/${encodeURIComponent(id)}`);
    const [t] = this.toTracks(data);
    if (!t) throw new SourceError('radio', 'notFound');
    return t;
  }

  async getStreamUrl(track: Track): Promise<string> {
    const known = this.streamById.get(track.id);
    // Das Verzeichnis bittet darum, jeden Start zu melden (so bleiben beliebte Sender oben)
    const click = this.request(`/json/url/${encodeURIComponent(track.id)}`);
    if (known) {
      click.catch(() => {});
      return known;
    }
    await click.catch(() => {});
    const t = await this.getTrack(track.id);
    const url = this.streamById.get(t.id);
    if (!url) throw new SourceError('radio', 'notFound');
    return url;
  }
}
