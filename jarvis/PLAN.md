# JARVIS – Detaillierter Bauplan

Ein futuristischer KI-Assistent, mit dem du sprechen kannst, der Aufgaben für dich erledigt (Websites bauen, Texte, Bilder und Code generieren) und dessen Oberfläche ein leuchtendes 3D-Gehirn mit coolen Animationen ist.

---

## Inhaltsverzeichnis

1. Ziel und Funktionsumfang
2. Architektur (die 4 Bausteine)
3. Tech-Stack
4. Ordnerstruktur
5. Die Gehirn-UI im Detail
6. Sprache: Zuhören und Sprechen
7. Das KI-Gehirn: Logik und Tools
8. Die Tools im Detail
9. Gedächtnis
10. Sicherheit und Kosten
11. Bauphasen mit Checklisten
12. Ideen für später
13. Lernressourcen

---

## 1. Ziel und Funktionsumfang

**JARVIS soll:**

- per Stimme angesprochen werden können, mit Weckwort „Jarvis“ oder per Klick bzw. Leertaste
- mit einer coolen Stimme antworten
- Aufgaben selbstständig erledigen:
  - Websites erstellen (HTML/CSS/JS) und online stellen
  - Texte schreiben (Aufsätze, Mails, Ideen, Zusammenfassungen)
  - Bilder generieren
  - Code schreiben und erklären
  - Notizen und Erinnerungen speichern
  - Infos aus dem Internet suchen
- sich an frühere Gespräche erinnern
- ein animiertes 3D-Gehirn als Hauptoberfläche haben, das zeigt, was JARVIS gerade tut

**Nicht im Umfang:** Verkaufen, Bezahlen und Kundenkontakt.

---

## 2. Architektur (die 4 Bausteine)

```
 Du sprichst
     │
     ▼
┌──────────┐   Text    ┌──────────┐  Tool-Aufruf  ┌──────────┐
│  OHREN   │ ────────► │  GEHIRN  │ ────────────► │  HÄNDE   │
│ Speech-  │           │ KI-Modell│ ◄──────────── │  Tools   │
│ to-Text  │           │ (API)    │   Ergebnis    │          │
└──────────┘           └──────────┘               └──────────┘
                            │ Antwort-Text
                            ▼
                       ┌──────────┐
                       │   MUND   │ ──► Du hörst die Antwort
                       │ Text-to- │
                       │ Speech   │
                       └──────────┘

   Parallel dazu:  GEHIRN-UI (Three.js) zeigt jeden Zustand an
```

| Baustein | Aufgabe | Technik |
|---|---|---|
| Ohren | Sprache in Text umwandeln | Web Speech API oder Whisper |
| Gehirn | Verstehen, entscheiden, antworten | Claude API (oder ein anderes LLM) |
| Hände | Aufgaben wirklich ausführen | Eigene Funktionen („Tools“) |
| Mund | Text in Sprache umwandeln | speechSynthesis oder ElevenLabs |
| Gesicht | Visuelles Feedback | Three.js + Shader |

---

## 3. Tech-Stack

### Frontend (was du siehst)
- **Vite** – schnelles Starten und Bauen des Projekts
- **TypeScript** (oder JavaScript für den Anfang)
- **Three.js** – 3D-Gehirn
- **postprocessing / UnrealBloomPass** – Neon-Glow
- **GSAP** – flüssige Übergangsanimationen
- **Howler.js** – UI-Sounds

### Backend (wo die Arbeit passiert)
- **Node.js + Express** (oder Python + FastAPI)
- **Anthropic SDK** – Verbindung zum KI-Modell
- **dotenv** – API-Schlüssel sicher speichern
- **SQLite** – Gedächtnis und Notizen

### Externe Dienste (optional)
- **ElevenLabs** – realistische Stimme
- **OpenAI Whisper** – bessere Spracherkennung
- **Netlify / Vercel** – Websites veröffentlichen
- **Bild-API** (z. B. Stability, Replicate) – Bilder generieren

> **Wichtig:** API-Schlüssel gehören **nur ins Backend**, niemals in den Frontend-Code. Sonst kann sie jeder auslesen.

