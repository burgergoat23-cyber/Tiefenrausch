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
- **Kamera** darf 30 Einheiten über die Arena-Grenze schauen, damit die leuchtende Wand sichtbar bleibt.
- **Streuung** in der Waffentabelle = gesamter Kegel (2° = ±1°).
- **Hindernisse**: Blöcke (Rechtecke) und Säulen (Kreise), 4 Layouts mit 8–10 Hindernissen.

## Bekannte Probleme / offen

- (noch nichts)

## Meilensteine

1. Plan ✔
2. Grundgerüst ✔ – Canvas, fester Zeitschritt, Eingabe, Kamera, Arena, Spieler mit Dash
