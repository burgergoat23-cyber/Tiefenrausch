# Arsenal – Minecraft-Mod (Fabric, 1.21.11)

CS-Skins für deine Waffen, PvP-Makros und ein Struktur-Tracker – alles in **einer** Jar-Datei.

Die fertige Datei liegt in `minecraft-mod/download/` (z. B. `arsenal-1.2.0+mc1.21.11.jar`).

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
| **G** | Inspect – Messer ansehen (jedes Messer hat eine eigene Animation) |
| **R** | Lunge-Swap (Speer) |
| **V** | Schnell-Enderperle (wechseln, werfen, zurück) |
| **B** | Schnell-Windladung |
| **C** (halten) | Zoom |
| – | Attribut-Swap an/aus, Schild-Brecher an/aus, Tracker-Suche (frei belegbar) |

**Tasten ändern direkt im Menü:** Reiter „Tasten & HUD“ (oder „Makros“) → auf den Knopf neben der Aktion klicken → gewünschte Taste drücken (auch Maus-Seitentasten). Esc = Taste entfernen. Ist eine Taste doppelt belegt, steht eine rote Warnung darunter.

## Was die Mod kann

**Skins (Reiter „Skins“)**
- Schwerter → CS-Messer (in 3D mit dünner Schneide, dickem Griff, Nieten und Parierstange): Karambit, Butterfly, Bajonett, M9-Bajonett, Flip, Gut, Huntsman, Falchion, Bowie, Schattendolche, Ursus, Navaja, Stiletto, Talon, Skeleton, Classic, Paracord, Survival, Nomad, Kukri.
- 28 Muster: Fade, Doppler, Ruby, Sapphire, Black Pearl, Gamma Doppler, Emerald, Marble Fade, Tiger Tooth, Slaughter, Crimson Web, Case Hardened, Lore, Autotronic, Damascus, Night, … bis Safari Mesh.
- Äxte (Danger-Zone-Axt, Tomahawk, Doppelaxt …), Streitkolben (Hammer, Schraubenschlüssel, Thors Hammer …), Speere, Schilde (Riot/SWAT, Ballistik, Spartaner …), Enderperlen → CS-Granaten, Windladungen, Totems (Medi-Shot, C4 …).
- Pro Material einzeln oder für alle gleichzeitig („Für: Alle“).
- StatTrak™ zählt deine Kills pro Skin.
- Skins sieht nur **du** – sie funktionieren deshalb auf jedem Server.

**Pakete:** wie ein Resourcepack – ein Klick, und jede Schwert-Stufe bekommt ein anderes CS-Messer im selben Muster (Netherite = Karambit, Diamant = Butterfly, Eisen = M9, Gold = Talon, Kupfer = Flip, Stein = Gut, Holz = Bajonett), dazu passende Axt, Kolben, Speer, Schild, Granaten und Totem. 14 Pakete (Fade, Doppler, Ruby, Sapphire, Emerald, Marble Fade, Tiger Tooth, Crimson Web, Case Hardened, Slaughter, Night, Lore, Damascus, Camo).

**Messer-Animationen:** beim Wechseln aufs Messer kommt eine Zieh-Animation, mit G die Inspect-Animation – je Messer anders (Karambit/Talon wirbeln um den Finger, Butterfly klappt auf und wird hochgeworfen, Schattendolche drehen sich, M9/Bajonett werden geworfen und gefangen, Flip/Falchion/Navaja/Stiletto klappen auf). Mit Klick- und Schwung-Geräuschen, Tempo einstellbar.

**Fadenkreuz:** eigenes CS-Fadenkreuz (Länge, Dicke, Lücke, Farbe, Punkt, Umrandung, T-Form, Kreis, dynamisch).

**Viewmodel:** Hand in alle Richtungen einstellen – links/rechts, oben/unten, nah/fern, kippen, drehen, neigen und Größe; die linke Hand auf Wunsch getrennt. Im Viewmodel-Reiter rückt das Menü zur Seite, damit du die Hand live siehst.

**Shader:** Klar & Scharf, Lebendig, Kino, Goldene Stunde, Frost, Traum, HDR, Noir, Comic, Nachtsicht – mit Leuchten (Bloom), Filmkurve, Farbstimmung, Vignette und Filmkorn. Für echte Shader-Pakete (Schatten, Wasser) zusätzlich Iris + Sodium installieren.

**Tracker:** sucht Bastionen, Netherfestungen, Endsiedlungen, **Endschiffe** (mit Elytra) und viele Oberwelt-Strukturen. Oben rechts im Bild stehen Pfeil und Entfernung, in der Nähe zeigt eine Lichtsäule den Ort.
- **Einzelspieler:** sucht in der ganzen Welt – weit über die Sichtweite hinaus (Suchradius einstellbar bis 10 000 Blöcke).
- **Server:** nur in geladenen Chunks und nur, wenn du es im Menü erlaubst. Weiter weg ginge nur mit dem Seed – das wäre Cheaten und ist absichtlich nicht drin.

**Makros (alles einzeln an/aus):**
- **Lunge-Swap (R):** Taste drücken → im selben Moment Speer (am liebsten mit Sprungangriff/Lunge), Stoß, zurück zum vorherigen Item. Halte vorher kurz ein anderes Item (z. B. Windladung), dessen volle Aufladung zählt für den Stoß. Optional: „Auch beim Werfen einer Windladung (Rechtsklick)“ – dann löst jeder Windladungs-Wurf sofort den Lunge-Swap aus.
- **Attribut-Swap:** schlägst du mit Schwert/Axt zu, wird für genau diesen Schlag auf den Streitkolben gewechselt (optional nur beim Fallen).
- **Schild-Brecher:** blockt der Gegner mit Schild, wird für den Schlag auf die Axt gewechselt.
- **Schnell-Perle / Schnell-Windladung.**

> ⚠️ Makros sind auf vielen Servern verboten. Nur dort benutzen, wo es erlaubt ist – im Einzelspieler immer ok. Es gibt **keine** Cheats wie Killaura, Reach oder X-Ray.

## Für Entwickler

- Quellcode: `minecraft-mod/src/main/java/com/burgergoat/arsenal/`
- Grafiken erzeugt `python3 tools/generate_assets.py` (Formen + Muster werden aus Code gezeichnet).
- Gebaut wird automatisch auf GitHub (`.github/workflows/minecraft-mod.yml`): Jar nach `download/`, Spieltest-Screenshots nach `test-screenshots/`.
