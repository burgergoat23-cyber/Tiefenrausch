# Tiefenbot – ein Minecraft-Bot für deine eigene Welt

Der Tiefenbot ist ein Mitspieler, der von einem Programm gesteuert wird. Er kommt
in deine Einzelspieler-Welt (über **„Für LAN öffnen“**), läuft herum, hört auf
Chat-Befehle und soll später ganz allein Survival spielen.

**Stand: Phase 1 von 6 ist fertig.** Der Bot verbindet sich, findet deine
LAN-Welt automatisch, folgt dir, kommt zu dir, merkt sich Basis und Todesorte
und zeigt im Browser live, was er sieht.

---

## ⚠️ Vorher wichtig

1. **Nur Minecraft Java Edition am PC** (Windows, Mac oder Linux).
   Die Bedrock-Version (iPad, Handy, Konsole, „Minecraft für Windows“ aus dem
   Microsoft Store) geht **nicht**.
2. Der Bot läuft auf **demselben PC** wie Minecraft (oder einem PC im selben WLAN).
3. Normalerweise prüft eine LAN-Welt, ob jeder Mitspieler ein gekauftes Konto
   hat. Der Bot hat keins. Wie du das löst, steht unten bei
   **[„Der Bot wird sofort rausgeworfen“](#der-bot-wird-sofort-rausgeworfen-failed-to-verify-username)**.
   Lies das am besten gleich mit.

---

## Installation (einmalig)

**Schritt 1 – Node.js installieren**
Geh auf https://nodejs.org und lade die Version mit **„LTS“** herunter.
Installieren, immer auf „Weiter“ klicken.

**Schritt 2 – Bot herunterladen**
Auf GitHub im Projekt den Branch mit dem Bot auswählen → grüner Knopf
**„Code“** → **„Download ZIP“**. ZIP entpacken. Darin liegt der Ordner
`minecraft-bot`.

**Schritt 3 – Eingabeaufforderung im Ordner öffnen**
- Windows: Ordner `minecraft-bot` öffnen, oben in die Adresszeile klicken,
  `cmd` tippen, Enter.
- Mac: Rechtsklick auf den Ordner → „Neues Terminal beim Ordner“.

**Schritt 4 – Pakete laden**
```
npm install
```
Das dauert 1–2 Minuten. Gelbe Warnungen („vulnerabilities“) sind normal.

**Schritt 5 – Selbsttest (optional)**
```
npm run check
```
Am Ende muss **„Alles in Ordnung.“** stehen.

---

## Einstellungen: `config.json`

Öffne `config.json` mit einem Texteditor (z. B. Editor/Notepad).

| Eintrag | Bedeutung | Standard |
|---|---|---|
| `host` | Wo Minecraft läuft. Gleicher PC = `localhost` | `localhost` |
| `port` | `"auto"` = Bot sucht die LAN-Welt selbst. Oder die Zahl, die Minecraft nach „Für LAN öffnen“ anzeigt | `"auto"` |
| `username` | Name des Bots im Spiel (3–16 Zeichen, nur Buchstaben/Zahlen/_ ) | `Tiefenbot` |
| `auth` | `"offline"` (kein Konto) oder `"microsoft"` (zweites echtes Konto) | `offline` |
| `version` | Deine Minecraft-Version, z. B. `"1.21.4"`. `"auto"` = Bot fragt die Welt selbst | `"auto"` |
| `owners` | Wer Befehle geben darf, z. B. `["DeinName"]`. Leer `[]` = alle | `[]` |
| `viewer` | Live-Ansicht im Browser: an/aus, Port | an, 3007 |
| `reconnect` | Nach Verbindungsabbruch neu verbinden, nach wie vielen Sekunden | an, 15 |
| `log.level` | Wie viel ins Protokoll kommt: `debug`, `info`, `warn`, `error` | `info` |

**Tipp:** Trag bei `owners` deinen Minecraft-Namen ein, dann hört der Bot nur auf dich.
Achte auf Anführungszeichen und Kommas – sonst meldet der Bot „kein gültiges JSON“.

---

## Starten

1. Minecraft starten, Welt öffnen.
2. **Esc → „Für LAN öffnen“ → „LAN-Welt starten“**.
3. In der Eingabeaufforderung (im Ordner `minecraft-bot`):
   ```
   npm start
   ```
4. Nach ein paar Sekunden steht im Spiel:
   *„Hallo! Ich bin Tiefenbot. Schreib !hilfe für Befehle.“*

**Beenden:** In der Eingabeaufforderung **Strg + C** drücken.

Schließt du die Welt, wartet der Bot und verbindet sich von selbst neu, sobald
du sie wieder für LAN öffnest.

---

## Live-Ansicht im Browser

Wenn der Bot läuft, öffne im Browser: **http://localhost:3007**

Du siehst die Welt um den Bot herum (Maus = umschauen). Wenn er läuft, zeigt
eine **grüne Linie** seinen geplanten Weg.
Hinweis: Die Ansicht kennt Texturen bis Minecraft 1.21.4. Bei neueren Versionen
kann sie leer bleiben – der Bot selbst funktioniert trotzdem.

---

## Chat-Befehle

Im Minecraft-Chat (Taste **T**) eintippen:

| Befehl | Was passiert |
|---|---|
| `!hilfe` | Liste aller Befehle |
| `!status` | Herzen, Hunger, Position, aktuelle Aufgabe |
| `!folge` | Bot läuft dir hinterher (bis `!stop`) |
| `!folge Name` | Bot folgt einem anderen Spieler |
| `!komm` | Bot kommt einmal zu dir |
| `!komm 100 64 -20` | Bot läuft zu diesen Koordinaten |
| `!stop` | Alles anhalten, Auto-Modus aus |
| `!basis setzen` | Stelle dich an deine Basis und schreib das – der Bot merkt es sich |
| `!basis` / `!basis hin` | Basis anzeigen / Bot läuft hin |
| `!inventar` | Was der Bot dabeihat |
| `!tode` | Wo der Bot zuletzt gestorben ist |
| `!auto an` / `!auto aus` | Selbstständig spielen (eigene Ziele ab Phase 3) |
| `!farm`, `!lager`, `!bau`, `!ziel` | kommen in Phase 3–6 |

Du kannst Befehle auch **direkt in der Eingabeaufforderung** eintippen
(z. B. `!status`). Text ohne `!` schickt der Bot als Chat-Nachricht.

---

## Phase 1 testen – Checkliste

1. `npm start` → im Fenster steht „LAN-Welt gefunden“ und „Gespawnt bei …“.
2. Im Spiel `!status` → Bot antwortet mit Herzen und Position.
3. Stell dich 10–20 Blöcke weg, schreib `!komm` → Bot läuft zu dir, sagt „Bin da!“.
4. `!folge` → lauf herum, der Bot bleibt dir auf den Fersen. `!stop` → er bleibt stehen.
5. `!basis setzen`, dann ein Stück weggehen, `!basis hin` → Bot läuft zurück.
6. Browser: http://localhost:3007 → du siehst, was der Bot sieht.
7. Bot beenden (Strg + C) und neu starten → `!basis` zeigt immer noch deine Basis.
8. Im Ordner `logs/` liegt eine Datei `bot-<Datum>.log` mit allem, was passiert ist.

Klappt etwas nicht? Schick mir die letzten Zeilen aus dem Fenster oder der Log-Datei.

---

## Probleme

### Der Bot wird sofort rausgeworfen („Failed to verify username“)
Deine LAN-Welt verlangt ein echtes Minecraft-Konto. Drei Lösungen – such dir eine aus:

**A) Mod „Custom LAN“ (empfohlen, „Für LAN öffnen“ bleibt wie gewohnt)**
1. Fabric installieren: https://fabricmc.net/use/installer/ (deine Minecraft-Version wählen).
2. Von Modrinth herunterladen (passend zu deiner Version):
   **Fabric API** und **Custom LAN**.
