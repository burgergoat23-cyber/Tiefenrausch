# Auftrag: Baue „Klangraum“ – eine sehr anpassbare Musik-Streaming-Web-App

## 0. Wie du mit mir arbeitest (wichtig!)
- Antworte mir immer auf **Deutsch**, **einfach** und **Schritt für Schritt**. Ich bin kein Profi-Programmierer.
- Arbeite in den **Phasen** unten, eine nach der anderen. Fang erst mit der nächsten Phase an, wenn die aktuelle fertig ist und alle Tests laufen.
- Sag mir am Ende jeder Phase in 3–6 kurzen Sätzen: Was ist neu, wie probiere ich es aus, was kommt als Nächstes.
- Wenn ich etwas selbst machen muss (z. B. ein Konto anlegen, einen Schlüssel kopieren), erklär es mir **Klick für Klick**.
- Mach nach jeder Phase einen Git-Commit mit einer klaren Nachricht.
- Frag mich nur, wenn du wirklich nicht weiterkommst. Bei kleinen Entscheidungen wählst du selbst etwas Vernünftiges und sagst mir kurz, was.
- Schreib **niemals** Geheimnisse (API-Schlüssel, Passwörter) in den Code oder in Git. Nutze `.env`-Dateien und trag `.env` in `.gitignore` ein. Lege eine `.env.example` mit leeren Platzhaltern an.

## 1. Ziel
Eine Web-App (PWA), mit der ich ungefähr so viel Musik hören kann wie bei Spotify und die ich **fast komplett selbst gestalten** kann: Farben, Layout, Player-Ansicht, Sound. Sie soll auf **PC (Chrome/Edge/Safari), iPad und iPhone** gut laufen und sich auf dem Homescreen installieren lassen.

## 2. Rechtliche Grenzen (unbedingt einhalten)
- Keine Songs illegal herunterladen, kopieren, zwischenspeichern oder weiterverbreiten.
- Spotify-Musik wird nur über die **offiziellen Spotify-Schnittstellen** abgespielt. Keine Spotify-Audiodateien speichern, nichts herunterladen, kein Logo-Missbrauch. Die Spotify-Entwicklerregeln gelten.
- Offline-Zwischenspeicher nur für Quellen, deren Lizenz das erlaubt (Jamendo/Internet Archive mit freien Lizenzen, eigene Dateien).
- Zeig bei jedem Song an, aus welcher Quelle er kommt (kleines Quellen-Symbol), und bei freier Musik den Künstler und die Lizenz.

## 3. Technik (bitte genau so)
- **Vite + React 18 + TypeScript** (strict mode)
- **Zustand** für den App-Zustand
- **React Router** für die Seiten
- **CSS-Variablen** als Grundlage aller Themes (kein fest eingebautes Farbschema in Komponenten!). Optional CSS-Module, aber kein Tailwind, damit Themes alles überschreiben können.
- **dnd-kit** für Drag & Drop (Startseiten-Kacheln, Menü-Reihenfolge, Warteschlange)
- **zod** zum Prüfen von importierten Themes und gespeicherten Einstellungen
- **idb** (IndexedDB) für lokale Daten und Offline-Cache
- **Firebase** (Auth + Firestore + Hosting) für Konto, Sync und Veröffentlichung
- **vite-plugin-pwa** für Installierbarkeit und Offline-Hülle
- **Vitest** + **React Testing Library** für Unit-Tests, **Playwright** für End-to-End-Tests (Chromium ist bereits installiert; installier Playwright-Browser nicht neu)
- ESLint + Prettier

## 4. Ordnerstruktur
```
src/
  app/            # App-Start, Router, Provider
  sources/        # Musik-Quellen (je Quelle ein Ordner)
    types.ts      # gemeinsames Interface
    audius/
    jamendo/
    archive/
    local/
    spotify/
  player/         # Abspiel-Engine, Warteschlange, Web Audio (EQ, Visualizer, Crossfade)
  library/        # Playlists, Favoriten, Verlauf
  customize/      # Theme-System, Theme-Editor, Layout-Editor, Presets
  widgets/        # Startseiten-Kacheln
  pages/          # Start, Suche, Bibliothek, Player, Einstellungen, Anpassen
  components/     # wiederverwendbare UI-Teile
  storage/        # IndexedDB, Firestore-Sync, Migrationen
  i18n/           # Texte (Deutsch zuerst, Englisch zweitens)
tests/e2e/
```

