import { z } from 'zod';
import { parseSettings, type Settings } from '../storage/settings';
import { parseLibrary, type LibraryData } from './library';

/**
 * Sicherung als JSON-Datei: Bibliothek + Einstellungen. Nur Daten – niemals Code oder CSS.
 * Der YouTube-Schlüssel kommt nicht mit hinein (falls jemand die Datei weitergibt).
 */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const backupSchema = z.object({
  app: z.literal('klangraum'),
  kind: z.literal('backup'),
  version: z.literal(1),
  exportedAt: z.number().optional(),
  settings: z.unknown().optional(),
  library: z.unknown(),
});

export function buildBackup(settings: Settings, library: LibraryData, now = Date.now()) {
  const { youtubeApiKey: _omit, ...rest } = settings;
  void _omit;
  return { app: 'klangraum', kind: 'backup', version: 1, exportedAt: now, settings: rest, library };
}

export interface ParsedBackup {
  library: LibraryData;
  /** Einstellungen aus der Datei, eigener YouTube-Schlüssel bleibt erhalten */
  settings: Settings | null;
}

export function parseBackup(text: string, current: Settings): ParsedBackup | null {
  if (text.length > MAX_BACKUP_BYTES) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const b = backupSchema.safeParse(raw);
  if (!b.success) return null;
  const settings =
    b.data.settings && typeof b.data.settings === 'object'
      ? { ...parseSettings({ ...b.data.settings, youtubeApiKey: current.youtubeApiKey }, current) }
      : null;
  return { library: parseLibrary(b.data.library), settings };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
