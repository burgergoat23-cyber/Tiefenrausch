# JARVIS (Nebenprojekt)

Eigenes Projekt neben dem Spiel Tiefenrausch. Bauplan: `PLAN.md` (vom Nutzer, 15.10.2026).

## Stand: Phase 1 fertig (Oberfläche)
- `index.html` – eine Datei, kein Build-Schritt. Lädt Three.js 0.160.0 (Import-Map, jsDelivr) und GSAP 3.12.5 (cdnjs), Schriften von Google Fonts.
- Online als Claude-Artifact: https://claude.ai/artifact/MkVEWCC34nttKPgzaF4RXx (privat). Zum Aktualisieren die Datei ohne `<!doctype>`/`<html>`/`<head>`/`<body>`-Zeilen veröffentlichen (das Artifact ergänzt sie selbst).
- **Gehirn:** Partikel ohne 3D-Modell, per Rauschen erzeugt (`cerebrum`, `cerebellum`, `stem` – Windungen, Sylvische Furche, flache Innenseiten am Mittelspalt). Fester Zufallswert → jedes Mal dasselbe Gehirn. Anzahl je Gerät: PC 15 000, Tablet 9 000, Handy 3 500.
- **Neuronen:** Linien zwischen nahen Knoten (`buildNet`), feuernde Signale mit Spur, springen an Knoten weiter (`updateSignals`).
- **Zustände** (`PRE`, Tasten 1–6, 0 = Neustart): Bereit, Zuhören, Denken, Sprechen, Arbeiten (Bereich leuchtet gold, Fortschrittsring), Fehler (rotes Flackern, Glitch). Übergänge mit GSAP (0,6 s).
- **Demo-Gespräch:** Gehirn antippen oder Leertaste halten. Fragen/Antworten sind fest vorgegeben (`QA`), Mikrofon und Stimme sind nur **simuliert**.
- **HUD:** Statusleiste (Uhr, Status, Mikro, Partikel, FPS), System-Log mit Tipp-Effekt, Antwort-Panel Wort für Wort, Ringe im 3D-Raum (mit Glow), Sternenstaub, Scanlines, Neigung zur Maus/zum Finger, Partikel weichen aus.
- **Leistung:** Shader rechnen die Bewegung; misst die FPS und senkt bei Ruckeln erst die Auflösung, dann die Partikel.

## Nächste Phase (2: Text-Chat mit KI)
Einfachster Weg: im Artifact die Fähigkeit `sample` nutzen (die Seite fragt Claude direkt, kein Server, kein API-Schlüssel). Alternative laut Plan: eigener Server mit API-Schlüssel (kostet Geld → Eltern fragen).
Phase 3 (Sprache): Im Artifact gibt es für diesen Nutzer kein Mikrofon; Sprachausgabe (`speechSynthesis`) sollte gehen. Für Spracherkennung die Seite z. B. über GitHub Pages öffnen.

## Test
Playwright mit Chromium (SwiftShader), CDN-Adressen auf lokale npm-Pakete umgeleitet: Seite startet ohne JS-Fehler, keine waagrechte Scrollleiste auf PC 1440×900, iPad quer/hoch, Handy 390×844. Nicht auf einem echten iPad geprüft.
