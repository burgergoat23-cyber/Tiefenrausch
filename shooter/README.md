# NEON ARENA

Schneller Top-down-Arena-Shooter im Browser. Reines JavaScript mit ES-Modulen und Canvas 2D,
ohne Framework, ohne externe Bilder, Schriften oder Sounds.

## Starten

ES-Module brauchen einen kleinen lokalen Server (Doppelklick auf `index.html` reicht nicht).
Im Ordner `shooter/` eins davon ausführen:

```bash
python3 -m http.server 8000
# oder
npx serve .
```

Dann im Browser `http://localhost:8000` öffnen.

## Steuerung (PC)

| Aktion | Taste |
| --- | --- |
| Bewegen | WASD oder Pfeiltasten |
| Zielen | Maus |
| Schießen | linke Maustaste (gedrückt halten) |
| Dash | Leertaste oder rechte Maustaste |
| Waffe wechseln | Mausrad oder 1 bis 5 |
| Pause | P oder Esc |
| Musik stumm | M |
| Debug | F3 |

## Handy und iPad

- Steuerung: linker Daumen bewegen, rechter Daumen zielen und schießen, Knöpfe für Dash, Waffe und Pause.
- Als App auf den Home-Bildschirm: in Safari auf „Teilen“ → „Zum Home-Bildschirm“.
- Ton startet nach der ersten Berührung. Bei älteren iPhones den Stummschalter ausschalten.

## Tests

```bash
node tests/logic.test.js          # Logik-Tests mit node (ohne Browser)
node tests/browser_check.mjs      # optional: Browser-Prüfung mit Playwright, macht Bildschirmfotos
```

## Aufbau

Siehe `NOTES.md` (Architektur, Entscheidungen, bekannte Probleme). Alle Balancing-Werte stehen in `src/config.js`.