## 5. Musik-Quellen – gemeinsames Interface
Jede Quelle implementiert dasselbe Interface, damit der Rest der App nicht wissen muss, woher ein Song kommt:

```ts
interface MusicSource {
  id: 'audius' | 'jamendo' | 'archive' | 'local' | 'spotify';
  name: string;
  needsLogin: boolean;
  isAvailable(): Promise<boolean>;
  search(query: string, opts?: { type?: 'track'|'album'|'artist'|'playlist'; limit?: number; offset?: number }): Promise<SearchResult>;
  getTrack(id: string): Promise<Track>;
  getAlbum?(id: string): Promise<Album>;
  getArtist?(id: string): Promise<Artist>;
  getPlaylist?(id: string): Promise<Playlist>;
  getTrending?(): Promise<Track[]>;
  // 'url' = wir spielen selbst über <audio> ab; 'external' = Quelle spielt selbst ab (Spotify)
  playbackMode: 'url' | 'external';
  getStreamUrl?(track: Track): Promise<string>;
  canUseWebAudio: boolean; // false bei Spotify (DRM) → kein EQ/Visualizer/Crossfade
  allowsOfflineCache: boolean;
}
```
`Track` hat mindestens: `id`, `sourceId`, `title`, `artists`, `album`, `durationMs`, `artworkUrl`, `license?`, `explicit?`.
Eindeutiger Schlüssel überall: `${sourceId}:${id}`.

### 5.1 Audius (Phase 1, ohne Login)
- Öffentliche API, kein Schlüssel nötig. Nutze `https://api.audius.co` um einen Host zu bekommen, und hänge bei jeder Anfrage `app_name=Klangraum` an.
- Endpunkte: Suche `/v1/tracks/search`, Trending `/v1/tracks/trending`, Stream `/v1/tracks/{id}/stream`.
- Fehler abfangen: Wenn ein Host nicht antwortet, einen anderen nehmen.

### 5.2 Jamendo (Phase 1)
- Braucht eine kostenlose `client_id` (devportal.jamendo.com) → in `.env` als `VITE_JAMENDO_CLIENT_ID`. Erklär mir, wie ich sie bekomme.
- Lizenz (Creative Commons) beim Song anzeigen.
- Wenn keine `client_id` gesetzt ist: Quelle still deaktivieren, App läuft trotzdem.

### 5.3 Internet Archive (Phase 4, optional)
- Sammlung „Live Music Archive“ und freie Audio-Sammlungen über die öffentliche Such-API.

### 5.4 Eigene Dateien (Phase 4)
- Dateien/Ordner per Dateiauswahl oder Drag & Drop hinzufügen (MP3, M4A, FLAC, OGG, WAV, soweit der Browser es kann).
- Metadaten (Titel, Künstler, Cover) mit `music-metadata` auslesen.
- Dateien in IndexedDB speichern (mit Speicherplatz-Anzeige und Löschen-Knopf).

### 5.5 Spotify (Phase 3)
- Login mit **Authorization Code Flow + PKCE** (kein Client Secret im Browser!). `VITE_SPOTIFY_CLIENT_ID` und Redirect-URI in `.env`.
- Erklär mir genau, wie ich auf developer.spotify.com eine App anlege, welche Redirect-URIs ich eintragen muss (lokal und online) und dass ich selbst Spotify Premium brauche.
- Scopes nur so viele wie nötig: `streaming user-read-email user-read-private user-library-read user-library-modify playlist-read-private playlist-read-collaborative user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played user-top-read`.
- Token sicher speichern, automatisch erneuern, beim Abmelden löschen.
- **Am PC:** Web Playback SDK → die App wird ein eigenes Spotify-Gerät.
- **Auf iPhone/iPad** (dort geht das SDK nicht): Spotify-Connect-Modus. Die App steuert die laufende Spotify-App über die Web API (Play/Pause/Skip/Seek/Lautstärke/Gerät wählen). Zeig dann einen freundlichen Hinweis: „Öffne Spotify einmal, dann kannst du hier steuern.“
- Meine Spotify-Playlists, Lieblingssongs, Alben und „Zuletzt gehört“ in die Bibliothek laden.
- Spotify-Songs dürfen in **gemischten Playlists** vorkommen (wir speichern nur die ID, nie Audio).
- Rate-Limits (HTTP 429, `Retry-After`) beachten.

