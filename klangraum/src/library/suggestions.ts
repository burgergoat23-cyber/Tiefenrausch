/**
 * Vorschläge für „Deine Musik“: bekannte Künstler und Genres aus dem Bereich Drill/Street-Rap.
 * Das sind nur Namen zum Suchen – gespielt wird, was die legalen Quellen (z. B. YouTube) anbieten.
 */
export const SUGGESTED_ARTISTS: readonly string[] = [
  // Chicago
  'Lil Durk',
  'Chief Keef',
  'G Herbo',
  'Polo G',
  'Lil Reese',
  'FBG Duck',
  'Lil Tjay',
  // New York
  'Pop Smoke',
  'Fivio Foreign',
  'Kay Flock',
  'Sheff G',
  'Sleepy Hallow',
  // UK
  'Central Cee',
  'Digga D',
  'Headie One',
  'Unknown T',
  // Süden
  'NLE Choppa',
  'Kodak Black',
];

export const SUGGESTED_GENRES: readonly string[] = [
  'Drill',
  'Chicago Drill',
  'NY Drill',
  'UK Drill',
  'Trap',
  'Hip-Hop',
];

/** Vorschläge, die noch nicht in der Liste stehen (Groß-/Kleinschreibung egal) */
export function openSuggestions(all: readonly string[], chosen: string[]): string[] {
  const have = new Set(chosen.map((c) => c.toLowerCase()));
  return all.filter((s) => !have.has(s.toLowerCase()));
}
