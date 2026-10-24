# Klangraum – Übergabe für neue Sitzungen

Stand: 24.10.2026, **Phase 1 fertig** (Grundgerüst). Auftrag mit allen Phasen: `docs/AUFTRAG.md`.

## Der Nutzer

- Deutsch, kein Programmierer: kurz, einfach, Schritt für Schritt; Klick-Anleitungen eine Aktion nach der anderen.
- Will nach jeder Phase: 3–6 Sätze (neu / ausprobieren / als Nächstes), Screenshots PC + Handy, Git-Commit.
- Vermutlich minderjährig → bei Konten (Jamendo, Firebase, Spotify Premium) auf Eltern hinweisen.
- Nutzt iPad/iPhone; zum Testen am iPhone braucht er eine Online-Adresse (noch offen, siehe unten).

## Wo was liegt

- Ordner `klangraum/` im Repo `Tiefenrausch` (Branch `claude/new-session-dwbtel`). Das Spiel (`index.html` im
  Hauptordner, GitHub Pages vom Branch `claude/tiefen-raush-code-review-jb306f`) ist davon unberührt.
- Technik wie im Auftrag: Vite 7 + React 18 + TypeScript (strict, `noUncheckedIndexedAccess`), Zustand 5,
  React Router 7 (**Hash-Router** `#/suche` → läuft in jedem Unterordner ohne Server-Regeln), zod 4,
  dnd-kit, Vitest 3 + Testing Library, Playwright 1.63 (genau diese Version = vorinstallierter Chromium),
  ESLint 9 + Prettier. Noch nicht installiert (kommt mit der jeweiligen Phase): idb, firebase,
  vite-plugin-pwa, lz-string, music-metadata.

## Aufbau (`src/`)

- `sources/types.ts` – `MusicSource`-Interface, `Track` (zod-Schema `trackSchema`, nur http(s)-URLs),
  `trackKey` = `${sourceId}:${id}`, `SourceError` (kind: network/unavailable/notFound/rateLimit/badResponse).
- `sources/audius` – fragt `https://api.audius.co` nach Servern (Antwort `{data:[hosts]}`), nimmt max. 3 + immer
  `api.audius.co` selbst als Rückfall; bei Fehler nächster Server; `app_name=Klangraum` an jeder Anfrage;
  Stream `/v1/tracks/{id}/stream`. Gesperrte/bezahlte Songs (`is_streamable:false`, `stream_conditions`) fliegen raus.
- `sources/jamendo` – `client_id` aus Einstellungen (in der App eintragbar) oder `VITE_JAMENDO_CLIENT_ID`;
  ohne ID still aus. Lizenz aus `license_ccurl` → „CC BY-NC-SA 3.0“. Stream-URL (`audio`) wird gemerkt,
  sonst per `/tracks/?id=` nachgeholt.
- `sources/registry.ts`, `useActiveSources.ts` (an + verfügbar), `useMultiSearch.ts` (jede Quelle einzeln).
- `player/queue.ts` – reine Warteschlangen-Logik (Zufall = Fisher-Yates nur für kommende Songs,
  ursprüngliche Reihenfolge in `original` gemerkt; Wiederholen aus/alle/einer).
- `player/engine.ts` – `PlayerEngine` (zentrale Steuerung, Zustand in einem Zustand-Store). UI spricht nur
  mit der Engine (`usePlayer()`, `usePlayerState(selector)` aus `app/context.ts`). Ausgabe austauschbar
  (`player/output.ts`: `PlaybackOutput`, jetzt `HtmlAudioOutput`; Phase 3: Spotify-Ausgabe).
  Ladevorgänge mit Token gegen Wettrennen, kaputte Songs werden max. 3× übersprungen.
- `player/mediaSession.ts` – Sperrbildschirm/Kopfhörer; `player/persist.ts` – Warteschlange in localStorage.
- iOS: `<audio playsinline>`, Freischalten beim ersten Tippen (`unlock()` mit stiller WAV, nur Apple-Geräte),
  Lautstärke-Regler wird auf iOS durch einen Hinweis ersetzt (iOS erlaubt das nicht).
  **Kein** `crossOrigin` am Audio-Element – kommt erst mit Web Audio in Phase 5 (sonst blockt CORS das Abspielen).
- `customize/themes.ts` – 3 Themes (Mitternacht, Hell, OLED-Schwarz), Farben nur `#hex` (zod), CSS-Variablen
  `--kr-bg`, `--kr-surface-raised` … (`cssVarName`). `customize/contrast.ts` – WCAG-Kontrast (Tests prüfen alle Themes).
- `storage/settings.ts` – EIN Einstellungs-Objekt mit `schemaVersion` + `storage/migrations.ts`;
  kaputte Felder werden einzeln durch Standardwerte ersetzt. Zustand-Store: `app/settingsStore.ts`.
- `i18n/de.ts` (Quelle), `i18n/en.ts` (Typ erzwingt gleiche Schlüssel), `useT()`, `translate()`.
- `app/` – `setup.ts` (startet alles), `AppShell` (Menü unten am Handy / links ab 768 px, Mini-Player,
  Meldungen, Screenreader-Ansage), `router.tsx` (Seiten per `lazy` = Code-Splitting).
- `pages/` – Start (Trending), Suche, Album/Künstler/Playlist (`CollectionPage`), Vollbild-Player
  („Großes Cover“), Warteschlange (dnd-kit, Tastatur + Maus/Finger am Griff), Anpassen, Einstellungen,
  Bibliothek (Platzhalter), 404.

## Tests

- `npm run lint`, `npm run typecheck`, `npm test` (90 Unit-Tests) – vor jedem Commit grün.
- `npm run e2e` – 12 Tests × PC/iPhone. Baut mit `--mode e2e` (`.env.e2e` = ausgedachte Jamendo-ID) nach
  `dist-e2e/`, alle Netz-Anfragen werden in `tests/e2e/mocks.ts` abgefangen (Test-Ton als WAV, SVG-Cover).
  Browser-Sprache im Test: `de-DE`.
- Screenshots: `SCREENS=1 npx playwright test screens` → `docs/screenshots/phase1/` (nicht in Git, zu groß).

## Ehrlich: noch nicht geprüft

- Echte Audius-/Jamendo-Server: in der Cloud-Sitzung sind `api.audius.co` und `api.jamendo.com` gesperrt.
  Die Antwort-Formate stammen aus der Doku/Erfahrung; Adapter sind tolerant (zod, kaputte Einträge werden übersprungen).
- Echtes iPhone/iPad (nur Chromium mit iPhone-Größe und -Kennung getestet).

## Offen / nächste Schritte

- Online-Adresse zum Testen am iPhone (Vorschlag: gebaute App unter `…/Tiefenrausch/klangraum/` auf den
  Pages-Branch – nur mit Erlaubnis des Nutzers; Firebase Hosting kommt in Phase 6).
- Phase 2: Favoriten, Playlists, Verlauf (idb), Firebase Auth (Google + anonym) + Firestore-Sync,
  `firestore.rules` + Emulator-Tests, E2E „in Playlist legen“. Eigenes Firebase-Projekt empfehlen (nicht das Spiel-Projekt).
