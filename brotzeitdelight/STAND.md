# Stand

Stand: 11.11.2026, nach Meilenstein 2 (Faktencheck). Wartet auf deine Antworten und dein Okay für Meilenstein 3.

## Wo was liegt

- Vorgabe: `BROTZEIT_DELIGHT_SPEC.md` (Version 2) in diesem Ordner. Immer zuerst lesen.
- Projekt: Repository `burgergoat23-cyber/Tiefenrausch`, Branch `claude/new-session-lbc1s3`, Ordner `brotzeitdelight/`.
  Der Mod teilt sich das Repository vorerst mit Tiefenrausch, berührt dessen Dateien aber nicht.
  Für die Veröffentlichung (Meilenstein 10) zieht er in ein eigenes Repository um.
- Mod-Datei nach dem Bauen: `build/libs/brotzeitdelight-1.21.1-0.1.0.jar` (wird nicht ins Repository eingecheckt).

## Fertig

**Meilenstein 1 – Grundgerüst**

- NeoForge-Projekt nach dem offiziellen MDK (Minecraft 1.21.1, NeoForge 21.1.265, Java 21, Gradle 9.2.1).
- Der Mod startet ab NeoForge 21.1.219, derselben Untergrenze wie Farmer's Delight 1.3.4 (deine Entscheidung vom 11.11.2026). Gebaut wird weiter gegen 21.1.265.
- Farmer's Delight 1.3.4 als Pflicht-Abhängigkeit, geladen vor unserem Mod. 1.3.4 ist weiterhin die neueste Version für 1.21.1 (geprüft auf Modrinth am 10.11.2026).
- Kreativ-Tab „Brotzeit Delight" direkt hinter dem Tab von Farmer's Delight, Symbol: Breze (Platzhalter).
- Datengenerator für Item-Modelle und beide Sprachdateien. Alle Texte stehen an einer Stelle (`data/ModTranslations.java`), jeder Eintrag verlangt Deutsch und Englisch.
- Platzhalter-Werkzeug `tools/texturen/platzhalter.py`.
- Unterlagen: `ABWEICHUNGEN.md` (1 Eintrag), `TEXTUREN.md`, `CHANGELOG.md`, `IDEEN.md`.

## Was geprüft ist und was nicht

Geprüft am 10.11.2026 in der Cloud-Umgebung:

- Bau (`./gradlew build`) ohne Fehler und ohne Compiler-Warnungen.
- Datengenerator (`./gradlew runData`) ohne Fehler; erzeugt 1 Modell und 2 Sprachdateien.
- Entwicklungs-Server (`./gradlew runServer`): startet mit beiden Mods bis „Done".
- Entwicklungs-Client (`./gradlew runClient`, virtueller Bildschirm, Software-Grafik): Titelbild zeigt „4 Mods"; Testwelt im Kreativmodus geladen; Tab „Brotzeit Delight" steht auf Seite 2 hinter Farmer's Delight und enthält die „Breze"; Mod-Liste zeigt Name, Version 0.1.0, Lizenz MIT und Beschreibung.
- Echter NeoForge-Server 21.1.265 (Installer) mit `farmers-delight-1.21.1-1.3.4.jar` und unserer fertigen `.jar` im Ordner `mods`: startet, `brotzeitdelight:pretzel` ist vorhanden und heißt „Pretzel", sauberes Beenden.
- Logs von allen vier Läufen gelesen: keine Fehler- oder Warnzeile, die von unserem Mod stammt.

Geprüft am 11.11.2026 nach dem Senken der Mindestversion:

- Der Quellcode lässt sich auch gegen NeoForge 21.1.219 ohne Fehler und Warnungen übersetzen (`./gradlew build -Pneo_version=21.1.219`).
- Echter NeoForge-Server 21.1.219 mit Farmer's Delight 1.3.4 und unserer `.jar`: startet, `brotzeitdelight:pretzel` ist vorhanden, sauberes Beenden, keine Warnung von unserem Mod.
- Dieselbe `.jar` noch einmal auf dem echten Server 21.1.265: unverändert in Ordnung.

Nicht geprüft:

- Start in einem echten Minecraft-Client mit Launcher (das kann nur am PC geschehen).
- Client mit NeoForge 21.1.219 (bisher nur der Server; der vollständige Test mit 21.1.219 folgt in Meilenstein 9).
- Englische Anzeige im Client (die Sprachdatei ist erzeugt, im Spiel angesehen wurde nur Deutsch).
- Ton: Die Cloud-Umgebung hat kein Audiogerät.

Warnungen im Log, die nicht von uns stammen und bei jedem Lauf erscheinen:

- `VanillaPackResourcesBuilder … uses unexpected schema`: kommt von NeoForge selbst. In der Entwicklungsumgebung steht in der Zeile der Projektordner und damit das Wort `brotzeitdelight`; gemeint ist nur der Dateipfad.
- `Commands: Ambiguity between arguments [teleport …]`, `Missing sound for event: minecraft:item.goat_horn.play`, `Shader … could not find sampler`: Vanilla.
- `Failed to request yggdrasil public key`, `Couldn't look up profile properties`, `Error starting SoundSystem`: nur in der Cloud-Umgebung (kein Zugang zu Mojang-Konten, kein Audiogerät).

**Meilenstein 2 – Faktencheck** (11.11.2026): Ergebnis in `FAKTENCHECK.md`, neue Abweichungen Nr. 2 und 3 in `ABWEICHUNGEN.md`. Am Mod wurde nichts geändert.

## Als Nächstes

