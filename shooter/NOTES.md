# NOTES – Entscheidungen, Aufbau, offene Punkte

## Architektur

- **Logik** (zeichnet nie, läuft in node): `config`, `utils`, `collision`, `world`, `player`, `camera`, `run`, `game`.
  - `run.js` = eine Spielrunde (alle Objekte, ein Logikschritt `stepRun`). Ereignisse wie Schuss, Treffer,
    Explosion gehen über `run.emit(...)` an Zuhörer (Partikel, Ton, Kamera). In node hört niemand zu.
  - `game.js` = Zustände (Menü, Spiel, Pause, Upgrade, Sterben, Game Over) und fester Zeitschritt
    (`FixedStepper`, 60 Schritte/s, Bildzeit höchstens 0,1 s).
- **Darstellung**: `render.js` setzt das Bild zusammen, `render_world.js` (Boden, Gitter, Wände, Hindernisse),
  `render_entities.js` (Figuren), `sprites.js` (vorgezeichnete Leucht-Sprites), `ui.js` (HUD).
- **Eingabe**: `input.js` (Tastatur, Maus). Kurze Tastendrücke (Dash, Waffenwechsel) bleiben stehen,
  bis ein Logikschritt sie verbraucht hat – so gehen sie auf 120-Hz-Bildschirmen nicht verloren.
- Positionen werden zwischen zwei Logikschritten interpoliert (`px/py` → `x/y`), damit es auf
  120-Hz-Bildschirmen (iPad Pro) flüssig aussieht.

## Entscheidungen

- **Zoom**: die *lange* Bildschirmseite zeigt immer 1200 Welteinheiten. Querformat = 1200 breit,
  Hochformat = 1200 hoch (mehr Höhe sichtbar, wie gewünscht).
- **Kamera** darf 60 Einheiten über die Arena-Grenze schauen, damit die leuchtende Wand sichtbar bleibt.
- **Streuung** in der Waffentabelle = gesamter Kegel (2° = ±1°).
- **Hindernisse**: Blöcke (Rechtecke) und Säulen (Kreise), 4 Layouts mit 8–10 Hindernissen.
- **Treffer-Erkennung**: Kugeln prüfen die ganze Strecke eines Schritts (Strecke gegen Kreis), nicht nur
  den Endpunkt – so fliegt nichts durch Gegner oder dünne Wände.
- **Kugeln und Dash**: Während des Dashes (und 0,06 s danach) fliegen gegnerische Kugeln durch den Spieler.
- **Kontakt-Hitbox** der Gegner = 85 % ihres Radius (fühlt sich fairer an).
- **Kombo**: Der erste Kill zählt als 1. Bei Treffer wird die Zahl halbiert (abgerundet).
- **Explosionen, die der Spieler auslöst** (Rakete, Dash-Explosion, getöteter Bomber), schaden ihm nie.
- **Bomber**: zündet er selbst (1 s Blinken mit sichtbarem Radius), trifft die Explosion nur den Spieler und gibt
  keine Punkte. Wird er vorher erschossen, explodiert er kurz verzögert und trifft nur andere Gegner (Kettenreaktion).
- **Spezialwellen ab Welle 8** (nicht schon ab 4): Welle 4 stellt die Bomber vor, Welle 1–3 sind zum Reinkommen.
  Eine Spezialwelle in Welle 4 hätte den neuen Gegnertyp verdeckt oder überladen. Danach jede 4. Welle ohne Boss
  (8, 12, 16, 24, 28 …). Reihenfolge gemischt, jede Art einmal pro Durchgang.
- **Spezialwellen-Budget**: Nur Sprinter 55 %, Bomber-Regen 80 % (70 % davon Bomber), Dunkelheit 85 %,
  Schützen-Ring 50 % Schützen im Kreis (Abstand 460) + Rest Läufer/Sprinter.
- **Dunkelheit**: Lichtkreis 270 um den Spieler; Gegner außerhalb als rote Augen sichtbar, Kugeln, Warnkreise und
  Hindernis-Umrisse bleiben sichtbar (Lesbarkeit geht vor).
- **Gegner-Leben** steigt linear (+6 % pro Welle), nicht zinseszinsartig; Tempo +1 % pro Welle bis +30 %.
- **Spawns**: Gruppen am Rand (70 %) oder hinter Hindernissen (30 %); jeder einzelne Gegner liegt mindestens 350 vom
  Spieler entfernt (auch nach der Streuung der Gruppe). Steht der Spieler beim Ende der Warnung näher als 150 am
  Warnkreis, wartet der Spawn.