---

## 4. Ordnerstruktur

```
jarvis/
├── client/                    # Frontend
│   ├── index.html
│   ├── src/
│   │   ├── main.ts            # Einstiegspunkt
│   │   ├── brain/
│   │   │   ├── Brain.ts       # 3D-Gehirn
│   │   │   ├── particles.ts   # Partikel-Erzeugung
│   │   │   ├── shaders/       # Glow- und Puls-Shader
│   │   │   └── states.ts      # idle, listening, thinking, speaking
│   │   ├── hud/
│   │   │   ├── Rings.ts       # HUD-Ringe
│   │   │   ├── Terminal.ts    # Log-Text
│   │   │   └── Boot.ts        # Start-Sequenz
│   │   ├── voice/
│   │   │   ├── listen.ts      # Spracherkennung
│   │   │   └── speak.ts       # Sprachausgabe
│   │   ├── api.ts             # Verbindung zum Backend
│   │   └── sounds/
│   └── package.json
│
├── server/                    # Backend
│   ├── index.ts               # Express-Server
│   ├── agent.ts               # KI-Logik + Tool-Schleife
│   ├── tools/
│   │   ├── createWebsite.ts
│   │   ├── deployWebsite.ts
│   │   ├── generateImage.ts
│   │   ├── writeText.ts
│   │   ├── notes.ts
│   │   └── webSearch.ts
│   ├── memory/
│   │   └── db.sqlite
│   ├── output/                # Generierte Dateien
│   ├── .env                   # API-Schlüssel (NIE hochladen!)
│   └── package.json
│
└── README.md
```

---

## 5. Die Gehirn-UI im Detail

### 5.1 Das Gehirn bauen
- **Form:** Ein Gehirn-3D-Modell (.glb, z. B. kostenlos von Sketchfab mit passender Lizenz) laden und die Oberflächenpunkte als Partikel nutzen. Alternative ohne Modell: zwei verformte Kugeln als Hirnhälften.
- **Partikel:** 5.000–15.000 Punkte, `THREE.Points` mit eigenem Shader
- **Neuronen-Verbindungen:** Linien zwischen nahen Punkten (`THREE.LineSegments`), nur ca. 1–3 % der möglichen Verbindungen, sonst wird es zu voll
- **Signale:** Kleine Lichtpunkte, die entlang der Linien „feuern“
- **Glow:** UnrealBloomPass mit Stärke 1.2–2.0
- **Farben:**
  - Grundfarbe Cyan `#00E5FF`
  - Akzent Blau `#2979FF`
  - Denken Violett `#B388FF`
  - Fehler Rot `#FF1744`
  - Hintergrund fast Schwarz `#03060D`

### 5.2 Zustände und Animationen

| Zustand | Wann | Animation | Farbe |
|---|---|---|---|
| **Boot** | Beim Start | Partikel fliegen aus dem Chaos zur Gehirnform, HUD-Ringe drehen sich auf, Terminal tippt „SYSTEM ONLINE“ | Weiß → Cyan |
| **Idle** | Wartet | Langsames Drehen, sanftes „Atmen“ (Skalierung 1.0 ↔ 1.03), vereinzelte Neuronen feuern | Cyan |
| **Listening** | Du sprichst | Wellenringe gehen nach außen, Partikel reagieren auf deine Lautstärke (Mikrofon-Analyser) | Hellblau |
| **Thinking** | KI rechnet | Viele Neuronen feuern schnell, Gehirn dreht schneller, Partikel flimmern | Violett |
| **Working** | Tool läuft | Ein Bereich des Gehirns leuchtet stark, Fortschrittsring im HUD, Terminal zeigt Schritte | Violett/Gold |
| **Speaking** | Antwort | Gehirn pulsiert im Takt der Stimme (Audio-Lautstärke steuert Glow und Größe) | Cyan, heller |
| **Error** | Fehler | Kurzes rotes Flackern, Glitch-Effekt, dann zurück zu Idle | Rot |

Übergänge zwischen Zuständen immer mit **GSAP** über 0,4–0,8 Sekunden weich überblenden, nie hart springen.

