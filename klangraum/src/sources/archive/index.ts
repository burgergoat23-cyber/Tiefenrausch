import { z } from 'zod';
import { parseCcLicense } from '../jamendo';
import { getJson, safeHttpsUrl, type FetchLike } from '../http';
import {
  emptyResult,
  SourceError,
  type Album,
  type License,
  type MusicSource,
  type SearchOptions,
  type SearchResult,
  type SearchType,
  type Track,
} from '../types';

export const ARCHIVE_ORIGIN = 'https://archive.org';

/**
 * Nur Sammlungen mit klarer Erlaubnis:
 * - etree = Live Music Archive (Bands, die Mitschnitte ausdrücklich zum Weitergeben freigeben)
 * - netlabels = freie Netlabel-Veröffentlichungen (meist Creative Commons)
 */
export const ARCHIVE_COLLECTIONS = ['etree', 'netlabels'] as const;

const LMA_LICENSE: License = {
  name: 'Live Music Archive',
  url: 'https://archive.org/details/etree',
};

const strOrList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v]));

const docSchema = z.object({
  identifier: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/),
  title: strOrList.optional(),
  creator: strOrList.optional(),
  licenseurl: z.string().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  collection: strOrList.optional(),
});
type Doc = z.infer<typeof docSchema>;

const searchResponseSchema = z.object({
  response: z.object({ docs: z.array(z.unknown()), numFound: z.coerce.number().optional() }),
});

const fileSchema = z.object({
  name: z.string(),
  format: z.string().optional(),
  title: z.string().optional(),
  creator: z.string().optional(),
  album: z.string().optional(),
  track: z.string().optional(),
  length: z.string().optional(),
});
type ApiFile = z.infer<typeof fileSchema>;

const metadataSchema = z.object({
  metadata: z.object({
    identifier: z.string(),
    title: strOrList.optional(),
    creator: strOrList.optional(),
    licenseurl: z.string().optional(),
    collection: strOrList.optional(),
    date: z.string().optional(),
  }),
  files: z.array(z.unknown()).optional(),
});

/** Bevorzugte Formate – MP3 spielt auf allen Geräten (auch iPhone) */
const MP3_FORMATS = ['VBR MP3', '320Kbps MP3', '256Kbps MP3', '128Kbps MP3', '64Kbps MP3', 'MP3'];

