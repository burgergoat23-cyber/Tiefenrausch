import type { Track } from '../sources/types';

/** Erzeugt Test-Songs: track('a') → Song mit id 'a' */
export function track(id: string, extra: Partial<Track> = {}): Track {
  return {
    id,
    sourceId: 'audius',
    title: `Song ${id}`,
    artists: [`Artist ${id}`],
    durationMs: 180000,
    ...extra,
  };
}

export function tracks(...ids: string[]): Track[] {
  return ids.map((id) => track(id));
}

/** Vorhersagbarer Zufall für Tests */
export function seededRandom(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Minimale fetch-Antwort */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
