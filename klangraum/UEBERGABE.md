# Klangraum – Übergabe für neue Sitzungen

Stand: 24.10.2026, **Phase 1 fertig** (Grundgerüst) + **zusätzliche Quellen Internet Archive und Internetradio** (auf Wunsch des Nutzers „so viele Lieder wie möglich“, vorgezogen aus Phase 4). Auftrag mit allen Phasen: `docs/AUFTRAG.md`.

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
- `sources/archive` – Internet Archive, **nur** Sammlungen `etree` (Live Music Archive, Bands erlauben
  Weitergabe) und `netlabels`; Einträge ohne CC/Public-Domain-Lizenz (außer etree) fliegen raus.
  Such-API `advancedsearch.php` findet Einträge (= Alben); für „Songs“ werden die 4 besten Einträge per
  `/metadata/{id}` geladen (je max. 5 MP3s). Track-ID = `{identifier}/{dateiname}`, Stream
  `/download/{id}/{datei}`, Cover `/services/img/{id}`. `searchTypes: ['track','album']`.
- `sources/radio` – Internetradio über radio-browser.info (feste Serverliste, bei Fehler nächster).
  Nur https-Streams, `hidebroken`, kein HLS, nur MP3/AAC (läuft auch am iPhone). Sender = Track mit
  `live: true`, `durationMs: 0` → UI zeigt „LIVE“ statt Fortschritt, kein Spulen, Start immer „jetzt“.
  Beliebte Sender nach Ländercode der Browser-Sprache. Start wird per `/json/url/{uuid}` gemeldet (Bitte
  des Verzeichnisses). `canUseWebAudio: false` (Radio-Streams haben meist kein CORS). Nur Such-Art „Songs“.
- `MusicSource.searchTypes` (optional): Suche zeigt eine Quelle nur bei Such-Arten, die sie kann.
- `sources/youtube` – **offizielle** YouTube-Anbindung (Nutzer wollte „das mit den Videos“):
  Suche über YouTube Data API v3 (`search` type=video, Kategorie 10 = Musik, `videoEmbeddable`, danach
  `videos` für Länge/einbettbar/Altersfreigabe; Playlists über `playlists` + `playlistItems`; Charts
  `videos?chart=mostPopular`). Schlüssel: Einstellungen (`youtubeApiKey`) oder `VITE_YOUTUBE_API_KEY`,
  ohne Schlüssel still aus. Kontingent 10 000 Einheiten/Tag, Suche = 101 → `costlySearch: true`: YouTube
  wird erst nach Enter/„Suchen“ gefragt (Knopf „Jetzt bei YouTube suchen“), Antworten werden gecacht.
  Fehlerarten `quota` und `badKey` mit eigenen Meldungen. `playbackMode: 'external'`.
- `player/youtubeOutput.ts` – zweite Ausgabe: offizieller IFrame-Player (youtube-nocookie.com,
  `playsinline`). Das iframe liegt in einem festen `div.kr-video-host` im body und wird **nie umgehängt**;
  `components/VideoDock.tsx` legt es per rAF genau über einen Platzhalter: `VideoSlot` im Vollbild-Player
  (16:9, mind. 200 px hoch) oder ein schwebendes Fenster über dem Mini-Player (200 × 200 bzw. 356 × 200,
  `box-sizing: content-box` wegen Rahmen!). „×“ pausiert und blendet aus. YouTube-Regeln: Video sichtbar,
  mind. 200 × 200, nichts drüberlegen, kein Ton-Extrahieren, keine Hintergrund-Wiedergabe – am iPhone
  stoppt es beim Sperren (ehrlicher Hinweis in Einstellungen). Am iPhone startet das Video evtl. erst nach
  einem Tipp aufs Video (Timeout 4 s → NotAllowedError → pausiert + Hinweis im Player).
  Links zu YouTube-Nutzungsbedingungen/Google-Datenschutz unter Einstellungen → Über.
- Engine kann mehrere Ausgaben: `deps.output` (eigenes Audio) + `getExternalOutput(source)`; beim Wechsel
  wird die alte Ausgabe gestoppt, Rückmeldungen nicht aktiver Ausgaben werden ignoriert, Lautstärke gilt für alle.
