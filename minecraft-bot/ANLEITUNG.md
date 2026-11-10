# Minecraft-Bot „Kumpel“

Ein Mitspieler für deine **Einzelspieler-Welt** in **Minecraft Java Edition** (Windows-PC).
Er läuft dir nach, kämpft gegen Monster, baut Blöcke ab, stellt Sachen her und hört auf Befehle im Chat.

## So startest du ihn

1. **Minecraft starten** und deine Welt öffnen.
2. **Esc** drücken → **„Im LAN öffnen“** → „Cheats erlauben: **An**“ → **„LAN-Welt starten“**.
   (Im Chat steht dann: „Lokales Spiel auf Port 12345 gehostet“.)
3. Im Bot-Ordner **`start.bat`** doppelklicken.
   - Beim allerersten Mal installiert sie das kostenlose Programm *Node.js* (bitte Eltern fragen) und lädt die Bot-Bausteine. Danach `start.bat` noch einmal starten.
   - Fragt Windows wegen der **Firewall**, klicke auf „Zulassen“.
4. Der Bot findet die Welt von allein. Wenn nicht, fragt er nach der Zahl (dem Port) aus Schritt 2.
5. Im Spiel erscheint **Kumpel**. Steht er woanders, hol ihn mit `/tp Kumpel @s` zu dir.

Den Bot beendest du, indem du das schwarze Fenster schließt.
Schritt 2 und 3 musst du jedes Mal machen, wenn du Minecraft neu startest.

## Befehle (im Minecraft-Chat, Taste T)

| Befehl | Was passiert |
|---|---|
| `hilfe` | zeigt alle Befehle |
| `folge` | Kumpel läuft dir nach |
| `komm` | Kumpel kommt einmal zu dir |
| `stopp` | Kumpel bleibt stehen und hört mit allem auf |
| `hol 10 holz` | baut Blöcke ab (auch `stein`, `kohle`, `eisen`, `erde`, `sand`, `kies` …) |
| `gib holz` / `gib 5 holz` / `gib alles` | wirft dir Sachen hin |
| `inventar` | sagt, was er dabei hat |
| `beschütze` / `friedlich` | kämpft gegen Monster / kämpft nicht |
| `jage kuh` / `jage 3 schwein` / `greif an zombie` | greift ein Tier oder Monster an |
| `mach bretter` / `mach werkbank` / `mach holzspitzhacke` | stellt etwas her (für große Rezepte muss eine Werkbank in der Nähe stehen) |
| `iss` | isst etwas (macht er bei Hunger auch von allein) |
| `schlaf` / `wach auf` | legt sich in ein freies Bett in der Nähe |
| `angeln` | angelt, bis du `stopp` schreibst (er braucht eine Angel) |
| `status` / `wo bist du` | Leben, Hunger, Koordinaten |
| `geh zu 100 64 -20` | läuft zu Koordinaten |
| `tanz` / `spring` | nur zum Spaß |

Du kannst Sachen (Essen, Werkzeug, Rüstung, Schwert) einfach vor ihm auf den Boden werfen – er hebt sie auf und zieht Rüstung selbst an.

## Gut zu wissen

- Kumpel greift **keine Creeper** an (sonst sprengt er dein Haus).
- Damit die Nacht übersprungen wird, muss auch Kumpel schlafen: zweites Bett hinstellen und `schlaf` schreiben.
- Für Erze braucht er die passende Spitzhacke.
- Den Namen kannst du in `einstellungen.json` ändern (er darf nicht so heißen wie du).
- Unterstützte Minecraft-Versionen: 1.8 bis 1.21.11 und 26.1. Ist deine Version zu neu, sagt der Bot das beim Start.
- Nur für die **Java Edition**. Auf iPad, Handy und Konsole (Bedrock) geht er nicht.

## Technik (für Neugierige)

`bot.js` nutzt die freie Bibliothek [mineflayer](https://github.com/PrismarineJS/mineflayer). Deutsche Wörter stehen in `namen.js` – dort kannst du neue Wörter ergänzen.
