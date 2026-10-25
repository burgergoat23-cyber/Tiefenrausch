# Arsenal – Minecraft-Mod (Fabric, 1.21.11)

CS-Skins für deine Waffen, PvP-Makros und ein Struktur-Tracker – alles in **einer** Jar-Datei.

Die fertige Datei liegt in `minecraft-mod/download/` (z. B. `arsenal-1.0.0+mc1.21.11.jar`).

## Installieren (einmalig)

1. **Fabric installieren:** <https://fabricmc.net/use/installer/> → Installer starten → Version **1.21.11** wählen → „Installieren“.
2. **Fabric API herunterladen** (Version für 1.21.11): <https://modrinth.com/mod/fabric-api>
3. Den Ordner `mods` öffnen:
   - Windows: `Windows-Taste + R` → `%appdata%\.minecraft\mods` eintippen → Enter.
   - Gibt es den Ordner nicht, einfach anlegen.
4. **Beide Dateien** (Fabric API und `arsenal-….jar`) in den Ordner `mods` ziehen.
5. Minecraft-Launcher öffnen → Profil **„fabric-loader-1.21.11“** wählen → Spielen.

## Tasten

| Taste | Was passiert |
|---|---|
| **K** | Arsenal-Menü öffnen |
| **G** | Inspect – Messer in der Hand ansehen (wie in CS) |
| **R** | Lunge-Swap (Speer) |
| **V** | Schnell-Enderperle (wechseln, werfen, zurück) |
| **B** | Schnell-Windladung |
| **C** (halten) | Zoom |

Ändern: Optionen → Steuerung → Tastenbelegung → Kategorie „Arsenal“.

## Was die Mod kann

**Skins (Reiter „Skins“)**
- Schwerter → CS-Messer: Karambit, Butterfly, Bajonett, M9-Bajonett, Flip, Gut, Huntsman, Falchion, Bowie, Schattendolche, Ursus, Navaja, Stiletto, Talon, Skeleton, Classic, Paracord, Survival, Nomad, Kukri.
- 28 Muster: Fade, Doppler, Ruby, Sapphire, Black Pearl, Gamma Doppler, Emerald, Marble Fade, Tiger Tooth, Slaughter, Crimson Web, Case Hardened, Lore, Autotronic, Damascus, Night, … bis Safari Mesh.
- Äxte (Danger-Zone-Axt, Tomahawk, Doppelaxt …), Streitkolben (Hammer, Schraubenschlüssel, Thors Hammer …), Speere, Schilde (Riot/SWAT, Ballistik, Spartaner …), Enderperlen → CS-Granaten, Windladungen, Totems (Medi-Shot, C4 …).
- Pro Material einzeln oder für alle gleichzeitig („Für: Alle“).
- StatTrak™ zählt deine Kills pro Skin.
- Skins sieht nur **du** – sie funktionieren deshalb auf jedem Server.

**Kisten:** Kiste öffnen wie in CS (nur Spaß, kostet nichts) und den Gewinn ausrüsten.

**Fadenkreuz:** eigenes CS-Fadenkreuz (Länge, Dicke, Lücke, Farbe, Punkt, Umrandung, T-Form, Kreis, dynamisch).

**Viewmodel:** Hand/Item verschieben und verkleinern (wie `viewmodel_offset`).

**Filter („Shader“):** Digital Vibrance, Kino, Warm, Kalt, Noir, Scharf, Hell, Retro, Nachtsicht-Look. Für echte Shader-Pakete zusätzlich Iris + Sodium installieren.

**Tracker:** sucht Bastionen, Netherfestungen, Endsiedlungen, **Endschiffe** (mit Elytra) und viele Oberwelt-Strukturen. Oben rechts im Bild stehen Pfeil und Entfernung, in der Nähe zeigt eine Lichtsäule den Ort.
- **Einzelspieler:** sucht in der ganzen Welt – weit über die Sichtweite hinaus (Suchradius einstellbar bis 10 000 Blöcke).
- **Server:** nur in geladenen Chunks und nur, wenn du es im Menü erlaubst. Weiter weg ginge nur mit dem Seed – das wäre Cheaten und ist absichtlich nicht drin.

**Makros (alles einzeln an/aus):**
- **Lunge-Swap (R):** wechselt auf den Speer (am liebsten mit Sprungangriff/Lunge), sticht und wechselt zurück. Wartezeiten in Ticks einstellbar (1 Tick = 0,05 s). Optional automatisch nach einer Windladung.
- **Attribut-Swap:** schlägst du mit Schwert/Axt zu, wird für genau diesen Schlag auf den Streitkolben gewechselt (optional nur beim Fallen).
- **Schild-Brecher:** blockt der Gegner mit Schild, wird für den Schlag auf die Axt gewechselt.
- **Schnell-Perle / Schnell-Windladung.**

> ⚠️ Makros sind auf vielen Servern verboten. Nur dort benutzen, wo es erlaubt ist – im Einzelspieler immer ok. Es gibt **keine** Cheats wie Killaura, Reach oder X-Ray.

## Für Entwickler

- Quellcode: `minecraft-mod/src/main/java/com/burgergoat/arsenal/`
- Grafiken erzeugt `python3 tools/generate_assets.py` (Formen + Muster werden aus Code gezeichnet).
- Gebaut wird automatisch auf GitHub (`.github/workflows/minecraft-mod.yml`): Jar nach `download/`, Spieltest-Screenshots nach `test-screenshots/`.