### 5.3 HUD (Iron-Man-Stil)
- **Ringe:** 3–4 dünne, halbtransparente Kreise um das Gehirn, die sich unterschiedlich schnell drehen, mit Strichmarkierungen wie eine Skala
- **Terminal links unten:** Zeigt Logs in Monospace-Schrift mit Tipp-Effekt, z. B. `> Analysiere Anfrage... OK`
- **Statusleiste oben:** Uhrzeit, Datum, Systemstatus, Mikrofon an/aus
- **Antwort-Panel rechts:** Der gesprochene Text erscheint Wort für Wort
- **Ergebnis-Karten:** Fertige Websites oder Bilder schweben als Glas-Karten ein (Glassmorphism: halbtransparent mit Blur)
- **Schrift:** „Orbitron“ oder „Rajdhani“ für Überschriften, „JetBrains Mono“ für das Terminal (Google Fonts)

### 5.4 Extra-Effekte
- **Scanlines:** Ganz leichte horizontale Linien über dem Bild
- **Chromatic Aberration:** Leichter RGB-Versatz am Bildrand
- **Maus-Interaktion:** Gehirn neigt sich leicht zur Maus, Partikel weichen dem Cursor aus
- **Sternenstaub:** Langsam schwebende Hintergrundpartikel
- **Sounds:** Boot-Sound, kurzes „Bip“ beim Zuhören, leises Summen beim Denken (sparsam einsetzen, sonst nervt es)

### 5.5 Performance
- Partikelanzahl an das Gerät anpassen (Handy: 3.000, PC: 15.000)
- Animationen im Shader statt in JavaScript berechnen
- `requestAnimationFrame` und Delta-Zeit verwenden, damit alles auf allen Geräten gleich schnell läuft
- Zielwert: 60 FPS

---

## 6. Sprache: Zuhören und Sprechen

### 6.1 Zuhören (Speech-to-Text)

**Option A – Web Speech API (Einstieg, kostenlos)**
- Funktioniert direkt im Browser (am besten in Chrome)
- `lang = "de-DE"`, `continuous = true`, `interimResults = true`
- Nachteil: Braucht Internet, klappt nicht in jedem Browser gleich gut

**Option B – Whisper (besser)**
- Audio im Browser mit `MediaRecorder` aufnehmen, ans Backend schicken, dort transkribieren
- Versteht Deutsch sehr gut, auch Umgangssprache

**Aktivierung:**
1. Anfangs: Leertaste gedrückt halten (Push-to-Talk) oder Klick aufs Gehirn
2. Später: Weckwort „Jarvis“ (z. B. mit Picovoice Porcupine)

**Ende erkennen:** Wenn 1–1,5 Sekunden Stille ist, gilt der Satz als fertig.

### 6.2 Sprechen (Text-to-Speech)

**Option A – speechSynthesis (kostenlos)**
- Im Browser eingebaut, deutsche Stimme auswählen
- Klingt etwas roboterhaft, was zu JARVIS sogar passen kann

**Option B – ElevenLabs (realistisch)**
- Ruhige, tiefe, britisch-elegante Stimme wählen
- Streaming nutzen, damit JARVIS sofort anfängt zu sprechen

**Stimme mit Gehirn verbinden:**
- Audio durch einen `AnalyserNode` (Web Audio API) leiten
- Lautstärke jedes Frames auslesen und als Wert 0–1 an den Shader übergeben, der damit Glow und Pulsieren steuert

### 6.3 Unterbrechen
Wenn du sprichst, während JARVIS redet, soll er sofort aufhören zu reden und zuhören.

---

## 7. Das KI-Gehirn: Logik und Tools

### 7.1 System-Prompt (Persönlichkeit)

```
Du bist JARVIS, ein persönlicher KI-Assistent.
Du sprichst Deutsch, bist höflich, ruhig, leicht humorvoll und präzise.
Deine Antworten sind kurz, weil sie vorgelesen werden (max. 2–3 Sätze),
außer der Nutzer will mehr.
Wenn eine Aufgabe ein Werkzeug braucht, benutze es.
Frag nach, wenn etwas unklar ist.
Bevor du etwas veröffentlichst oder löschst, frag immer um Erlaubnis.
```