## 6. Player-Engine
- Eine zentrale `PlayerEngine`, die je nach `playbackMode` entweder **eigenes Audio** (HTMLAudioElement + Web Audio) oder **Spotify** steuert. Die UI spricht nur mit der Engine.
- Warteschlange: Als Nächstes spielen, Ans Ende, Umsortieren per Drag & Drop, Entfernen, Zufall (echtes Mischen, das sich die Reihenfolge merkt), Wiederholen (aus / alle / einer).
- Übergang zwischen Quellen (z. B. Audius → Spotify → Jamendo) muss sauber funktionieren.
- **Web Audio** (nur wenn `canUseWebAudio`): `crossOrigin="anonymous"` setzen. Wenn CORS das blockiert, ohne Web Audio weiterspielen und EQ/Visualizer für diesen Song ausgrauen (mit Tooltip-Erklärung).
  - **Equalizer:** 10 Bänder (BiquadFilter), Vorverstärkung, Presets (Flat, Bass Boost, Vocal, Rock, Elektro, Akustik, Nacht), eigene Presets speichern.
  - **Crossfade:** zwei Audio-Elemente mit GainNodes, 0–12 Sekunden einstellbar.
  - **Lautstärke angleichen** (einfacher Kompressor, an/aus).
  - **Visualizer:** AnalyserNode → Canvas. Stile: Balken, Welle, Kreis, Partikel. Farben kommen aus dem Theme.
- **Media Session API:** Titel, Künstler, Cover und Tasten auf dem Sperrbildschirm und an Kopfhörern.
- **iOS-Eigenheiten:** Audio erst nach Nutzer-Tipp starten (AudioContext beim ersten Tipp entsperren), mit `playsinline` arbeiten, AudioContext nach Unterbrechung (Anruf, App-Wechsel) wieder fortsetzen.
- Schlaf-Timer (15/30/45/60 Min, Ende des Songs), Wiedergabegeschwindigkeit (nur bei eigenem Audio).
- Tastenkürzel (Leertaste, Pfeile, M = stumm, / = Suche) – frei umbelegbar.

## 7. Seiten
1. **Start:** frei gestaltbares Kachel-Raster (siehe 8.2).
2. **Suche:** ein Suchfeld, Ergebnisse aus allen aktiven Quellen gleichzeitig. Filter nach Quelle und Typ. Ergebnisse erscheinen nach und nach (eine langsame Quelle blockiert nicht die anderen). Suchverlauf.
3. **Bibliothek:** Playlists (eigene + Spotify), Favoriten, Alben, Künstler, eigene Dateien, Verlauf. Sortieren und Filtern.
4. **Player (Vollbild):** wählbare Ansicht (siehe 8.3).
5. **Mini-Player:** immer sichtbar unten (oder oben/seitlich, je nach Layout).
6. **Anpassen:** Theme-Editor + Layout-Editor mit **Live-Vorschau**.
7. **Einstellungen:** Quellen an/aus, Konten, Sound, Tastenkürzel, Sprache, Speicher, Daten exportieren/löschen.

Songtexte: über **LRCLIB** (kostenlos, ohne Schlüssel) suchen, synchronisierte Texte mitlaufen lassen, Klick auf eine Zeile springt dorthin (bei Spotify über Seek).

## 8. Anpassbarkeit – das Herzstück
Alles, was man anpassen kann, steckt in **einem** Einstellungs-Objekt mit Version (`schemaVersion`) und Migrationen. Mit zod prüfen. Jede Änderung wirkt **sofort** (Live-Vorschau) und kann rückgängig gemacht werden (Strg+Z bzw. Knopf, mindestens 30 Schritte). Knopf „Alles zurücksetzen“.