- Einstellungen: Migration 1 → 2 ergänzt `youtubeApiKey`, 2 → 3 die Favoriten (siehe „Für dich“).
- **„Für dich“** (Wunsch des Nutzers: Drill, King Von, Bloodhound Lil Jeff, YNW Melly): Einstellungen
  `favoriteArtists`/`favoriteGenres` (Startwerte genau diese, änderbar unter Einstellungen → Deine Musik;
  Settings jetzt `schemaVersion: 3`, Migration 2 → 3). `library/forYou.ts`: Künstler über YouTube
  (offizieller Player, 24 h im `storage/cache.ts` gemerkt → ca. 303 Einheiten/Tag), Genres über Audius
  (unabhängige Künstler) + Internetradio (6 h gemerkt), abwechselnd gemischt ohne Doppelte.
  Startseite `pages/ForYouSection.tsx`; ohne YouTube-Schlüssel ehrlicher Hinweis.
  „Noch mehr“ (24.10.): 25 Songs pro Künstler, Mix bis 200 Songs, YouTube-Playlists pro Genre
  (`search` type=playlist, 24 h gemerkt), Künstler-Knöpfe im „Für dich“-Bereich; Startkünstler auf 10
  erweitert (Settings `schemaVersion: 4`, Migration 3 → 4 ergänzt nur fehlende, eigene bleiben);
  Vorschläge zum Antippen in `library/suggestions.ts`. Zwischenspeicher jetzt allgemein
  (`storage/cache.ts`: `get(key, zodSchema)`). Kontingent bei 10 Künstlern + 1 Genre ≈ 1 100 Einheiten/Tag. Suche zeigt bei leerem
  Feld „Deine Künstler“ als Schnellwahl (zählt als bestätigte Suche). Es wird nichts heruntergeladen.
- **Originale Cover** (`library/covers.ts`): Für YouTube-Songs (nur Video-Standbilder) und Songs ohne
  Bild sucht die App per MusicBrainz (`/ws/2/recording?query=recording:"…" AND artist:"…"`) die erste
  offizielle Single/EP/Album-Veröffentlichung (keine Sampler/Live), Bild vom Cover Art Archive
  (`/release-group/{id}/front-500`). Titel werden bereinigt (`parseArtistTitle`: „Künstler - Titel
  (Official Video)“). Max. 1 Anfrage/s (Regel von MusicBrainz), Treffer 30 Tage gemerkt, „nichts
  gefunden“ 7 Tage, Netzfehler gar nicht. Gesucht wird erst, wenn das Cover sichtbar ist
  (`TrackArtwork`, IntersectionObserver auf dem Bild selbst – nicht auf `display: contents`!).
  Bilder werden nur verlinkt, nie gespeichert. `useCovers`-Store auch für Sperrbildschirm
  (`connectMediaSession(…, covers)`). In Unit-Tests aus (`setCoverResolver(null)` in `test/setup.ts`).
  Ohne Bild: Farbverlauf aus Theme-Farben + Anfangsbuchstaben (`Artwork`, `srcs`-Kette mit Rückfall).
- **Design „cleaner“** (24.10.): keine harten Rahmen, gefüllte Knöpfe/Chips, mehr Abstand
  (`--kr-page-x`), Menüleiste und Mini-Player mit Milchglas (Mini-Player am Handy als schwebende Karte),
  Startseite mit Cover-Reihen zum Wischen (`components/Shelf.tsx`: `Shelf`, `TrackShelf`, `CoverMosaic`),
  „Für dich“ mit Collage aus 4 Covern. Wichtig: `body { overflow-x: clip }` statt `hidden` – sonst gilt
  `body` als Scroll-Bereich und dnd-kit (Tastatur-Verschieben) bewegt nichts.