- **Arena leer, aber Gruppen noch geplant**: Die nächste Gruppe kommt spätestens nach 1,5 s (kein Warten).
- **Mini-Teiler** und geschlüpfte Sprinter zählen nicht zum Budget.
- **Rakete**: Der direkt getroffene Gegner bekommt 60 + 40 (Fläche), alle anderen im Radius 130 bekommen 40.
  Raketen- und Explosionsschaden ignoriert den Schild des Schildträgers.
- **Railgun**: durchschlägt auch den Schild des Schildträgers (sie ist die „schwere“ Waffe); Laden: gedrückt halten,
  Loslassen bricht ab; danach 1,25 s bis zum nächsten Schuss (= 0,8 Schuss/s inkl. Laden).
- **Mehrfachschuss** gilt für alle Waffen (Schrotflinte: 3 Fächer, Railgun: 3 Strahlen) und kostet 1 Munition.
- **Neue Waffe aufheben** rüstet sie sofort aus; eine schon vorhandene gibt nur Munition (kein Wechsel).
- **Waffenwechsel** zusätzlich mit Q/E. Kurze Wechsel-Verzögerung 0,12 s.
- **Drops**: Heilung/Power-ups 12 s, Waffen 15 s (wie in der Vorgabe), die letzten 3 s blinkend.
  Glückspilz rechnet relativ (+30 % von 10 % = 13 %).
- **Power-ups verlängern** sich beim erneuten Einsammeln um ihre Grunddauer, höchstens auf das Doppelte.
  Schild wird auf 50 aufgefüllt.
- **Bosse**: erscheinen 1,5 s lang (Ringe ziehen sich zusammen, unverwundbar, Kamera schwenkt hin). Boss-Leben
  wächst multiplikativ (+40 % pro Auftauchen); kommen beide gleichzeitig (ab Welle 20), haben sie je 75 %.
  Phasenwechsel (66 %/33 %): 0,9 s Brüllen, dabei unverwundbar; ein großer Treffer kann keine Phase überspringen.
- **Wächter**: Phase 1 ein Ring aus 16 Kugeln mit 3er-Lücke, Phase 2 zwei Ringe (halb versetzt) + Ansturm.
  Die Warnlinie zeigt den ganzen Weg inkl. Abprallern (wird mit derselben Physik vorausberechnet). Nach dem
  Ansturm ist er 0,6 s benommen. Phase 3: Spiralen statt Salven, alle 6 s 4 Läufer (höchstens 12 Helfer).
- **Brut**: Eier (max. 8) schlüpfen nach 3 s zu je 2 Sprintern; Säure-Geschosse zeigen ihren Zielkreis 1 s vorher.
  Bei 33 % teilt sie sich; die Lebensleiste läuft dann im letzten Drittel weiter.
- **Boss besiegt**: +5000 × Boss-Nummer (Welle/5), 3 Drops; übrige Helfer zerfallen (ohne Drops).
- **Upgrade-Karten**: erscheinen 1,2 s nach Wellenende (Pause). Erst Karte wählen (Tippen/Klick/1–3), dann
  bestätigen (nochmal tippen, Knopf oder Enter); die ersten 0,45 s ist die Auswahl gesperrt.
  Munitionsgürtel erhöht auch die schon vorhandene Munition. Sind alle Karten voll: +25 Leben statt Auswahl.
- **Schadenszahlen**: schnelle Treffer am selben Gegner (z. B. MG) werden zu einer Zahl zusammengezählt, sonst
  flimmert der Bildschirm voller kleiner Zahlen. Kritische Treffer bleiben eigene, größere gelbe Zahlen.
- **Glow** ohne teures `shadowBlur` im Spiel: Figuren sind vorgezeichnete Sprites (Glow einmal beim Erstellen),
  Wände/Hindernisse bekommen mehrere halbtransparente Striche, Effekte nutzen `lighter`.
- **Partikel** werden pro Bild (nicht pro Logikschritt) bewegt und frieren beim Hit-Stop mit ein.
- **Ton**: AudioContext entsteht bei der ersten Berührung/Klick/Taste. Auf iOS 16.4+ wird
  `navigator.audioSession.type = 'playback'` gesetzt, damit der Ton auch bei eingeschaltetem Stummschalter läuft
  (ältere iPhones: Stummschalter aus). Stimmen-Limit 12, wichtige Töne (Treffer am Spieler, Boss, Welle) dürfen
  darüber. Pegel aller Töne werden in `tests/scenarios.mjs` (`SCENARIO=sound`) offline gemessen.
- **Musik**: a-Moll (Am–F–C–G), 120 BPM, Boss 140 BPM mit Snare und Lead. Tempowechsel immer am Taktanfang.
  Das Bodengitter pulsiert auf der Kick – auch wenn die Musik stumm ist (Takt läuft weiter).
