# CodeBuddy – deine eigene, kostenlose Coding-KI

CodeBuddy läuft **komplett auf deinem PC**: kein Abo, keine API-Kosten, funktioniert auch offline.
Die KI kann mit dir über Code reden, Dateien in deinem Projekt lesen und ändern und Befehle ausführen –
**aber nur, wenn du vorher „j" tippst.**

Es braucht nur zwei Dinge: **Python 3** und **Ollama** (das Programm, das die KI auf deinem PC laufen lässt).

---

## 1. Installieren (einmalig)

**Schritt 1 – Python:** Prüfe im Terminal mit `python --version` (Mac/Linux: `python3 --version`).
Fehlt es: https://www.python.org/downloads/ – unter Windows beim Installieren das Häkchen
**„Add Python to PATH"** setzen.

**Schritt 2 – Ollama:** https://ollama.com/download herunterladen und installieren.
Danach läuft Ollama im Hintergrund (Windows/Mac: Symbol in der Taskleiste bzw. Menüleiste).

**Schritt 3 – CodeBuddy:** Lade diesen Ordner `codebuddy` herunter, öffne darin ein Terminal und tippe:

```
pip install -e .
```

(Mac/Linux evtl. `pip3 install -e .`). Danach gibt es den Befehl `codebuddy`.
Klappt das nicht, geht es immer auch so: `python -m codebuddy` (im Ordner `codebuddy`).

**Schritt 4 – Hardware prüfen und Modell wählen:**

```
codebuddy --check
```

Das zeigt dein Betriebssystem, deinen Arbeitsspeicher, deine Grafikkarte und schlägt 2–3 passende Modelle vor.
Grobe Regel:

| Dein PC | Empfehlung | Größe |
|---|---|---|
| wenig Speicher (ca. 8 GB) | `qwen2.5-coder:7b` | ~4,7 GB |
| mittel (ca. 16 GB / Grafikkarte 12 GB) | `qwen2.5-coder:14b` | ~9 GB |
| viel (Grafikkarte 24 GB+, Mac mit 32 GB+) | `qwen3-coder:30b` oder `devstral:24b` | 14–19 GB |

Herunterladen (Beispiel) und kurz testen:

```
ollama pull qwen2.5-coder:7b
ollama run qwen2.5-coder:7b "Schreib Hallo Welt in Python"
```

> Neue, bessere Modelle erscheinen oft. Schau ab und zu auf https://ollama.com/library?q=coder –
> wichtig ist, dass das Modell **„tools"** kann. Kann es das nicht, schaltet CodeBuddy automatisch auf
> ein Textformat um (funktioniert, aber etwas weniger zuverlässig).

---

## 2. Starten

Geh im Terminal in deinen Projektordner und tippe:

```
codebuddy
```

Dann einfach schreiben, was du willst, z. B.:

> Erstelle ein Python-Skript, das Zahlen von 1–10 ausgibt, und führ es aus

CodeBuddy zeigt dir, was es gerade tut (`→ Schreibe zahlen.py …`), zeigt dir **vor jeder Änderung**,
was sich ändert (grün = neu, rot = weg), und fragt **„Übernehmen? (j/n)"**.

**Befehle im Chat**

| Befehl | Was passiert |
|---|---|
| `/clear` | Verlauf löschen (neues Gespräch) |
| `/model` | Modell wechseln (zeigt alle installierten Modelle) |
| `/config` | zeigt, wo die Einstellungen liegen |
| `/exit` | beenden |
| `Strg+C` | aktuelle Antwort abbrechen |

**Im Browser statt im Terminal:** `codebuddy --web` öffnet eine Seite unter http://127.0.0.1:8765/
(nur auf deinem PC erreichbar).

**Anderes Modell nur für einen Start:** `codebuddy --model qwen2.5-coder:14b`

---

## 3. Modell wechseln

1. Neues Modell laden: `ollama pull <name>` (z. B. `ollama pull qwen2.5-coder:14b`)
2. In CodeBuddy `/model` tippen und die Nummer eingeben. Die Wahl wird gespeichert.

---

## 4. Einstellungen (`config.json`)

Liegt in deinem Benutzerordner: `~/.codebuddy/config.json` (Windows: `C:\Users\<Name>\.codebuddy\config.json`).
Wird beim ersten Start automatisch angelegt.

| Einstellung | Bedeutung | Standard |
|---|---|---|
| `modell` | welches Ollama-Modell | `qwen2.5-coder:7b` |
| `temperatur` | 0 = genau, 1 = kreativ | `0.2` |
| `sprache` | `de` oder `en` | `de` |
| `kontext` | wie viel sich die KI auf einmal merkt (Tokens) | `8192` |
| `max_schritte` | Schritte pro Auftrag, danach fragt sie dich | `20` |
| `web_port` | Port der Web-Oberfläche | `8765` |
| `ollama_url` | Adresse von Ollama (nur dieser PC erlaubt) | `http://127.0.0.1:11434` |

---

## 5. Projekt-Gedächtnis

- Lege in deinem Projekt eine Datei **`CODEBUDDY.md`** an und schreib deine Regeln hinein
  (Beispiel: `CODEBUDDY.beispiel.md`). CodeBuddy liest sie bei jedem Start.
- Beim Start macht CodeBuddy sich eine kurze Übersicht deiner Projektdateien.
- Wird das Gespräch zu lang, fasst CodeBuddy ältere Teile automatisch zusammen.

---

## 6. Sicherheit

- Die KI arbeitet **nur im Projektordner**. Pfade wie `../` oder `C:\…` außerhalb werden abgelehnt.
- **Keine Änderung, kein Befehl ohne dein „j".**
- Befehle, die etwas **löschen** könnten (`rm`, `del`, …), oder eine Datei leeren: Du musst zusätzlich das Wort
  `löschen` eintippen.
- **Nichts geht ins Internet**: CodeBuddy redet nur mit Ollama auf deinem PC, die Web-Seite ist nur lokal erreichbar.
- Ehrlicher Hinweis: Ein Befehl, den du mit „j" erlaubst, läuft wie ein normaler Terminal-Befehl. Lies ihn also kurz,
  bevor du zustimmst – CodeBuddy warnt, wenn er Pfade außerhalb des Ordners nennt.

---

## 7. Tests

Im Ordner `codebuddy`:

```
python -m unittest discover -s tests
```

Die Tests nutzen einen nachgebauten Ollama-Server – dafür muss Ollama nicht laufen.

---

## Hilfe bei Problemen

| Meldung | Lösung |
|---|---|
| „Ollama läuft nicht" | Ollama-App starten (oder im Terminal `ollama serve`) |
| „Modell … ist nicht installiert" | `ollama pull <name>` |
| `codebuddy` wird nicht gefunden | `python -m codebuddy` benutzen |
| Antworten sehr langsam | kleineres Modell nehmen (z. B. `qwen2.5-coder:3b`) |
| KI benutzt keine Werkzeuge | anderes Modell probieren, z. B. `qwen2.5-coder` oder `qwen3-coder` |
| Farben im Code schöner | `pip install pygments` (optional) |
