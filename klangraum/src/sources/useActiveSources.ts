import { useEffect, useMemo, useState } from 'react';
import { useSources } from '../app/context';
import { useSettings } from '../app/settingsStore';
import type { MusicSource, SourceId } from './types';

export interface SourceStatus {
  source: MusicSource;
  enabled: boolean;
  available: boolean;
}

/** Alle Quellen mit Status: eingeschaltet (Einstellungen) und verfügbar (z. B. Client-ID vorhanden) */
export function useSourceStatus(): { statuses: SourceStatus[]; ready: boolean } {
  const registry = useSources();
  const enabledMap = useSettings((s) => s.settings.sources);
  const jamendoId = useSettings((s) => s.settings.jamendoClientId);
  const [availability, setAvailability] = useState<Partial<Record<SourceId, boolean>> | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(
      registry.all.map(async (s) => [s.id, await s.isAvailable().catch(() => false)] as const),
    ).then((pairs) => {
      if (alive) setAvailability(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [registry, jamendoId]);

  const statuses = registry.all.map((source) => ({
    source,
    enabled: enabledMap[source.id] ?? true,
    available: availability?.[source.id] ?? false,
  }));
  return { statuses, ready: availability !== null };
}

/** Nur die Quellen, die eingeschaltet UND verfügbar sind */
export function useActiveSources(): { sources: MusicSource[]; ready: boolean } {
  const registry = useSources();
  const { statuses, ready } = useSourceStatus();
  const ids = statuses
    .filter((s) => s.enabled && s.available)
    .map((s) => s.source.id)
    .join(',');
  // Gleiche Liste → gleiches Objekt, damit Effekte nicht unnötig neu laufen
  const sources = useMemo(
    () =>
      ids
        .split(',')
        .map((id) => registry.get(id as SourceId))
        .filter((s): s is MusicSource => !!s),
    [ids, registry],
  );
  return { sources, ready };
}