- **Menüs** sind HTML über dem Canvas (`menus.js` + `screens_*.js`), Ablauf in `flow.js`. Tasten im Menü werden
  sofort (Capture) behandelt, damit Enter auf einem Knopf nicht doppelt auslöst.
- **Startbildschirm-Demo**: echte Runde ab Welle 2–4 mit Bot (unverwundbar, stumm), startet nach 75 s neu.
- **Highscore**: wird beim Game Over sofort mit dem letzten Kürzel gespeichert (geht nie verloren); das Kürzel kann
  danach geändert werden. „Nochmal“ ist sofort möglich (Enter). Konfetti + Fanfare nur bei neuem Rekord (Platz 1).
  Pfeil hoch/runter im Kürzel-Feld ändert den Buchstaben (für Gamepad).
- **Aufgeben** im Pausemenü fragt nach; die Runde zählt dann normal für Statistik und Highscore.
- **Alles zurücksetzen** löscht Einstellungen, Highscores und Gesamtstatistik (mit Nachfrage).
- **Vibration** und **Farbeffekte bei Treffern** sind zusätzlich abschaltbar (laut Abschnitt 11 und 14).

## Bekannte Probleme / offen

- (noch nichts)

## Meilensteine

1. Plan ✔
2. Grundgerüst ✔ – Canvas, fester Zeitschritt, Eingabe, Kamera, Arena, Spieler mit Dash
3. Kampf-Kern ✔ – Pistole, Projektile (Pool), Läufer, Kollision über Spatial Hash, Schaden, Tod mit Zeitlupe,
   einfacher Game Over (Enter/Tippen = nochmal). Erste Effekte (Funken, Explosion, Hülsen, Schadenszahlen,
   roter Rand), HUD mit Leben, Punkten, Kombo und Waffe.
4. Gegner und Wellen ✔ – alle 7 Gegnertypen (+ Mini-Teiler, Ei für die Brut), `generateWave(nummer, seed)`
   mit Budget, Gruppen, Spezialwellen; Warnkreise mit Partikeln, höchstens 45 Gegner gleichzeitig (Warteschlange),
   letzte 3 markiert, Pause mit Countdown und Heilung, Pfeile am Rand, Warnstriche für Kugeln von außen.
   Bosswellen laufen bis Meilenstein 6 als normale Wellen. Cheats im Debug-Modus: G, K, N.
5. Waffen und Drops ✔ – Pistole, Schrotflinte, MG (wachsende Streuung), Raketenwerfer (Spur, Explosion),
   Railgun (Ladelinie, Strahl). Munition, Wechsel (Mausrad, 1–5, Q/E), automatischer Wechsel wenn leer.
   Drops (Heilung, Waffe, Power-up) schweben, pulsieren, ziehen sich heran, blinken; Power-ups Schild,
   Schnellfeuer, Mehrfachschuss, Zeitlupe, Magnet mit Symbolen und Ablauf-Balken im HUD; Waffenleiste unten.
6. Bosse und Upgrades ✔ – Wächter und Brut mit allen Phasen, Boss-Leiste mit Phasen-Strichen, Kameraschwenk,
   12 Upgrade-Karten (HTML-Overlay, Maus/Touch/Tasten). Simulationstest: Bot schafft 10 Wellen inkl. 2 Bossen.
7. Juice ✔ – Partikel (Funken, Explosion, Großexplosion mit Rauch/Trümmern/Brandfleck, Mündungsfeuer + Licht,
   Hülsen, Nachbilder, Leuchtspuren, Einsammel-Ring, Spawn-Sog), Trauma-Screenshake, Hit-Stop, gefedertes
   Stauchen, Schadenszahlen, Explosionsserie beim Boss-Tod, Aura bei Power-ups, lila Rand bei Zeitlupe.
8. Sound und Musik ✔ – 37 erzeugte Geräusche (Waffen, Treffer, Explosionen, Boss, Wellen, Menü, Herzschlag),
   Mischpult mit Kompressor, prozedurale Musik mit 3 Intensitäten, Gitter-Puls im Takt, M = Musik stumm,
   Ton aus bei App-Wechsel.
9. Menüs und Fortschritt ✔ – Startbildschirm mit animiertem Titel und Bot-Demo, Steuerung, Einstellungen
   (gespeichert), Highscores (Top 10, Kürzel), Pause mit Upgrades, Game Over mit hochzählenden Punkten,
   Statistik (Kills je Typ, Genauigkeit, Kombo, Lieblingswaffe …), Gesamtstatistik, Vollbild-Knopf.