**Meilenstein 3 – Breze komplett**, sobald du die Fragen unten beantwortet hast.

Technische Festlegungen aus dem Faktencheck (brauchen kein Okay):

- Gerichte mit Effekt und Schüssel: FD-Klasse `ConsumableItem`, Eigenschaften wie `ModItems.bowlFoodItem`.
- Rezepte erzeugen mit FDs `CookingPotRecipeBuilder` und `CuttingBoardRecipeBuilder`; Messer = `knife_dig` oder `c:tools/knife` wie FD.
- „Schnitzel mit Kartoffelsalat": Weil der Kartoffelsalat seine Schüssel als Werkbank-Rest hat, braucht dieses Rezept einen eigenen kleinen Rezepttyp, der genau diesen Rest unterdrückt (kein Mixin nötig). Wird ausdrücklich getestet.
- Wilder Senf: eigene Klasse auf Basis der Vanilla-Blume (nicht `WildCropBlock`, weil dort Knochenmehl die Pflanze vermehrt und Sand erlaubt ist). Welterzeugung mit den Standardtypen von Minecraft/NeoForge (`minecraft:random_patch`, `neoforge:add_features`) und den Zahlen von Wildweißkohl (1 von 30 Chunks, 64 Versuche, Streuung 6/3). So hängt sie nicht an inneren FD-Typen, die sich ändern können.
- Gärfass ohne `ignitedByLava`. Blasen-Partikel: Vorschlag `minecraft:bubble_pop`, Sichtprüfung in Meilenstein 6.

## Offene Fragen an dich

Fragen aus dem Faktencheck (Empfehlung in Klammern):

A. Schnitzel mit Kartoffelsalat: Sättigung 0,8 ist stärker als FDs stärkstes Gericht (14 / 0,75). Auf 0,75 senken? (ja)
B. Senfpflanze: Vanilla-Weizen hat kein Kreuzmodell, sondern das Raute-Modell `crop`. Welches? (`crop` wie Weizen)
C. Senfkörner bei der Ernte: „2 bis 4" und „gleiche Formel wie Weizensamen" (ergibt 1 bis 4) widersprechen sich. Welches? (2 bis 4: 2 fest plus Zufall, mit Glück mehr)
D. Wilder Senf als Blume braucht einen Effekt für Verdächtige Suppe. Welchen? (Feuerresistenz 4 s, „scharf")
E. Texte: FD sagt auf Deutsch „Weißkohl". Tooltip „Rechtsklick mit Weißkohl: befüllen"? (ja)
F. Breze im Tag `c:foods/bread`: Dann geht sie auch in FD-Sandwiches und in unseren Brot-Rezepten (Leberkässemmel, Schnitzel, Semmelknödel). In Ordnung? (ja)

Beide Antworten hast du am 11.11.2026 für später angekündigt.

1. **Autorname:** Welcher Name soll in der Mod-Liste und in der `LICENSE` stehen? (Wird spätestens in Meilenstein 10 gebraucht.)
2. **Referenzbilder:** Der Ordner `referenzen/` fehlt noch. Gebraucht wird er vor Meilenstein 8; welche Bilder, steht in `TEXTUREN.md`.

## Zusagen für spätere Meilensteine

- **Selbstprüfung nach jedem Meilenstein:** zusätzlich `./gradlew build -Pneo_version=21.1.219` laufen lassen. So fällt sofort auf, wenn der Code etwas benutzt, das es in der ältesten erlaubten NeoForge-Version noch nicht gibt. Danach einmal normal bauen, damit wieder gegen 21.1.265 gearbeitet wird.
- **Meilenstein 9:** Client und Server zusätzlich mit NeoForge 21.1.219 testen und den Punkt ins Handprotokoll aufnehmen.

## Technik-Notizen für die nächste Sitzung

- Die Cloud-Umgebung „Standard" braucht diese erlaubten Adressen: `maven.neoforged.net`, `piston-meta.mojang.com`, `piston-data.mojang.com`, `libraries.minecraft.net`, `resources.download.minecraft.net` (Bau und Start), `api.modrinth.com`, `cdn.modrinth.com` (Farmer's Delight), `launchermeta.mojang.com` (nur der NeoForge-Server-Installer). Parchment kommt über `maven.neoforged.net`.
- Quellcode von Farmer's Delight zum Nachschlagen (nicht im Repository):
  `git clone --depth 1 --branch 1.21 https://github.com/vectorwing/FarmersDelight`
- Entpackter Minecraft-Code nach dem ersten Bau: `build/moddev/artifacts/neoforge-21.1.265-sources.jar`.
- Server-Test: `run/eula.txt` mit `eula=true` anlegen. `./gradlew runServer` reicht Eingaben nicht an den Server weiter; beenden mit `kill -TERM` auf den Java-Prozess oder gleich den echten Server nehmen (`java -jar neoforge-21.1.265-installer.jar --installServer .`, dann `run.sh nogui`).
- Client-Test ohne Bildschirm: `Xvfb :99 -screen 0 1024x768x24 +extension GLX`, dann `DISPLAY=:99 LIBGL_ALWAYS_SOFTWARE=1 ./gradlew runClient`; Klicks und Tasten mit `xdotool`, Bilder mit `import -window root`. In `run/options.txt` helfen `onboardAccessibility:false` und `pauseOnLostFocus:false`. `--args` an `runClient` funktioniert nicht (ersetzt die Startklasse).
- Eine Kreativ-Testwelt entsteht am schnellsten so: Server einmal mit `gamemode=creative` starten, `run/world` nach `run/saves/Testwelt` kopieren.