### 7.2 Die Agent-Schleife

```
1. Nutzer-Nachricht + Verlauf + Tool-Liste an die KI schicken
2. KI antwortet:
     a) mit normalem Text  → fertig, vorlesen
     b) mit Tool-Aufruf    → Tool ausführen
3. Tool-Ergebnis zurück an die KI schicken
4. Zurück zu Schritt 2 (max. 10 Durchläufe als Schutz)
```

Bei jedem Schritt schickt das Backend ein Status-Event ans Frontend (über WebSocket oder Server-Sent Events), damit das Gehirn den passenden Zustand zeigt und das Terminal mitschreibt.

### 7.3 Tool-Definition (Beispiel)

```json
{
  "name": "create_website",
  "description": "Erstellt eine komplette Website als HTML/CSS/JS-Dateien.",
  "input_schema": {
    "type": "object",
    "properties": {
      "thema": { "type": "string", "description": "Worum geht es auf der Website?" },
      "stil": { "type": "string", "description": "Design-Stil, z. B. modern, dunkel, verspielt" },
      "seiten": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["thema"]
  }
}
```

---

## 8. Die Tools im Detail

### 8.1 `create_website` – Website erstellen
1. KI erzeugt `index.html`, `style.css` und `script.js`
2. Dateien landen in `server/output/websites/<name>/`
3. Vorschau erscheint als Glas-Karte im HUD (iframe)
4. Du kannst per Sprache Änderungen wünschen: „Mach den Hintergrund dunkler“

### 8.2 `deploy_website` – Website online stellen
- Upload über die Netlify-API (kostenloser Plan reicht)
- JARVIS fragt **vorher**: „Soll ich die Seite veröffentlichen?“
- Gibt danach den Link aus und zeigt ihn als QR-Code an

### 8.3 `generate_image` – Bild generieren
- Prompt an eine Bild-API schicken
- Bild speichern und als Karte einblenden
- Befehle wie „Mach es im Cyberpunk-Stil“ möglich

### 8.4 `write_text` – Texte schreiben
- Mails, Aufsätze, Social-Media-Posts, Zusammenfassungen
- Ergebnis als .md- oder .txt-Datei speichern und im Panel anzeigen

### 8.5 `write_code` – Code schreiben
- Code erzeugen, mit Syntax-Highlighting anzeigen und als Datei speichern
- Optional: Code erklären lassen

### 8.6 `notes` – Notizen und Erinnerungen
- `save_note`, `list_notes`, `delete_note` (mit Rückfrage)
- Erinnerungen mit Uhrzeit und Benachrichtigung im Browser

### 8.7 `web_search` – Internetsuche
- Über eine Such-API (z. B. Brave Search oder Tavily)
- Ergebnis zusammenfassen und vorlesen

### 8.8 Kleine Extras
- Uhrzeit, Datum, Wetter, Timer, Rechner, Witz erzählen

---

## 9. Gedächtnis

| Art | Was | Wo |
|---|---|---|
| Kurzzeit | Das aktuelle Gespräch | Im Arbeitsspeicher, die letzten ca. 20 Nachrichten |
| Langzeit | Fakten über dich („Ich heiße …“, Vorlieben) | SQLite-Tabelle `facts` |
| Projekte | Erstellte Websites, Bilder, Texte | SQLite-Tabelle `projects` + Dateien in `output/` |

- Neue Fakten speichert JARVIS über ein Tool `remember_fact`
- Gespeicherte Fakten werden bei jedem Gespräch in den System-Prompt eingefügt
- Befehl „Vergiss das“ löscht einen Eintrag
- Bei sehr langen Gesprächen ältere Nachrichten zusammenfassen statt abschneiden

---

## 10. Sicherheit und Kosten

### Sicherheit
- API-Schlüssel nur in `.env` speichern und `.env` in `.gitignore` eintragen
- Bestätigung vor kritischen Aktionen (veröffentlichen, löschen, Dateien überschreiben)
- Tools dürfen nur im Ordner `output/` schreiben
- Server nur lokal laufen lassen (`localhost`); falls online, mit Passwortschutz