### 8.1 Aussehen (Theme)
- Design-Tokens als CSS-Variablen: Hintergrund, Oberfläche, Oberfläche-erhöht, Text, Text-gedämpft, Akzent, Akzent-Text, Rahmen, Fehler, Erfolg, Schatten.
- Farbwähler für jede Farbe + automatische **Kontrastprüfung** (WCAG AA). Warnung, wenn Text schlecht lesbar ist, mit Knopf „automatisch korrigieren“.
- **Fertige Themes** (mindestens 10): Mitternacht, Hell, OLED-Schwarz, Neon, Retro-Kassette, Pastell, Unterwasser, Wald, Sonnenuntergang, Hoher Kontrast.
- **Dynamische Farben:** Akzent und Hintergrund passen sich dem aktuellen Album-Cover an (Farben per Canvas auslesen; bei CORS-Fehler auf Theme-Farbe zurückfallen). Stärke einstellbar (0–100 %).
- **Hintergrund:** einfarbig, Verlauf (Editor mit 2–4 Farben und Winkel), eigenes Bild (Upload, Unschärfe- und Abdunkel-Regler), Video-Loop, animierter Verlauf, Cover des aktuellen Songs verschwommen.
- **Schrift:** Auswahl aus ca. 15 Google Fonts + Systemschrift, getrennt für Überschriften und Text, Schriftgröße 80–140 %.
- **Form:** Eckenradius (0–32 px), Abstände (kompakt / normal / luftig), Knopfgröße, Rahmen an/aus, Glas-Effekt (Blur) an/aus, Schatten-Stärke.
- **Bewegung:** Animationen an/aus/reduziert (respektiert `prefers-reduced-motion`), Übergangsgeschwindigkeit.
- Hell/Dunkel automatisch nach System oder nach Uhrzeit, jeweils mit eigenem Theme.

### 8.2 Aufbau (Layout)
- **Startseite als Kachel-Raster:** Kacheln hinzufügen, entfernen, verschieben (Drag & Drop) und in der Größe ändern (1×1, 2×1, 2×2, 4×2). Eigene Anordnung pro Gerätegröße (Handy / Tablet / PC).
- Kachel-Typen (mindestens): Zuletzt gehört, Lieblings-Playlist (wählbar), Trending (Quelle wählbar), Zufallsmix aus Favoriten, Uhr + Begrüßung, Jetzt läuft, Visualizer, Schnellzugriff-Knöpfe, Songtext-Ausschnitt, Statistik (meistgehörte Künstler), Notiz.
- Jede Kachel hat eigene Optionen (Titel, Anzahl Einträge, Darstellung als Liste oder Raster).
- **Navigation:** unten / links / rechts / oben, Reihenfolge und sichtbare Menüpunkte frei wählbar, Beschriftung an/aus.
- **Mini-Player:** Position, Größe, welche Knöpfe sichtbar sind.
- **Listen-Darstellung:** Cover-Größe, Spalten (Dauer, Album, Quelle, hinzugefügt am) an/aus.

### 8.3 Player-Ansicht
Wählbare Vorlagen: Großes Cover, Vinyl (drehende Platte), Kassette, Minimal (nur Text), Songtext-Vollbild, Visualizer-Vollbild. Bei jeder Vorlage einstellbar: welche Knöpfe, Fortschrittsbalken-Stil (Linie / Welle / dick), Cover-Form (eckig / rund / Platte).

### 8.4 Teilen
- Theme + Layout als **JSON-Datei** exportieren und importieren.
- Zusätzlich als **kurzer Teil-Code** (komprimiert, z. B. mit `lz-string`, Base64-URL) zum Kopieren.
- Import immer mit zod prüfen. Nur Daten, **niemals** eigenes CSS oder JavaScript aus Importen ausführen (Sicherheit!). Bild-URLs aus Importen nur über `https:` zulassen.
- Mehrere eigene Themes speichern, umbenennen, duplizieren.

## 9. Daten & Sync
- **Lokal zuerst:** alles wird sofort in IndexedDB gespeichert, die App funktioniert auch ohne Konto.
- **Firebase Auth:** Google-Login + anonym. Beim Wechsel von anonym zu Google die Daten mitnehmen.
- **Firestore-Struktur:**
  - `users/{uid}/settings/main` (Theme, Layout, Sound, Shortcuts)
  - `users/{uid}/themes/{themeId}`
  - `users/{uid}/playlists/{playlistId}` (Name, Cover, Liste von `${sourceId}:${id}` + gespeicherte Anzeige-Infos)
  - `users/{uid}/favorites/{trackKey}`
  - `users/{uid}/history/{autoId}` (nur die letzten 500)
- **Sicherheitsregeln** (`firestore.rules`): Jeder darf nur seine eigenen Daten lesen und schreiben. Schreib Tests dafür mit dem Firebase-Emulator.
- Konflikte: neuester Zeitstempel gewinnt (pro Dokument).
- Spotify-Token **nicht** in Firestore speichern.
- Firebase-Konfiguration in `.env`. Erklär mir, wie ich ein Firebase-Projekt anlege.