3. Beide `.jar`-Dateien in den Ordner `.minecraft/mods` legen.
4. Minecraft mit dem Fabric-Profil starten → Welt öffnen → Esc → „Für LAN öffnen“.
   Dort **„Online-Modus“ auf AUS** stellen. (Dort kannst du auch einen festen Port wählen.)

**B) Eigener kleiner Server auf dem PC**
Minecraft-Server-Datei von minecraft.net herunterladen, in `server.properties`
`online-mode=false` setzen und deine Welt in den Server-Ordner kopieren.
In `config.json` dann `"port": 25565` eintragen.

**C) Zweites Minecraft-Konto**
In `config.json` `"auth": "microsoft"` setzen. Beim Start zeigt der Bot einen Code
und eine Webseite – dort mit dem **zweiten** Konto anmelden (dein eigenes Konto
geht nicht, das spielt ja schon).

### „Noch keine LAN-Welt gefunden“
- Ist die Welt wirklich „Für LAN geöffnet“? (Esc-Menü)
- Manche Firewalls blockieren die automatische Suche. Dann den Port, den
  Minecraft im Chat anzeigt („Lokales Spiel wurde auf Port 54321 gehostet“),
  in `config.json` bei `"port"` eintragen, z. B. `"port": 54321`.
  **Achtung:** Ohne Mod ändert sich dieser Port bei jedem Öffnen.

