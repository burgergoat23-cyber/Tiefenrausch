# Tiefenrausch

Dungeon-Crawler im Browser (Canvas, eine einzige HTML-Datei).

**Spielen:** https://burgergoat23-cyber.github.io/Tiefenrausch/

- `index.html`: das komplette Spiel. Läuft auch lokal, einfach im Browser öffnen.
- Auf GitHub Pages laufen Konten, Tages-Rangliste und Admin-Panel über Firebase (Projekt `tiefenrausch`). Admin ist das Konto `burgergoat44`.
- Die Sicherheitsregeln stehen in `firestore.rules` und müssen nach Änderungen in der Firebase-Konsole (Firestore → Regeln) veröffentlicht werden.
- Als lokale Datei geöffnet startet das Spiel direkt als Gast. In claude.ai nutzt das Spiel weiter die Artifact-Laufzeit (`window.claude`).

## GitHub Pages einrichten (einmalig)

Settings → Pages → Source: „Deploy from a branch“ → Branch `claude/tiefen-raush-code-review-jb306f`, Ordner `/ (root)` → Save.
Nach 1–2 Minuten ist das Spiel unter dem Link oben erreichbar. Jeder neue Push aktualisiert es automatisch.

## Für Entwickler
Siehe `UEBERGABE.md` (Aufbau, Firebase, Koop) und `tests/run.sh` (Testprogramme).
