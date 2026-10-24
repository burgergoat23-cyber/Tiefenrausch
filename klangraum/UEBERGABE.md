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
- Einstellungen jetzt `schemaVersion: 2` (Migration 1 → 2 ergänzt `youtubeApiKey`).
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

- `npm run lint`, `npm run typecheck`, `npm test` (117 Unit-Tests) – vor jedem Commit grün.
- `npm run e2e` – 17 Tests × PC/iPhone (YouTube mit nachgebautem IFrame-Player `FAKE_YT_API` in `mocks.ts`). Baut mit `--mode e2e` (`.env.e2e` = ausgedachte Jamendo-ID) nach
  `dist-e2e/`, alle Netz-Anfragen werden in `tests/e2e/mocks.ts` abgefangen (Test-Ton als WAV, SVG-Cover).
  Browser-Sprache im Test: `de-DE`.
- Screenshots: `SCREENS=1 npx playwright test screens` → `docs/screenshots/phase1/` (nicht in Git, zu groß).

## Ehrlich: noch nicht geprüft

- Echte Server: in der Cloud-Sitzung sind `api.audius.co`, `api.jamendo.com`, `archive.org`, `*.api.radio-browser.info`, `googleapis.com` und `youtube.com` gesperrt.
  Die Antwort-Formate stammen aus der Doku/Erfahrung; Adapter sind tolerant (zod, kaputte Einträge werden übersprungen).
- Echtes iPhone/iPad (nur Chromium mit iPhone-Größe und -Kennung getestet).

## Offen / nächste Schritte

- Online-Adresse zum Testen am iPhone (Vorschlag: gebaute App unter `…/Tiefenrausch/klangraum/` auf den
  Pages-Branch – nur mit Erlaubnis des Nutzers; Firebase Hosting kommt in Phase 6).
- Phase 2: Favoriten, Playlists, Verlauf (idb), Firebase Auth (Google + anonym) + Firestore-Sync,
  `firestore.rules` + Emulator-Tests, E2E „in Playlist legen“. Eigenes Firebase-Projekt empfehlen (nicht das Spiel-Projekt).
