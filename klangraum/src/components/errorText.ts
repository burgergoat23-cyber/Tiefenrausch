import type { TFunction } from '../i18n';
import { sourceName } from '../sources/names';
import { SourceError, type SourceId } from '../sources/types';

/** Freundliche Fehlermeldung auf Deutsch/Englisch aus einem beliebigen Fehler */
export function errorText(t: TFunction, err: unknown, sourceId: SourceId): string {
  const kind = err instanceof SourceError ? err.kind : 'network';
  return t(`errors.${kind}`, { source: sourceName(sourceId) });
}