## 10. Qualität
- **Barrierefreiheit:** alles per Tastatur bedienbar, sichtbarer Fokus, ARIA-Beschriftungen, Screenreader-Ansagen beim Songwechsel.
- **Mobil:** funktioniert ab 360 px Breite, kein waagrechtes Scrollen, Touch-Ziele mindestens 44 px, Safe-Area (Notch) beachten.
- **Leistung:** lange Listen virtualisieren, Bilder lazy laden, Seiten per Code-Splitting laden, Startzeit auf dem Handy unter 3 Sekunden.
- **Fehler:** freundliche Meldungen auf Deutsch („Audius antwortet gerade nicht – versuch es gleich nochmal“), nie leere weiße Seite (Error Boundary).
- **Offline:** App-Hülle offline verfügbar; lizenzfreie Songs auf Wunsch zwischenspeichern.
- Texte alle über `i18n` (Deutsch + Englisch), nichts fest im Code.

## 11. Tests (Pflicht)
- Unit-Tests: Warteschlange (Zufall, Wiederholen), Theme-Validierung, Migrationen, Kontrastprüfung, Teil-Code Export/Import, Quellen-Adapter (mit gemockten Antworten).
- E2E mit Playwright (PC- und iPhone-Ansicht): Suchen → Song abspielen → in Playlist legen; Theme ändern → neu laden → Theme ist noch da; Kachel verschieben; Theme exportieren und wieder importieren.
- Vor jedem Commit: `npm run lint`, `npm run typecheck`, `npm test` müssen grün sein.
- Am Ende jeder Phase: Screenshots (PC + Handy) mit Playwright machen und mir zeigen.

## 12. Phasen
**Phase 1 – Grundgerüst:** Projekt aufsetzen, Router, Seiten-Hüllen, Player-Engine mit eigenem Audio, Audius + Jamendo, Suche, Mini-Player, Vollbild-Player (eine Vorlage), Warteschlange, Media Session, 3 fertige Themes über CSS-Variablen.
*Fertig, wenn:* Ich einen Song suchen und hören kann, auf PC und iPhone.

**Phase 2 – Bibliothek & Speichern:** Favoriten, eigene Playlists, Verlauf, IndexedDB, Firebase-Login und Sync, Sicherheitsregeln + Tests.
*Fertig, wenn:* Meine Playlists auf zwei Geräten gleich sind.

**Phase 3 – Spotify:** PKCE-Login, Bibliothek laden, Web Playback SDK am PC, Connect-Modus auf iPhone/iPad, gemischte Playlists.
*Fertig, wenn:* Ich am PC Spotify-Songs in meiner App höre und am iPhone Spotify damit steuere.

**Phase 4 – Anpassen:** kompletter Theme-Editor, dynamische Farben, Hintergründe, Schriften, Layout-Editor mit Kacheln, alle Player-Vorlagen, Rückgängig, Export/Import/Teil-Code, 10 fertige Themes. Dazu eigene Dateien + Internet Archive.
*Fertig, wenn:* Ich die App so verändern kann, dass sie nicht mehr wiederzuerkennen ist, und das Design einem Freund per Code schicken kann.

**Phase 5 – Sound:** Equalizer, Crossfade, Lautstärke angleichen, Visualizer, Songtexte, Schlaf-Timer, Tastenkürzel-Editor.

**Phase 6 – Feinschliff & Veröffentlichen:** PWA-Installation, Offline, Barrierefreiheit prüfen, Leistung, Englisch, Deployment auf Firebase Hosting (Anleitung für mich Klick für Klick), kurze `README.md` auf Deutsch.

## 13. Bitte nicht
- Keine Musik von YouTube, SoundCloud-Rippern oder anderen inoffiziellen Quellen.
- Kein Client Secret oder anderes Geheimnis im Frontend.
- Keine riesigen Abhängigkeiten ohne Grund (frag dich bei jeder neuen Bibliothek: brauche ich das wirklich?).
- Keine Funktionen „vortäuschen“ – wenn etwas auf einem Gerät nicht geht (z. B. EQ bei Spotify), ehrlich ausgrauen und erklären.

**Starte jetzt mit Phase 1.** Zeig mir zuerst in 5–10 Zeilen deinen Plan für Phase 1, dann leg los.
