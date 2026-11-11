# Änderungsprotokoll

## 0.1.0 (in Arbeit)

### Meilenstein 1 – Grundgerüst

- NeoForge-Projekt für Minecraft 1.21.1 angelegt (Vorlage: offizielles NeoForge-MDK, NeoForge 21.1.265, Java 21).
- Farmer's Delight 1.3.4 als Pflicht-Abhängigkeit eingebunden; es läuft in der Entwicklungsumgebung mit.
- Der Mod startet ab NeoForge 21.1.219, derselben Untergrenze wie Farmer's Delight 1.3.4.
- Kreativ-Tab „Brotzeit Delight" mit der Breze als Symbol, einsortiert direkt hinter dem Tab von Farmer's Delight.
- Item „Breze" (`pretzel`) angemeldet, vorerst nur als Symbol des Tabs und mit Platzhalter-Textur.
- Datengenerator eingerichtet: erzeugt Item-Modelle und die Sprachdateien für Deutsch und Englisch.
- Projektunterlagen angelegt: `ABWEICHUNGEN.md`, `TEXTUREN.md`, `IDEEN.md`, `STAND.md`.

### Meilenstein 2 – Faktencheck

- IDs, Tags, Klassen und Rezeptformate von Farmer's Delight 1.3.4 am Quellcode geprüft (`FAKTENCHECK.md`).
- Zwei neue Abweichungen eingetragen (`ABWEICHUNGEN.md` Nr. 2 und 3).

### Meilenstein 3 – Breze komplett

- Neues Item „Rohe Breze" (`raw_pretzel`); die Breze ist jetzt essbar (5 Hunger, Sättigung 0,6).
- Rezepte: 1 Weizenteig (Tag `c:foods/dough`) ergibt 1 rohe Breze; Ofen 200, Räucherofen 100, Lagerfeuer 600 Ticks, je 0,35 Erfahrung. Über das Lagerfeuer-Rezept geht auch Pfanne und Herd von Farmer's Delight.
- Alle Rezepte werden im Rezeptbuch freigeschaltet, sobald man eine Zutat besitzt.
- Kompost: rohe Breze 65 %, Breze 85 %.
- Automatische Tests: 4 Spieltests (Rezepte, Werte, Kompost) und 3 Tests für die Sprachdateien.