### Kosten im Griff behalten
- Bei den API-Anbietern ein monatliches Ausgabenlimit einstellen
- Für einfache Fragen ein günstiges, schnelles Modell nutzen, für große Aufgaben (z. B. Website) ein stärkeres
- Kostenlose Optionen zuerst: Web Speech API und speechSynthesis
- Eine kleine Anzeige im HUD: „Verbrauch heute“

---

## 11. Bauphasen mit Checklisten

### Phase 1 – Das Gehirn (UI only)
- [ ] Vite-Projekt anlegen, Three.js installieren
- [ ] Szene, Kamera, Renderer, schwarzer Hintergrund
- [ ] Partikel-Gehirn erzeugen
- [ ] Bloom-Glow hinzufügen
- [ ] Idle-Animation (Drehen + Atmen)
- [ ] Neuronen-Linien + feuernde Signale
- [ ] Zustände per Tastendruck testen (1 = Idle, 2 = Listening, 3 = Thinking, 4 = Speaking)
- [ ] HUD-Ringe, Statusleiste, Terminal
- [ ] Boot-Sequenz

**Ergebnis:** Eine beeindruckende Oberfläche, die noch nichts tut, aber fantastisch aussieht.

### Phase 2 – Text-Chat mit KI
- [ ] Express-Server aufsetzen
- [ ] API-Schlüssel in `.env`
- [ ] Endpunkt `/chat`, der an die KI weiterleitet
- [ ] Eingabefeld im HUD
- [ ] Antwort im Panel anzeigen, Gehirn wechselt zu Thinking und zurück

**Ergebnis:** Du kannst mit JARVIS schreiben.

### Phase 3 – Sprache
- [ ] Spracherkennung (Push-to-Talk mit Leertaste)
- [ ] Sprachausgabe
- [ ] Mikrofon- und Stimm-Lautstärke steuern die Animation
- [ ] Unterbrechen beim Dazwischenreden

**Ergebnis:** Du sprichst mit JARVIS, und das Gehirn reagiert live.

### Phase 4 – Erste Tools
- [ ] Agent-Schleife mit Tool-Aufrufen
- [ ] Status-Events ans Frontend (Terminal zeigt Schritte)
- [ ] `create_website` + Vorschau-Karte
- [ ] `write_text` + `write_code`
- [ ] `notes`

**Ergebnis:** „Jarvis, bau mir eine Website über meine Lieblingsband“ funktioniert.

### Phase 5 – Mehr Fähigkeiten
- [ ] `deploy_website` (Netlify)
- [ ] `generate_image`
- [ ] `web_search`
- [ ] Langzeit-Gedächtnis
- [ ] Bessere Stimme (ElevenLabs) und Spracherkennung (Whisper)

### Phase 6 – Feinschliff
- [ ] Weckwort „Jarvis“
- [ ] Sounds
- [ ] Glitch-, Scanline- und Aberration-Effekte
- [ ] Einstellungsmenü (Stimme, Farben, Partikelanzahl)
- [ ] Optional als Desktop-App mit Electron oder Tauri verpacken

---

## 12. Ideen für später
- Mehrere Gehirn-Themes (Rot = Kampfmodus, Grün = Matrix)
- Handy-Fernbedienung: JARVIS vom Handy aus steuern
- Smart-Home-Steuerung (z. B. über Home Assistant)
- JARVIS schaut über die Webcam (mit Erlaubnis) und beschreibt, was er sieht
- Tagesbriefing am Morgen: Wetter, Termine, Notizen
- Kalender- und Mail-Anbindung

---

## 13. Lernressourcen
- **Three.js:** threejs.org/examples, besonders die Beispiele zu Points und Bloom
- **Three.js Journey** (Bruno Simon) – sehr guter Kurs für 3D im Web
- **Anthropic-Dokumentation:** docs.claude.com, Abschnitt zu Tool Use
- **MDN:** Web Speech API und Web Audio API
- **GSAP-Dokumentation:** gsap.com/docs

---

**Tipp:** Fang mit Phase 1 an. Ein Gehirn, das cool aussieht, motiviert dich, den Rest auch fertigzubauen.
