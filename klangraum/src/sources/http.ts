import { SourceError, type SourceId } from './types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GetJsonOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Holt JSON und wandelt alle Probleme in einen SourceError um. */
export async function getJson(
  fetchImpl: FetchLike,
  sourceId: SourceId,
  url: string,
  { signal, timeoutMs = 10000 }: GetJsonOptions = {},
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) throw new SourceError(sourceId, 'notFound');
    if (res.status === 429) throw new SourceError(sourceId, 'rateLimit');
    if (!res.ok) throw new SourceError(sourceId, 'network', `HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new SourceError(sourceId, 'badResponse');
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    if (err instanceof SourceError) throw err;
    throw new SourceError(sourceId, 'network', String(err));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Baut eine Adresse mit Such-Parametern (leere Werte werden weggelassen). */
export function withParams(base: string, params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

/** http → https, alles andere (javascript:, data: …) wird verworfen. */
export function safeHttpsUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2000) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (u.protocol !== 'https:') return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
