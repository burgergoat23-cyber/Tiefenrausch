import { useCallback, useEffect, useState } from 'react';
import { isAbortError } from './http';
import type { MusicSource, SearchResult, SearchType, SourceId } from './types';

export type SourceSearchState =
  | { status: 'loading' }
  | { status: 'done'; result: SearchResult }
  | { status: 'error'; error: unknown };

/**
 * Sucht in allen übergebenen Quellen gleichzeitig.
 * Jede Quelle meldet sich einzeln – eine langsame Quelle hält die anderen nicht auf.
 */
export function useMultiSearch(query: string, type: SearchType, sources: MusicSource[]) {
  const [states, setStates] = useState<Partial<Record<SourceId, SourceSearchState>>>({});
  const [retry, setRetry] = useState<Partial<Record<SourceId, number>>>({});
  const q = query.trim();

  useEffect(() => {
    if (!q) {
      setStates({});
      return;
    }
    const ctrl = new AbortController();
    setStates(Object.fromEntries(sources.map((s) => [s.id, { status: 'loading' }])));
    for (const source of sources) {
      source
        .search(q, { type, limit: 20, signal: ctrl.signal })
        .then((result) => {
          if (!ctrl.signal.aborted)
            setStates((prev) => ({ ...prev, [source.id]: { status: 'done', result } }));
        })
        .catch((error: unknown) => {
          if (ctrl.signal.aborted || isAbortError(error)) return;
          setStates((prev) => ({ ...prev, [source.id]: { status: 'error', error } }));
        });
    }
    return () => ctrl.abort();
  }, [q, type, sources, retry]);

  const retrySource = useCallback((id: SourceId) => {
    setRetry((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
  }, []);

  return { states, retrySource };
}