### „Versionen passen nicht“
In `config.json` bei `"version"` deine Version eintragen, z. B. `"1.21.4"`.
Unterstützt werden Minecraft 1.8 bis 1.21.11 und 26.1.

### „Der Name ist schon im Spiel“
`username` in `config.json` ändern.

### Die Live-Ansicht startet nicht
Im Fenster steht dann ein Hinweis. Der Bot funktioniert auch ohne Ansicht.
Abschalten: in `config.json` bei `viewer` `"enabled": false`.

---

## Wie der Bot aufgebaut ist

```
minecraft-bot/
├─ config.json          Einstellungen
├─ src/index.js         Start, Verbinden, Neuverbinden
├─ src/core/            Grundgerüst
│  ├─ taskManager.js    Aufgaben mit Prioritäten
│  ├─ commands.js       Chat-Befehle
│  ├─ state.js          Gedächtnis (data/state.json)
│  ├─ logger.js         Protokoll (Konsole + logs/)
│  └─ lanDiscovery.js   findet die LAN-Welt automatisch
├─ src/modules/         je Fähigkeit eine Datei (Bewegung, Status, Basis, …)
├─ blueprints/          Bauvorlagen für Häuser (ab Phase 5)
├─ data/state.json      Basis, Todesorte, Ziele (entsteht beim ersten Start)
├─ logs/                Protokolle
└─ test/check.js        Selbsttest (npm run check)
```

**Aufgaben und Prioritäten:** Der Bot hat immer genau eine aktuelle Aufgabe.
Wichtigeres unterbricht Unwichtigeres – danach macht er weiter, wo er war:

1. Überleben (fliehen, essen, aus Lava raus) – *Phase 2*
2. Kampf – *Phase 2*
3. Tod-Recovery (Items zurückholen) – *Phase 3*
4. Deine Befehle (`!folge`, `!komm`) und danach eigene Ziele (Farmen, Bauen …)
5. Nebenbei (Inventar sortieren, Werkzeug craften) – *Phase 4*

---

## Fahrplan

- [x] **Phase 1:** Verbinden, Bewegen, Chat-Befehle, Live-Ansicht, Protokoll
- [ ] **Phase 2:** Überleben + Kampf (essen, Rüstung, schlafen, Creeper meiden, fliehen)
- [ ] **Phase 3:** Ressourcen farmen, Crafting (Holz → Stein → Eisen → Diamant), Items nach dem Tod zurückholen
- [ ] **Phase 4:** Lager mit sortierten Truhen + Basis
- [ ] **Phase 5:** Häuser aus Bauplänen, Weizenfeld, Tierfarm
- [ ] **Phase 6:** Advancement-Fahrplan (Nether, später das End)

---

*Für Entwickler:* In `tools/testserver/` liegt ein kleiner Test-Server
(flying-squid) mit LAN-Ansage und ein simulierter Spieler. Einrichten mit
`cd tools/testserver && npm install`, dann `node server.js 1.18.2` und in einem
zweiten Fenster `npm start`. Der Test-Server kann kein echtes Survival (z. B.
kein Respawn) – wirklich getestet wird nur in echtem Minecraft.
