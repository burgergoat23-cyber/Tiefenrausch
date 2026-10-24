/**
 * Migrationen: Wenn sich der Aufbau der Einstellungen ändert, erhöhen wir `schemaVersion`
 * und schreiben hier eine Funktion, die alte Daten in die neue Form bringt.
 * Schlüssel = Version, VON der migriert wird (1 → 2 steht unter 1).
 */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export function runMigrations(
  input: unknown,
  migrations: Record<number, Migration>,
  currentVersion: number,
): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  let data = { ...(input as Record<string, unknown>) };
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (!Number.isInteger(version) || version > currentVersion) return null; // aus der Zukunft → nicht anfassen
  while (version < currentVersion) {
    const step = migrations[version];
    if (!step) return null;
    data = step(data);
    version += 1;
    data.schemaVersion = version;
  }
  return data;
}