/** Sucheingabe ohne Sonderzeichen der Such-Sprache (Lucene) */
export function cleanQuery(q: string): string {
  return q
    .replace(/[^\p{L}\p{N}\s'.-]/gu, ' ')
    .replace(/\b(AND|OR|NOT|TO)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "312.45" oder "05:12" oder "1:02:03" → Millisekunden */
export function parseLength(len: string | undefined): number {
  if (!len) return 0;
  if (/^\d+(\.\d+)?$/.test(len)) return Math.round(Number(len) * 1000);
  const parts = len.split(':').map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return 0;
  return Math.round(parts.reduce((acc, p) => acc * 60 + p, 0) * 1000);
}

function encodePath(name: string): string {
  return name.split('/').map(encodeURIComponent).join('/');
}

function thumb(identifier: string): string {
  return `${ARCHIVE_ORIGIN}/services/img/${encodeURIComponent(identifier)}`;
}

function itemLicense(licenseurl: string | undefined, collections: string[]): License | undefined {
  const cc = parseCcLicense(licenseurl);
  if (cc) return cc;
  if (collections.includes('etree')) return LMA_LICENSE;
  return undefined;
}

function trackNo(f: ApiFile): number {
  const n = parseInt((f.track ?? '').split('/')[0] ?? '', 10);
  return Number.isFinite(n) ? n : 9999;
}

/** Wählt die Audiodateien eines Eintrags: ein MP3-Format, sortiert nach Tracknummer */
export function pickAudioFiles(files: ApiFile[]): ApiFile[] {
  for (const fmt of MP3_FORMATS) {
    const list = files.filter((f) => f.format === fmt && /\.mp3$/i.test(f.name));
    if (list.length > 0) {
      return list.sort((a, b) => trackNo(a) - trackNo(b) || a.name.localeCompare(b.name));
    }
  }
  return [];
}

export interface ArchiveOptions {
  fetch?: FetchLike;
}

/**
 * Internet Archive: Live Music Archive und freie Netlabels über die öffentliche Such-API.
 * Ein Eintrag (z. B. ein Konzert) ist bei uns ein „Album“ mit mehreren Songs.
 */
export class ArchiveSource implements MusicSource {
  readonly id = 'archive' as const;
  readonly name = 'Internet Archive';
  readonly needsLogin = false;
  readonly searchTypes: SearchType[] = ['track', 'album'];
  readonly playbackMode = 'url' as const;
  readonly canUseWebAudio = true;
  readonly allowsOfflineCache = true;

  private readonly fetchImpl: FetchLike;

  constructor(opts: ArchiveOptions = {}) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Anzahl der Aufnahmen mit klarer Lizenz (Konzerte des Live Music Archive + Netlabels mit Lizenz).
   * Jede Aufnahme hat mindestens einen Song – die Zahl ist also eine Untergrenze.
   */
  async countTracks(query: string, signal?: AbortSignal): Promise<number> {
    const q = cleanQuery(query);
    if (!q) return 0;
    const params = new URLSearchParams();
    params.set(
      'q',
      `(${q}) AND mediatype:audio AND (collection:etree OR (collection:netlabels AND licenseurl:[* TO *]))`,
    );
    params.append('fl[]', 'identifier');
    params.set('rows', '0');
    params.set('output', 'json');
    const json = await getJson(
      this.fetchImpl,
      'archive',
      `${ARCHIVE_ORIGIN}/advancedsearch.php?${params.toString()}`,
      { signal },
    );
    const r = searchResponseSchema.safeParse(json);
    return r.success ? (r.data.response.numFound ?? 0) : 0;
  }

  private async searchDocs(
    query: string,
    rows: number,
    page: number,
    sort: string,
    signal?: AbortSignal,
  ): Promise<Doc[]> {
    const params = new URLSearchParams();
    const collections = `collection:(${ARCHIVE_COLLECTIONS.join(' OR ')})`;
    params.set('q', `${query ? `(${query}) AND ` : ''}mediatype:audio AND ${collections}`);
    for (const f of ['identifier', 'title', 'creator', 'licenseurl', 'year', 'collection']) {
      params.append('fl[]', f);
    }
    params.append('sort[]', sort);
    params.set('rows', String(rows));
    params.set('page', String(page));
    params.set('output', 'json');
    const json = await getJson(
      this.fetchImpl,
      'archive',
      `${ARCHIVE_ORIGIN}/advancedsearch.php?${params.toString()}`,
      { signal },
    );
    const r = searchResponseSchema.safeParse(json);
    if (!r.success) throw new SourceError('archive', 'badResponse');
    const docs: Doc[] = [];
    for (const d of r.data.response.docs) {
      const p = docSchema.safeParse(d);
      if (!p.success) continue;
      // Nur mit klarer Lizenz (Creative Commons / Public Domain) oder aus dem Live Music Archive
      if (!itemLicense(p.data.licenseurl, p.data.collection ?? [])) continue;
      docs.push(p.data);
    }
    return docs;
  }

  private docToAlbum(d: Doc): Album {
    const year = Number(String(d.year ?? '').slice(0, 4));
    return {
      id: d.identifier,
      sourceId: 'archive',
      title: d.title?.[0] ?? d.identifier,
      artists: d.creator?.slice(0, 3) ?? [],
      artworkUrl: thumb(d.identifier),
      year: Number.isFinite(year) && year > 0 ? year : undefined,
    };
  }

  /** Lädt einen Eintrag mit allen abspielbaren Songs */
  private async loadItem(identifier: string, signal?: AbortSignal) {
    const json = await getJson(
      this.fetchImpl,
      'archive',
      `${ARCHIVE_ORIGIN}/metadata/${encodeURIComponent(identifier)}`,
      { signal },
    );
    const r = metadataSchema.safeParse(json);
    if (!r.success) throw new SourceError('archive', 'notFound');
    const meta = r.data.metadata;
    const license = itemLicense(meta.licenseurl, meta.collection ?? []);
    if (!license) throw new SourceError('archive', 'notFound');
    const files: ApiFile[] = [];
    for (const f of r.data.files ?? []) {
      const p = fileSchema.safeParse(f);
      if (p.success) files.push(p.data);
    }
    const albumTitle = meta.title?.[0] ?? identifier;
    const itemArtist = meta.creator?.[0];
    const tracks: Track[] = pickAudioFiles(files).map((f) => ({
      id: `${identifier}/${f.name}`,
      sourceId: 'archive',
      title: f.title?.trim() || f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '),
      artists: [f.creator ?? itemArtist].filter((a): a is string => !!a),
      album: albumTitle,
      albumId: identifier,
      durationMs: parseLength(f.length),
      artworkUrl: thumb(identifier),
      license,
      permalink: `${ARCHIVE_ORIGIN}/details/${encodeURIComponent(identifier)}`,
    }));
    const year = Number((meta.date ?? '').slice(0, 4));
    const album: Album = {
      id: identifier,
      sourceId: 'archive',
      title: albumTitle,
      artists: meta.creator?.slice(0, 3) ?? [],
      artworkUrl: thumb(identifier),
      year: Number.isFinite(year) && year > 0 ? year : undefined,
      trackCount: tracks.length,
      tracks,
    };
    return album;
  }

  /** Songs aus den ersten Einträgen holen (die Such-API findet Einträge, keine einzelnen Songs) */
  private async tracksFromDocs(docs: Doc[], perItem: number, signal?: AbortSignal) {
    const albums = await Promise.allSettled(docs.map((d) => this.loadItem(d.identifier, signal)));
    if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    const ok = albums.filter((a): a is PromiseFulfilledResult<Album> => a.status === 'fulfilled');
    if (ok.length === 0 && albums.length > 0) {
      const first = albums[0] as PromiseRejectedResult;
      throw first.reason;
    }
    return ok.flatMap((a) => (a.value.tracks ?? []).slice(0, perItem));
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
    const { type = 'track', limit = 20, offset = 0, signal } = opts;
    const result = emptyResult();
    const q = cleanQuery(query);
    if (!q || (type !== 'track' && type !== 'album')) return result;
    if (type === 'album') {
      const page = Math.floor(offset / limit) + 1;
      const docs = await this.searchDocs(q, limit, page, 'downloads desc', signal);
      result.albums = docs.map((d) => this.docToAlbum(d));
      return result;
    }
    const docs = await this.searchDocs(q, 4, 1, 'downloads desc', signal);
    result.tracks = (await this.tracksFromDocs(docs, 5, signal)).slice(0, limit);
    return result;
  }

  async getTrending(): Promise<Track[]> {
    const docs = await this.searchDocs('', 4, 1, 'week desc', undefined);
    return this.tracksFromDocs(docs, 3);
  }

  async getAlbum(id: string): Promise<Album> {
    return this.loadItem(id);
  }

  async getTrack(id: string): Promise<Track> {
    const slash = id.indexOf('/');
    if (slash < 1) throw new SourceError('archive', 'notFound');
    const album = await this.loadItem(id.slice(0, slash));
    const t = album.tracks?.find((x) => x.id === id);
    if (!t) throw new SourceError('archive', 'notFound');
    return t;
  }

  async getStreamUrl(track: Track): Promise<string> {
    const slash = track.id.indexOf('/');
    if (slash < 1) throw new SourceError('archive', 'notFound');
    const identifier = track.id.slice(0, slash);
    const file = track.id.slice(slash + 1);
    const url = safeHttpsUrl(
      `${ARCHIVE_ORIGIN}/download/${encodeURIComponent(identifier)}/${encodePath(file)}`,
    );
    if (!url) throw new SourceError('archive', 'notFound');
    return url;
  }
}
