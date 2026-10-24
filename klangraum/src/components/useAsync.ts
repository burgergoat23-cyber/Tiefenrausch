import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'done'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: unknown };

/** Lädt Daten, sobald sich `deps` ändern. Veraltete Antworten werden ignoriert. */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [token, setToken] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    loadRef
      .current(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setState({ status: 'done', data });
      })
      .catch((error: unknown) => {
        if (!ctrl.signal.aborted) setState({ status: 'error', error });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, token]);

  const reload = useCallback(() => setToken((n) => n + 1), []);
  return { ...state, reload };
}