- **Look nach Vorbild Apple Music, aber in Grün/Khaki** (Wunsch des Nutzers, 25.10.; nur Aufbau als
  Vorbild – keine Logos/Symbole/Bilder von Apple): Themes **Oliv** (neuer Standard, `DEFAULT_THEME_ID`)
  und **Khaki**; Seitenleiste in Gruppen (`NAV_GROUPS` in `AppShell.tsx`: oben Start/Suche/Radio,
  „Mediathek“, „Gestalten“; Symbole in Akzentfarbe, leichter Akzent-Verlauf); am Handy nur Punkte mit
  `tab: true` (Start, Suche, Radio, Bibliothek, Einstellungen – „Anpassen“ per Knopf in den Einstellungen).
  Mini-Player ab 768 px als schwebende Pille (Zufall/Zurück/Play/Weiter/Wiederholen | Song | Lautstärke,
  Warteschlange). Großer Player ab 1024 px mit Warteschlange rechts (`components/QueueList.tsx`:
  `UpNextList` wird auch von der Warteschlangen-Seite benutzt). Song-Listen ab 1100 px mit Album-Spalte.
  Neue Seite **Radio** (`pages/RadioPage.tsx`): beliebte Sender + Sender nach Genre (Lieblingsgenres vorne).
- **Redesign „weniger KI-Look“** (25.10., Wunsch des Nutzers): Überschriften-Schrift **Archivo**
  (`@fontsource-variable/archivo`, SIL OFL, mitgeliefert, keine Google-Server; `--kr-font-heading`,
  schmal über `font-stretch`), Seitentitel in Großbuchstaben, kleine Zeilen `.kr-label`; kleinere Ecken
  (`--kr-radius` 10, `--kr-radius-art` 6), Knöpfe/Chips mit feiner Linie statt bunter Blasen, keine
  Leuchtverläufe/Schatten auf Kacheln, Listen mit Trennlinien, Seitenleiste mit Schriftzug „KLANGRAUM“.
  Startseite: Datum + „START“ statt Gruß und Fülltext; „Für dich“ flach (Vorlesetext der Überschrift per
  `aria-label`, weil die Zeilen untereinander/in Großbuchstaben stehen).
- **Gestaltete Cover** (`Artwork`): ohne Bild ein schlichtes Plattencover (ruhige Farbe aus
  `--kr-sleeve-1…8`, Künstler oben, Titel groß unten; bei kleinen Covern < 90 px nur Anfangsbuchstaben).
  Radiosender bekommen immer so eine Kachel (Logo nur, wenn es ≥ 64 px groß lädt), Live-Music-Archive-
  Konzerte ebenfalls (statt Archiv-Logo). Cover-Suche: erst genau, dann locker (einzelne Wörter).
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

- `npm run lint`, `npm run typecheck`, `npm test` (147 Unit-Tests) – vor jedem Commit grün.
- `npm run e2e` – 26 Tests × PC/iPhone (YouTube mit nachgebautem IFrame-Player `FAKE_YT_API` in `mocks.ts`). Baut mit `--mode e2e` (`.env.e2e` = ausgedachte Jamendo-ID) nach
  `dist-e2e/`, alle Netz-Anfragen werden in `tests/e2e/mocks.ts` abgefangen (Test-Ton als WAV, SVG-Cover).
  Browser-Sprache im Test: `de-DE`.
- Screenshots: `SCREENS=1 npx playwright test screens` → `docs/screenshots/phase1/` (nicht in Git, zu groß).

## Ehrlich: noch nicht geprüft

- Echte Server: in der Cloud-Sitzung sind `api.audius.co`, `api.jamendo.com`, `archive.org`, `*.api.radio-browser.info`, `googleapis.com`, `youtube.com`, `musicbrainz.org` und `coverartarchive.org` gesperrt.
  Die Antwort-Formate stammen aus der Doku/Erfahrung; Adapter sind tolerant (zod, kaputte Einträge werden übersprungen).
- Echtes iPhone/iPad (nur Chromium mit iPhone-Größe und -Kennung getestet).

## Offen / nächste Schritte

- Online-Adresse zum Testen am iPhone (Vorschlag: gebaute App unter `…/Tiefenrausch/klangraum/` auf den
  Pages-Branch – nur mit Erlaubnis des Nutzers; Firebase Hosting kommt in Phase 6).
- Phase 2: Favoriten, Playlists, Verlauf (idb), Firebase Auth (Google + anonym) + Firestore-Sync,
  `firestore.rules` + Emulator-Tests, E2E „in Playlist legen“. Eigenes Firebase-Projekt empfehlen (nicht das Spiel-Projekt).
