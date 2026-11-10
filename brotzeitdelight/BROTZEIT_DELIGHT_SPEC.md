# Brotzeit Delight – vollständige Projektbeschreibung für Claude Code

Version dieser Beschreibung: 2

Diese Datei ist die verbindliche Vorgabe für das Projekt. Lies sie vollständig, bevor du etwas anlegst.

**Rangfolge bei Widersprüchen:**
1. Technische Tatsachen aus dem Quellcode von Farmer's Delight und NeoForge (z. B. echte Item-IDs, Klassen, Rezeptformate).
2. Diese Datei.
3. Deine eigenen Annahmen. Diese nur, wenn 1 und 2 nichts sagen, und dann mit Rückfrage an mich.

Wenn du wegen Punkt 1 von dieser Datei abweichst, trag die Abweichung in `ABWEICHUNGEN.md` ein (was, warum, Quelle) und sag es mir.

---

## Inhalt

1. Überblick und Qualitätsanspruch
2. Technik und Projektaufbau
3. Geprüfte Fakten zu Farmer's Delight
4. Referenzbilder
5. Stil-Leitfaden für Texturen
6. Items: Zutaten und Zwischenprodukte
7. Items: Gerichte
8. Rezepte
9. Senfpflanze und Wilder Senf
10. Gärfass
11. Fortschritte
12. Tags, Kompost, Tierfutter
13. Texte und Übersetzungen
14. Konfiguration
15. Qualitätsregeln für Code und Daten
16. Tests
17. Meilensteine
18. Abnahmeliste
19. Veröffentlichung auf Modrinth
20. Nicht im Umfang
21. Arbeitsregeln

---

## 1. Überblick und Qualitätsanspruch

- **Name:** Brotzeit Delight (Arbeitstitel)
- **Was es ist:** Eine Erweiterung (Addon) für Farmer's Delight mit deutscher Küche.
- **Zielgruppe:** Spieler und Modpack-Ersteller, die Farmer's Delight nutzen.
- **Ziel:** Ein kleiner Mod, der sich anfühlt, als gehöre er zu Farmer's Delight, und der auf Modrinth veröffentlicht wird.

**Qualitätsanspruch:** Der Mod darf nicht wie schnell erzeugte Massenware wirken. Das heißt konkret:
- Jede Funktion ist im Überlebensmodus getestet, einzeln und im Mehrspieler.
- Jede Textur ist von mir einzeln abgenommen. Keine Platzhalter in der Veröffentlichung.
- Keine Fehler oder Warnungen von unserem Mod im Log.
- Werte, Rezepte und Namen sind in sich stimmig und passen zu Farmer's Delight.
- Jede Interaktion hat Rückmeldung: Geräusch, sichtbare Veränderung, bei Bedarf kurzer Text.
- Lieber eine Funktion streichen als sie halbfertig ausliefern.

**Über mich:** Ich bin kein Profi-Programmierer. Erkläre mir nach jedem Schritt kurz und in einfachen Worten, was du gemacht hast und was ich selbst im Spiel testen soll.

---

## 2. Technik und Projektaufbau

| Punkt | Vorgabe |
|---|---|
| Minecraft | Java Edition 1.21.1 |
| Mod-Loader | NeoForge, aktuelle stabile Version für 1.21.1 |
| Java | 21 |
| Pflicht-Abhängigkeit | Farmer's Delight für NeoForge 1.21.1, aktuelle Version |
| Mod-ID | `brotzeitdelight` |
| Paketname | `de.brotzeitdelight` |
| Startversion | `0.1.0` |
| Lizenz | MIT für Code und Grafiken |
| Sprachen | `de_de` und `en_us`, beide vollständig |
| Seiten | Client und Server werden beide benötigt |

**Zuerst prüfen, nicht raten:**
1. Genaue aktuelle Versionsnummern von NeoForge und Farmer's Delight für 1.21.1.
2. Echte Item-IDs, Tags, Klassen und Rezeptformate von Farmer's Delight. Quelle: das offizielle GitHub-Repository `vectorwing/FarmersDelight`, Branch für 1.21.x, und dessen Wiki.
3. Wie Farmer's Delight Gerichte mit Schüssel-Rückgabe, Tooltips für Effekte und Wildpflanzen umsetzt. Nutze dessen öffentliche Klassen mit, statt sie nachzubauen.

**Projektaufbau:**
- Standard-NeoForge-Projekt mit Gradle (Vorlage: offizielles NeoForge-MDK für 1.21.1).
- Farmer's Delight als Abhängigkeit im Build einbinden, sodass es in der Entwicklungsumgebung mitläuft.
- In `neoforge.mods.toml`: Farmer's Delight als Pflicht-Abhängigkeit mit Mindestversion, Ladereihenfolge nach Farmer's Delight.
- Rezepte, Loot-Tabellen, Tags, Modelle, Blockzustände, Sprachdateien und Fortschritte per Datengenerator (Datagen) erzeugen. Erzeugte Dateien nie von Hand ändern.
- Klare Ordnerstruktur, eine Aufgabe pro Klasse:

```
de.brotzeitdelight
├── BrotzeitDelight.java          (Einstiegspunkt)
├── registry/                     (Items, Blöcke, Block-Entities, Rezepttypen, Kreativ-Tab, Geräusche)
├── item/                         (eigene Item-Klassen, nur wenn nötig)
├── block/                        (Senfpflanze, Wilder Senf, Gärfass)
├── block/entity/                 (Gärfass-Block-Entity)
├── recipe/                       (Gär-Rezept)
├── config/                       (Konfiguration)
├── data/                         (Datengeneratoren)
└── client/                       (alles, was nur auf dem Client läuft)
```

- Ein Kreativ-Tab „Brotzeit Delight" mit einer Breze als Symbol. Reihenfolge darin: Gärfass, Senfkörner, Wilder Senf, Senf, Sauerkraut, dann rohe Zutaten, dann Gerichte in der Reihenfolge aus Abschnitt 7.

---

## 3. Geprüfte Fakten zu Farmer's Delight

Diese Punkte habe ich vorab recherchiert. Prüfe sie trotzdem am Quellcode gegen.

- Die Version 1.3.4 ist laut einem aktuellen Wiki dieselbe für Forge 1.20.1 und NeoForge 1.21.1. Prüfe, ob es inzwischen eine neuere gibt.
- **Kochtopf-Rezepte** haben den Typ `farmersdelight:cooking` mit den Feldern `ingredients` (bis zu sechs Einträge), `result`, `container` (optional, überschreibt den Behälter), `cookingtime` (Ticks, Standard 200), `experience` und `recipe_book_tab` (z. B. `meals`, `drinks`, `misc`).
- **Schneidebrett-Rezepte** haben den Typ `farmersdelight:cutting` mit Zutat, Werkzeug (Tag oder Werkzeug-Aktion) und einem oder mehreren Ergebnissen.
- **Pfanne und Herd** nutzen die normalen Lagerfeuer-Rezepte. Eigene Pfannen-Rezepte sind nicht nötig.
- **Nahrhaft (Nourishment):** Der Hungerbalken sinkt nicht, solange der Effekt läuft. Keine Stufen, nur Dauer.
- **Behaglichkeit (Comfort):** Wird in neueren Farmer's-Delight-Versionen zurückgefahren, Suppen geben dort inzwischen Nahrhaft. **Dieser Mod verwendet deshalb nur Nahrhaft.**
- **Werte-Obergrenze:** Das stärkste Tellergericht von Farmer's Delight hat 14 Hunger und 5 Minuten Nahrhaft. Kein Gericht dieses Mods darf stärker sein.
- **Stapelgrößen:** Schüsselgerichte stapeln bis 16, Brote und Brötchen bis 64.
- Weizenteig entsteht aus Weizen und Wassereimer, rohe Nudeln werden aus Weizenteig geschnitten.

---

## 4. Referenzbilder

Im Projektordner gibt es den Ordner `referenzen/`:
- `referenzen/stil/`: meine eigenen Screenshots von Farmer's-Delight-Items im Spiel, stark herangezoomt. Das ist die Stilvorlage für Farbigkeit, Umrisse, Schattierung und Motivgröße.
- `referenzen/gerichte/`: Fotos der echten Gerichte für Form und Farben.
- `referenzen/bloecke/`: Screenshots von Farmer's-Delight-Blöcken (Kochtopf, Korb, Wildpflanzen) und vom Vanilla-Fass.

**Regeln:**
- Sieh dir alle Bilder an, bevor du Texturen oder Modelle erstellst.
- Ist ein Ordner leer, sag mir genau, welche Bilder fehlen, und arbeite solange nur nach Abschnitt 5.
- Die Bilder sind nur Vorlage für den Stil. Es werden keine Pixel, Texturen, Modelle oder Code-Teile aus Farmer's Delight oder anderen Mods übernommen. Alles in diesem Mod ist neu erstellt.

---

## 5. Stil-Leitfaden für Texturen

### 5.1 Grundregeln

- **Größe:** Items 16×16 Pixel. Blöcke 16×16 pro Seite. PNG, transparenter Hintergrund.
- **Koordinaten in dieser Datei:** x von 0 (links) bis 15 (rechts), y von 0 (oben) bis 15 (unten).
- **Motivgröße:** Das Motiv füllt 12 bis 14 Pixel der Breite und lässt rundum mindestens 1 Pixel frei.
- **Umriss:** 1 Pixel breit, in der Umrissfarbe der jeweiligen Palette. Kein reines Schwarz. An der Lichtseite (oben links) darf der Umriss eine Stufe heller sein.
- **Schattierung:** 3 bis 4 Helligkeitsstufen pro Farbe. Licht von oben links, Schatten unten rechts.
- **Glanzlichter:** höchstens 1 bis 3 einzelne Pixel pro Motiv.
- **Verboten:** weiche Verläufe, Kantenglättung, halbtransparente Pixel, Rauschen, Text, Fotos als Grundlage.
- **Farbanzahl:** höchstens 12 Farben pro Textur.
- **Lesbarkeit:** Jedes Item muss in der Schnellzugriffsleiste in Originalgröße sofort erkennbar und von den anderen unterscheidbar sein. Prüfe das mit einem Sammelbild aller Items nebeneinander in Originalgröße.
- **Einheitlichkeit:** Gleiche Dinge sehen überall gleich aus. Die Schüssel ist in allen Schüsselgerichten dieselbe, der Senfton überall derselbe.

### 5.2 Farbpalette

| Zweck | Hell | Mittel | Dunkel | Umriss |
|---|---|---|---|---|
| Teig, helles Gebäck | `#E8C27A` | `#C98F45` | `#9A6230` | `#5A3A1E` |
| Laugengebäck | `#C77A3A` | `#9C5524` | `#74391A` | `#40200F` |
| Gebratenes Fleisch | `#B8733F` | `#8E4F2A` | `#6A371F` | `#3B1F12` |
| Rohes Fleisch | `#E79A8F` | `#C96F68` | `#9F4E4E` | `#5E2B2E` |
| Panade | `#E3B458` | `#C48A33` | `#9A6423` | `#573814` |
| Sauerkraut | `#EDE6B4` | `#D3CB8A` | `#ABA263` | `#6A6438` |
| Senf | `#E6C233` | `#C29A1F` | `#947114` | `#55400C` |
| Kartoffel, Spätzle | `#F0DC9A` | `#D9BC6A` | `#B2924A` | `#6B5628` |
| Soße, Pilz | `#B79068` | `#8F6A48` | `#674A32` | `#3A291C` |
| Grün | `#8FBF5A` | `#5F9A3D` | `#3F722C` | `#234219` |
| Kohl (frisch) | `#BFE08A` | `#93C462` | `#6A9A45` | `#3D5E28` |
| Holz | `#B98A57` | `#94683C` | `#6E4A2A` | `#3E2816` |
| Teller | `#F2EEE4` | `#D6D0C2` | `#AFA899` | `#6E685C` |
| Metall | `#C9CDD2` | `#9499A0` | `#666B73` | `#3A3E44` |
| Glas | `#E4F1F2` | `#B9D4D8` | `#8AAEB4` | `#4F6B70` |
| Stein | `#A9A9A9` | `#858585` | `#636363` | `#3A3A3A` |

### 5.3 Wiederkehrende Bausteine

- **Schüssel:** Holzschüssel von schräg oben. Schüsselkörper in den Zeilen y 9 bis 14, Breite x 2 bis 13, unten abgerundet (unterste Zeile x 5 bis 10). Rand als Ellipse in y 7 bis 9. Der Inhalt liegt in der Ellipse und ragt bis höchstens y 3 nach oben.
- **Teller:** Flache helle Ellipse, y 9 bis 13, x 1 bis 14, mit 1 Pixel dunklerem Rand unten. Speisen liegen darauf und ragen bis höchstens y 3.
- **Glas (Senf):** Körper x 5 bis 10, y 5 bis 14, Deckel x 5 bis 10, y 3 bis 4 in Metallfarben.

### 5.4 Ablauf bei Texturen

1. Lege zuerst klar erkennbare Platzhalter an (einfarbiges Symbol mit Anfangsbuchstaben reicht), damit das Spiel ohne fehlende Texturen startet.
2. Erstelle die richtigen Texturen per Skript Pixel für Pixel nach diesem Leitfaden und den Beschreibungen in den Abschnitten 6, 7, 9 und 10. Bewahre die Skripte im Ordner `tools/texturen/` auf, damit Änderungen nachvollziehbar sind.
3. Zeig mir jede Textur als 16-fach vergrößertes Bild und zusätzlich in Originalgröße auf dunklem und hellem Hintergrund.
4. Ich nehme jede Textur einzeln ab oder nenne Änderungen. Erst danach kommt die nächste.
5. Führe `TEXTUREN.md` mit dem Stand jeder Textur: Platzhalter, Entwurf, abgenommen.
6. Wenn eine Textur nach drei Versuchen nicht überzeugt, markiere sie in `TEXTUREN.md` als „von Hand nachbessern". Ich überarbeite sie dann selbst in einem Pixel-Editor.

---

## 6. Items: Zutaten und Zwischenprodukte

Hungerwerte in halben Keulen (2 = eine ganze Keule). „Sättigung" ist der Sättigungsfaktor wie in Minecraft üblich. Wenn nichts anderes steht: Stapelgröße 64, Esszeit normal (32 Ticks), Standard-Essgeräusch.

| ID | Deutsch | Englisch | Essbar | Stapel |
|---|---|---|---|---|
| `mustard_seeds` | Senfkörner | Mustard Seeds | nein, pflanzbar | 64 |
| `mustard` | Senf | Mustard | nein | 16 |
| `sauerkraut` | Sauerkraut | Sauerkraut | 3 Hunger, 0,4 | 64 |
| `raw_pretzel` | Rohe Breze | Raw Pretzel | nein | 64 |
| `raw_bratwurst` | Rohe Bratwurst | Raw Bratwurst | 2 Hunger, 0,3; 30 % Chance auf 30 s Hunger-Effekt | 64 |
| `raw_schnitzel` | Rohes Schnitzel | Raw Schnitzel | nein | 64 |
| `raw_leberkaese` | Roher Leberkäse | Raw Leberkäse | nein | 64 |
| `leberkaese_loaf` | Leberkäse-Laib | Leberkäse Loaf | nein | 64 |
| `raw_apple_strudel` | Roher Apfelstrudel | Raw Apple Strudel | nein | 64 |
| `apple_strudel` | Apfelstrudel | Apple Strudel | nein | 64 |

**Besonderheiten:**
- `mustard`: Bleibt in Werkbank-Rezepten eine leere Glasflasche zurück.
- `leberkaese_loaf` und `apple_strudel`: Tooltip „Mit einem Messer auf dem Schneidebrett schneiden".

**Texturen:**
- `mustard_seeds`: Sieben runde Körner, je 2×2 Pixel, als lockeres Häufchen in der Bildmitte (x 4 bis 11, y 6 bis 12). Senf-Palette, zwei Körner eine Stufe dunkler.
- `mustard`: Glas nach Baustein 5.3. Inhalt in Senf-Palette bis y 6, darüber 1 Pixel Glasfarbe. Ein Glanzlicht-Pixel links oben am Glas.
- `sauerkraut`: Lockerer Haufen, Umriss wie ein flacher Hügel (x 2 bis 13, y 6 bis 13). Innen kurze, leicht gebogene Streifen von 3 bis 4 Pixeln Länge in den drei Sauerkraut-Tönen, in wechselnder Richtung.
- `raw_pretzel`: Brezenform wie bei `pretzel` (siehe Abschnitt 7), aber in der Teig-Palette und ohne Salz.
- `raw_bratwurst`: Zwei Würste, leicht gebogen, diagonal von links unten nach rechts oben, je 3 Pixel dick und 11 Pixel lang, parallel mit 1 Pixel Abstand. Palette rohes Fleisch, Enden abgerundet mit je 1 dunkleren Pixel.
- `raw_schnitzel`: Flaches, unregelmäßig ovales Stück (x 2 bis 13, y 4 bis 12) in den zwei hellsten Panade-Tönen mit einzelnen Teig-Pixeln als Brösel. Kein Glanz.
- `raw_leberkaese`: Kastenform von schräg vorn: Oberseite als Parallelogramm (y 4 bis 7), Vorderseite als Rechteck (y 7 bis 12), x 2 bis 13. Alles in der Palette rohes Fleisch, Oberseite hell, Vorderseite mittel.
- `leberkaese_loaf`: Gleiche Form wie roh. Oberseite in gebratenem Fleischton mit dunkler Kruste und zwei Glanzpixeln, Vorderseite in hellem rohem Fleischton, untere Kante dunkler.
- `raw_apple_strudel`: Längliche Rolle, diagonal von links unten nach rechts oben, 5 Pixel dick, Teig-Palette hell, drei kurze Querfalten.
- `apple_strudel`: Gleiche Form, Teig-Palette mittel bis dunkel, Querfalten dunkler, darauf sechs einzelne weiße Pixel als Puderzucker.

---

## 7. Items: Gerichte

| ID | Deutsch | Englisch | Hunger | Sättigung | Effekt | Stapel | Schüssel |
|---|---|---|---|---|---|---|---|
| `pretzel` | Breze | Pretzel | 5 | 0,6 | keiner | 64 | nein |
| `bratwurst` | Bratwurst | Bratwurst | 5 | 0,8 | keiner | 64 | nein |
| `bratwurst_with_sauerkraut` | Bratwurst mit Sauerkraut | Bratwurst with Sauerkraut | 12 | 0,8 | Nahrhaft 3 min | 16 | ja |
| `bread_dumpling` | Semmelknödel | Bread Dumpling | 6 | 0,6 | keiner | 64 | nein |
| `dumplings_with_mushroom_sauce` | Knödel mit Pilzsoße | Dumplings with Mushroom Sauce | 11 | 0,8 | Nahrhaft 3 min | 16 | ja |
| `schnitzel` | Schnitzel | Schnitzel | 10 | 0,8 | keiner | 64 | nein |
| `schnitzel_with_potato_salad` | Schnitzel mit Kartoffelsalat | Schnitzel with Potato Salad | 14 | 0,8 | Nahrhaft 5 min | 16 | ja |
| `cheese_spaetzle` | Käsespätzle | Cheese Spätzle | 12 | 0,8 | Nahrhaft 5 min | 16 | ja |
| `leberkaese_slice` | Leberkäse-Scheibe | Leberkäse Slice | 4 | 0,6 | keiner | 64 | nein |
| `leberkaese_roll` | Leberkässemmel | Leberkäse Roll | 9 | 0,7 | keiner | 64 | nein |
| `potato_salad` | Kartoffelsalat | Potato Salad | 8 | 0,7 | keiner | 16 | ja |
| `apple_strudel_slice` | Apfelstrudel-Stück | Apple Strudel Slice | 3 | 0,5 | Schnelligkeit I, 30 s | 64 | nein |

**Regeln:**
- „Schüssel: ja" heißt: Nach dem Essen bleibt eine leere Schüssel im Inventar. Ist das Inventar voll, fällt sie vor dem Spieler zu Boden. Nutze dafür die Item-Klasse von Farmer's Delight.
- Effekte treten immer ein (Wahrscheinlichkeit 100 %).
- Gerichte mit Effekt zeigen den Effekt im Tooltip, in derselben Darstellung wie Farmer's Delight.
- `apple_strudel_slice` und `leberkaese_slice` werden schnell gegessen (16 Ticks), wie Kuchenstücke in Farmer's Delight. Prüfe, wie Farmer's Delight das umsetzt.
- Vergleichswerte zur Einordnung: Vanilla-Steak hat 8 Hunger und 0,8, Vanilla-Brot 5 und 0,6. Kein Gericht übersteigt 14 Hunger und 5 Minuten Nahrhaft.

**Texturen:**
- `pretzel`: Brezenform, Gesamtgröße x 1 bis 14, y 2 bis 13. Dicker Bogen unten (3 Pixel stark), zwei dünnere Arme (2 Pixel stark), die sich oben in der Mitte kreuzen und links und rechts auf dem Bogen enden. Drei Löcher bleiben transparent: zwei große oben links und oben rechts, ein kleines unten in der Mitte. Laugengebäck-Palette, auf der Oberseite ein heller Glanzstreifen aus 3 Pixeln. Vier weiße Salzpixel auf dem unteren Bogen.
- `bratwurst`: Wie `raw_bratwurst`, aber in gebratener Fleisch-Palette, jede Wurst mit drei dunklen schrägen Grillstreifen und einem Glanzpixel.
- `bratwurst_with_sauerkraut`: Teller nach 5.3. Links hinten ein Sauerkraut-Haufen (x 2 bis 7, y 4 bis 9), rechts vorn zwei Bratwürste quer (x 6 bis 13, y 6 bis 10), vorn links ein Senfklecks aus 2×2 Pixeln.
- `bread_dumpling`: Runde Kugel, Durchmesser 10 Pixel, Mitte bei x 8, y 8. Kartoffel-Palette, leicht unregelmäßiger Rand, vier einzelne grüne Pixel und zwei Teig-Pixel als Kräuter und Brotstücke.
- `dumplings_with_mushroom_sauce`: Schüssel nach 5.3. Inhalt: Soße in Soßen-Palette, darin zwei Knödel (je 5 Pixel Durchmesser, Kartoffel-Palette), die halb herausragen, dazu zwei kleine Pilzscheiben in dunklerem Soßenton und zwei grüne Pixel.
- `schnitzel`: Großes flaches Stück mit welligem Rand (x 1 bis 14, y 3 bis 12), Panade-Palette mit dunkleren Flecken. Rechts unten liegt eine halbe Zitronenscheibe (4×3 Pixel, hellgelb mit weißem Rand).
- `schnitzel_with_potato_salad`: Teller nach 5.3. Links ein kleineres Schnitzel (x 1 bis 8, y 4 bis 10), rechts ein Haufen Kartoffelsalat (x 8 bis 13, y 5 bis 10) in Kartoffel-Palette mit zwei grünen Pixeln.
- `cheese_spaetzle`: Schüssel nach 5.3. Inhalt: Haufen kurzer, unregelmäßiger Nudelstücke (je 2 bis 3 Pixel) in Kartoffel-Palette, etwas heller als die Schüssel, oben fünf dunkelbraune Pixel als Röstzwiebeln und zwei grüne Pixel.
- `leberkaese_slice`: Dicke Scheibe von schräg vorn: Schnittfläche als Rechteck mit abgerundeten oberen Ecken (x 3 bis 12, y 4 bis 12) in hellem rohem Fleischton, oberer Rand 1 Pixel in dunkler Krustenfarbe, rechts 2 Pixel Seitenfläche dunkler.
- `leberkaese_roll`: Semmel von der Seite. Obere Hälfte (y 3 bis 7) und untere Hälfte (y 10 bis 13) in Teig-Palette, obere Hälfte gewölbt mit einem Glanzpixel. Dazwischen eine Leberkäse-Scheibe (y 8 bis 9), die links und rechts je 1 Pixel übersteht, darüber eine dünne Senflinie aus 4 Pixeln.
- `potato_salad`: Schüssel nach 5.3. Inhalt: überlappende ovale Scheiben (je 3×2 Pixel) in Kartoffel-Palette, vier grüne Pixel, zwei weiße Pixel als Zwiebel.
- `apple_strudel_slice`: Schräg geschnittenes Stück (x 3 bis 12, y 4 bis 12). Außen Teig-Palette mittel, Schnittfläche zeigt eine Spirale aus hellem Teig und Apfelfüllung in Kartoffel-Palette, oben drei weiße Puderzucker-Pixel.

---

## 8. Rezepte

**Allgemeine Regeln:**
- Verwende für Zutaten wo möglich die allgemeinen Tags (Namensraum `c:`), damit andere Mods kompatibel sind. Welche Tags Farmer's Delight für Kohl, Zwiebel, Teig, Milch, rohe Nudeln, Rinderhack, Speck und Messer verwendet, prüfst du im Quellcode.
- Jedes Rezept bekommt einen Rezeptbuch-Fortschritt, sodass es im Rezeptbuch freigeschaltet wird, sobald der Spieler eine der Zutaten besitzt.
- Rezept-IDs folgen dem Muster `brotzeitdelight:<art>/<ergebnis>`, z. B. `brotzeitdelight:cooking/mustard`.
- Kein Rezept darf Gegenstände vervielfältigen. Prüfe jedes Rezept darauf, was zurückbleibt.

### 8.1 Werkbank (formlos)

| Ergebnis | Zutaten | Bleibt zurück |
|---|---|---|
| 1 Rohe Breze | 1 Weizenteig | nichts |
| 2 Rohe Bratwurst | 1 Rinderhack, 1 Speck | nichts |
| 1 Rohes Schnitzel | 1 rohes Schweinekotelett, 1 Ei, 1 Brot | nichts |
| 1 Roher Leberkäse | 1 Rinderhack, 1 Speck, 1 Zwiebel, 1 Ei | nichts |
| 1 Roher Apfelstrudel | 1 Weizenteig, 2 Äpfel, 1 Zucker | nichts |
| 1 Leberkässemmel | 1 Brot, 1 Leberkäse-Scheibe, 1 Senf | 1 Glasflasche |
| 1 Kartoffelsalat | 2 Ofenkartoffeln, 1 Zwiebel, 1 Senf, 1 Schüssel | 1 Glasflasche |
| 1 Bratwurst mit Sauerkraut | 2 Bratwürste, 1 Sauerkraut, 1 Senf, 1 Schüssel | 1 Glasflasche |
| 1 Schnitzel mit Kartoffelsalat | 1 Schnitzel, 1 Kartoffelsalat | nichts |

**Achtung beim letzten Rezept:** Die Schüssel des Kartoffelsalats geht in das neue Gericht über. Es darf keine zweite Schüssel zurückbleiben. Stelle das sicher und teste es ausdrücklich.

### 8.2 Ofen, Räucherofen, Lagerfeuer

Jedes dieser Rezepte gibt es in allen drei Varianten. Zeiten: Ofen 200 Ticks, Räucherofen 100 Ticks, Lagerfeuer 600 Ticks. Erfahrung jeweils 0,35.

| Zutat | Ergebnis |
|---|---|
| Rohe Breze | Breze |
| Rohe Bratwurst | Bratwurst |
| Rohes Schnitzel | Schnitzel |
| Roher Leberkäse | Leberkäse-Laib |
| Roher Apfelstrudel | Apfelstrudel |

Durch die Lagerfeuer-Rezepte funktionieren diese Zutaten auch in der Pfanne und auf dem Herd von Farmer's Delight. Teste das.

### 8.3 Kochtopf

| Ergebnis | Zutaten | Behälter | Zeit | Erfahrung | Rezeptbuch-Reiter |
|---|---|---|---|---|---|
| 1 Senf | 2 Senfkörner, 1 Zucker | Glasflasche | 200 | 0,35 | misc |
| 2 Semmelknödel | 1 Brot, 1 Ei, 1 Milch, 1 Zwiebel | keiner | 200 | 1,0 | meals |
| 1 Knödel mit Pilzsoße | 1 Semmelknödel, 2 braune Pilze, 1 Milch, 1 Zwiebel | Schüssel | 200 | 1,0 | meals |
| 1 Käsespätzle | 1 rohe Nudeln, 2 Milch, 1 Zwiebel | Schüssel | 200 | 1,0 | meals |

„Milch" ist das Milch-Tag von Farmer's Delight (Milcheimer oder Milchflasche). Prüfe, dass Eimer und Flaschen dabei korrekt zurückbleiben.

### 8.4 Schneidebrett (mit Messer)

| Zutat | Ergebnis |
|---|---|
| Leberkäse-Laib | 4 Leberkäse-Scheiben |
| Apfelstrudel | 4 Apfelstrudel-Stücke |

### 8.5 Gärfass (eigener Rezepttyp, siehe Abschnitt 10)

| Zutat | Ergebnis |
|---|---|
| 1 Kohl | 2 Sauerkraut |
| 1 Kohlblatt | 1 Sauerkraut |

### 8.6 Werkbank (geformt): Gärfass

```
S S S      S = beliebige Holzstufe
B   B      B = beliebige Bretter
B E B      E = Eisenbarren
```

Ergibt 1 Gärfass.

---

## 9. Senfpflanze und Wilder Senf

### 9.1 Senfpflanze (angebaut)

- **Block-ID:** `mustard_crop`. Kein eigenes Item; gepflanzt wird mit `mustard_seeds`.
- **Pflanzen:** Rechtsklick mit Senfkörnern auf Ackerboden, wie Weizensamen.
- **Wachstum:** Alter 0 bis 7, gleiche Regeln und Geschwindigkeit wie Weizen (Licht, Bewässerung, Knochenmehl).
- **Aussehen:** Vier Texturen im Kreuzmodell (wie Vanilla-Feldfrüchte), verteilt auf die Altersstufen:

| Alter | Textur | Beschreibung |
|---|---|---|
| 0 bis 1 | `mustard_stage0` | Drei kurze Keimlinge, je 2 bis 3 Pixel hoch, am unteren Bildrand, Grün hell |
| 2 bis 3 | `mustard_stage1` | Vier schlanke Stängel bis y 9, je mit zwei kleinen Blättern |
| 4 bis 6 | `mustard_stage2` | Stängel bis y 4, mehr Blätter, an den Spitzen je 1 hellgrüner Knospen-Pixel |
| 7 | `mustard_stage3` | Stängel bis y 1, an den oberen Enden Büschel aus Senfgelb (je 2 bis 3 Pixel), insgesamt mindestens zwölf gelbe Pixel |

- **Trefferfläche:** wächst mit, wie bei Weizen.
- **Ernte:** Alter 7 ergibt 2 bis 4 Senfkörner, mit Glück-Verzauberung mehr (gleiche Formel wie Weizensamen). Jüngere Pflanzen ergeben 1 Senfkorn.
- **Zertrampeln, Wasser, Kolben:** verhält sich wie Weizen.
- **Bienen:** dürfen die Pflanze bestäuben wie andere Feldfrüchte, falls das über ein Tag ohne Zusatzcode geht.

### 9.2 Wilder Senf

- **Block-ID und Item-ID:** `wild_mustard`. Deutsch „Wilder Senf", Englisch „Wild Mustard".
- **Aussehen:** Kreuzmodell, eine Textur: wie Stufe 3 der Senfpflanze, aber buschiger und etwas niedriger (bis y 3), mit zwei Grashalmen am Boden. Die Item-Textur ist dieselbe.
- **Vorkommen:** In kleinen Gruppen in Ebenen, Sonnenblumenebenen und Wiesen (`minecraft:plains`, `minecraft:sunflower_plains`, `minecraft:meadow`), auf Grasblöcken unter freiem Himmel.
- **Häufigkeit:** Gleiche Größenordnung wie die Wildpflanzen von Farmer's Delight. Lies deren Werte aus dem Quellcode und übernimm die Zahlen für Wildkohl als Richtwert.
- **Umsetzung:** Welterzeugung per Datendateien und NeoForge-Biome-Modifier, nach dem Vorbild der Wildpflanzen in Farmer's Delight. So können Modpack-Ersteller sie per Datenpaket anpassen.
- **Abbauen:** Ergibt 1 bis 2 Senfkörner. Mit Schere oder Behutsamkeit erhält man den Block selbst.
- **Platzieren:** Nur auf Erde-artigen Blöcken, wie Blumen. Kein Blumentopf.
- **Sonstiges:** Sofort abbaubar, Pflanzengeräusch, brennbar wie Gras, Knochenmehl hat keine Wirkung.

---

## 10. Gärfass

Das Gärfass ist die Besonderheit des Mods und muss sich besonders gut anfühlen. Es hat bewusst kein Menü. Alles läuft über Rechtsklick.

### 10.1 Blockeigenschaften

- **ID:** `fermenting_barrel`. Deutsch „Gärfass", Englisch „Fermenting Barrel".
- **Härte und Widerstand:** wie das Vanilla-Fass. Mit Axt am schnellsten abbaubar, lässt sich immer als Item fallen.
- **Geräusche:** Holz.
- **Form:** voller Block für Kollision und Auswahl.
- **Nicht brennbar, nicht von Kolben verschiebbar, nicht wasserflutbar, keine Drehung.**
- **Kartenfarbe:** Holz.

### 10.2 Zustände

Blockzustand `stage` mit vier Werten und `fill` mit den Werten 1 bis 3 für die sichtbare Füllhöhe.

| `stage` | Bedeutung | Aussehen |
|---|---|---|
| `empty` | leer | Oben offen, Innenraum sichtbar und dunkel |
| `filled` | Zutaten drin, offen | Oben offen, darin frischer Kohl; Höhe je nach `fill` |
| `fermenting` | verschlossen, gärt | Holzdeckel leicht vertieft, darauf ein flacher Stein |
| `ready` | fertig | Oben offen, darin Sauerkraut; Höhe je nach `fill` |

`fill`: 1 bei 1 bis 2 Zutaten, 2 bei 3 bis 5, 3 bei 6 bis 8. Bei `ready` bleibt der Wert von vorher.

### 10.3 Modell und Texturen

- **Modell:** Eigenes Blockmodell. Außenwände 2 Pixel dick, Boden 2 Pixel dick, Innenraum offen von y 2 bis 16 (in Modellkoordinaten). Inhalt als flache Ebene im Innenraum: Höhe 6 bei `fill` 1, 10 bei `fill` 2, 14 bei `fill` 3. Deckel bei `fermenting`: Platte in Höhe 14 bis 15 innerhalb der Wände, Stein darauf als kleiner Quader 6×2×6 mittig.
- **Texturen:**
  - `fermenting_barrel_side`: Senkrechte Holzdauben, je 3 bis 4 Pixel breit, durch 1 Pixel dunkle Fugen getrennt. Zwei waagerechte Metallreifen, je 2 Pixel hoch, bei y 3 bis 4 und y 11 bis 12, mit je einem Niet-Pixel pro Daube. Holz- und Metall-Palette.
  - `fermenting_barrel_top`: Ring aus Holz, 2 Pixel breit, außen mit 1 Pixel Metallrand. Innen transparent (wird vom Modell nicht gezeichnet).
  - `fermenting_barrel_bottom`: Runde Bodenplatte aus Brettern, dunkler als die Seiten.
  - `fermenting_barrel_inside`: Dunkles Holz für Innenwände und Boden.
  - `fermenting_barrel_lid`: Bretter quer mit einer Querleiste.
  - `fermenting_barrel_stone`: Stein-Palette mit zwei helleren Pixeln.
  - `fermenting_barrel_cabbage`: Dicht gepackte Kohlblätter von oben, Kohl-Palette, erkennbare Blattadern.
  - `fermenting_barrel_sauerkraut`: Feine Streifen wie beim Sauerkraut-Item, mit zwei dunkleren Pixeln als Wacholderbeeren.
- **Item-Darstellung:** Das Fass im Zustand `empty`, in der üblichen Blockansicht.

### 10.4 Bedienung

Alle Aktionen laufen auf dem Server. Im Kreativmodus werden keine Gegenstände verbraucht. Im Abenteuermodus ist die Bedienung erlaubt. Jede erfolgreiche Aktion lässt den Arm des Spielers schwingen.

| Zustand | Aktion | Ergebnis | Geräusch |
|---|---|---|---|
| `empty` oder `filled`, nicht voll | Rechtsklick mit Kohl oder Kohlblatt | 1 Stück wird eingelegt | Komposter füllen |
| `empty` oder `filled`, nicht voll | Schleichen und Rechtsklick mit Kohl oder Kohlblatt | So viele wie möglich aus dem Stapel werden eingelegt | Komposter füllen |
| `filled`, voll | Rechtsklick mit Kohl oder Kohlblatt | Nichts wird eingelegt, Meldung „Das Gärfass ist voll." | keins |
| `filled` | Rechtsklick mit leerer Hand | Fass wird verschlossen, Gärung startet | Fass schließen |
| `filled` | Schleichen und Rechtsklick mit leerer Hand | Alle Zutaten kommen zurück, Fass wird leer | Gegenstand aufheben |
| `fermenting` | Rechtsklick (beliebig) | Meldung „Gärt … X %" | keins |
| `ready` | Rechtsklick (beliebig) | Das gesamte Sauerkraut kommt heraus, Fass wird leer | Fass öffnen |
| `empty` | Rechtsklick mit leerer Hand | Nichts | keins |
| jeder | Rechtsklick mit anderem Gegenstand | Keine Fass-Aktion; das normale Verhalten des Gegenstands greift | keins |

**Einzelheiten:**
- **Fassungsvermögen:** 8 Zutaten. Kohl und Kohlblatt dürfen gemischt werden; das Fass merkt sich, wie viele von welcher Sorte drin sind.
- **Herausgeben:** Gegenstände gehen direkt ins Inventar des Spielers. Passt etwas nicht hinein, fällt es über dem Fass zu Boden.
- **Meldungen** erscheinen in der Leiste über der Schnellzugriffsleiste, nicht im Chat.
- **Prozentangabe:** ganzzahlig, abgerundet.

### 10.5 Gärung

- **Dauer:** Standard 12.000 Ticks (10 Minuten Echtzeit), einstellbar (Abschnitt 14).
- **Ablauf:** Die Block-Entity zählt nur im Zustand `fermenting`. In allen anderen Zuständen läuft kein Tick-Code.
- **Ende:** Der Zustand wechselt zu `ready`, das Geräusch „Fass öffnen" ertönt, fünf Partikel steigen auf. Die Zutaten werden dabei nach den Gär-Rezepten in Ergebnisse umgerechnet (8 Kohl ergeben 16 Sauerkraut).
- **Während der Gärung:** Im Schnitt alle 3 bis 5 Sekunden steigen ein bis zwei kleine Blasen-Partikel am Rand des Deckels auf. Dazu selten (im Schnitt alle 15 bis 20 Sekunden) ein leises Blubbern (Vanilla-Blasengeräusch, Lautstärke 0,3). Wähle einen Partikeltyp, der auch außerhalb von Wasser sichtbar ist, und prüfe ihn im Spiel.
- **Chunk nicht geladen:** Die Gärung pausiert. Das ist gewollt.

### 10.6 Speicherung, Abbau, Technik

- **Speicherung:** Inhalt (Sorten und Mengen), Zustand und Fortschritt werden gespeichert und überstehen Neuladen der Welt und Server-Neustart.
- **Abbauen und Explosionen:** Das Fass lässt sich selbst und seinen Inhalt fallen: Zutaten bei `filled` und `fermenting`, Sauerkraut bei `ready`. Im Kreativmodus fällt nur der Inhalt.
- **Block auswählen (Mausrad-Klick):** gibt ein leeres Gärfass.
- **Komparator:** 0 bei `empty`, 1 bis 8 nach Füllmenge bei `filled` und `fermenting`, 15 bei `ready`.
- **Rezepttyp:** `brotzeitdelight:fermenting` mit den Feldern `ingredient`, `result` (Item und Anzahl). Per Datenpaket erweiterbar. Der Rechtsklick akzeptiert jede Zutat, für die es ein Gär-Rezept gibt, nicht nur Kohl.
- **Mischregel:** In einem Fass dürfen nur Zutaten liegen, deren Rezepte dasselbe Ergebnis-Item haben.
- **Mehrspieler:** Alle Spieler sehen denselben Zustand. Die Darstellung hängt nur am Blockzustand, sodass keine eigene Netzwerk-Synchronisation nötig ist.
- **Trichter und Rohre:** werden nicht unterstützt. Das Fass bietet keine Inventar-Schnittstelle an.
- **Tooltip des Items:** zwei Zeilen: „Rechtsklick mit Kohl: befüllen" und „Rechtsklick mit leerer Hand: verschließen".

---

## 11. Fortschritte

Hänge die Fortschritte an den Baum von Farmer's Delight, falls das sauber geht. Sonst an den Vanilla-Reiter „Landwirtschaft".

| ID | Titel (de) | Titel (en) | Beschreibung (de) | Beschreibung (en) | Auslöser | Symbol |
|---|---|---|---|---|---|---|
| `get_mustard_seeds` | Scharfe Sache | Spicy Business | Sammle Senfkörner | Collect Mustard Seeds | Senfkörner im Inventar | Senfkörner |
| `get_sauerkraut` | Gut Ding will Weile haben | Good Things Take Time | Hol Sauerkraut aus einem Gärfass | Take Sauerkraut out of a Fermenting Barrel | Sauerkraut im Inventar | Gärfass |
| `get_pretzel` | Frisch aus dem Ofen | Fresh from the Oven | Backe eine Breze | Bake a Pretzel | Breze im Inventar | Breze |
| `eat_everything` | Brotzeit! | Brotzeit! | Iss jedes Gericht aus Brotzeit Delight | Eat every dish from Brotzeit Delight | Alle 12 Gerichte aus Abschnitt 7 gegessen | Leberkässemmel |

Der letzte Fortschritt ist eine Herausforderung (eigener Rahmen) und gibt 50 Erfahrungspunkte.

---

## 12. Tags, Kompost, Tierfutter

- **Tags:** Vergib allgemeine Tags nach dem Vorbild von Farmer's Delight, mindestens: Senfkörner als Samen, Senfpflanze als Feldfrucht, Bratwurst, Schnitzel und Leberkäse-Scheibe als gekochtes Fleisch, rohe Bratwurst als rohes Fleisch, Breze als Brot-artiges. Lege zusätzlich ein eigenes Tag `brotzeitdelight:fermentable` an, das automatisch alle Zutaten der Gär-Rezepte beschreibt, falls das für andere Mods nützlich ist; sonst weglassen.
- **Block-Tags:** Gärfass in „mit Axt abbaubar", Senfpflanze in die Feldfrucht-Tags, Wilder Senf dort, wo Farmer's Delight seine Wildpflanzen einträgt.
- **Kompost-Wahrscheinlichkeiten:**

| Item | Chance |
|---|---|
| Senfkörner | 30 % |
| Wilder Senf | 65 % |
| Sauerkraut | 65 % |
| Rohe Breze | 65 % |
| Breze, Semmelknödel, Apfelstrudel-Stück | 85 % |
| Apfelstrudel | 100 % |

- **Wolfsfutter:** Rohe Bratwurst, Bratwurst, Schnitzel und Leberkäse-Scheibe in das Wolfsfutter-Tag.

---

## 13. Texte und Übersetzungen

- Beide Sprachdateien enthalten jeden Schlüssel. Ein Test prüft, dass keine Sprache einen Schlüssel hat, der in der anderen fehlt.
- Deutsche Texte in Du-Form, kurze Sätze, ß und Umlaute korrekt.
- Namen der Items und Blöcke: siehe Tabellen in den Abschnitten 6, 7, 9 und 10.

| Zweck | Deutsch | Englisch |
|---|---|---|
| Kreativ-Tab | Brotzeit Delight | Brotzeit Delight |
| Meldung: Fass voll | Das Gärfass ist voll. | The Fermenting Barrel is full. |
| Meldung: Fortschritt | Gärt … %s % | Fermenting … %s% |
| Tooltip Gärfass 1 | Rechtsklick mit Kohl: befüllen | Right-click with Cabbage: fill |
| Tooltip Gärfass 2 | Rechtsklick mit leerer Hand: verschließen | Right-click with empty hand: seal |
| Tooltip Laib, Strudel | Mit einem Messer auf dem Schneidebrett schneiden | Slice with a Knife on a Cutting Board |
| Konfiguration: Gärdauer | Gärdauer in Ticks | Fermentation time in ticks |
| Untertitel: Blubbern | Gärfass blubbert | Fermenting Barrel bubbles |
| Untertitel: Fass fertig | Gärfass öffnet sich | Fermenting Barrel opens |

Geräusche, die das Gärfass abspielt, bekommen Untertitel für die Barrierefreiheits-Einstellung von Minecraft. Lege dafür eigene Geräusch-Ereignisse an, die auf die vorhandenen Vanilla-Klangdateien verweisen.

---

## 14. Konfiguration

Eine Server-Konfiguration mit einem Wert:

| Schlüssel | Standard | Erlaubt | Bedeutung |
|---|---|---|---|
| `fermentationTicks` | 12000 | 200 bis 240000 | Dauer der Gärung in Ticks |

Die Häufigkeit des Wilden Senfs wird nicht über die Konfiguration gesteuert, sondern über Datendateien (Abschnitt 9.2).

---

## 15. Qualitätsregeln für Code und Daten

**Code:**
- Kein Code aus anderen Mods kopieren. Öffentliche Klassen von Farmer's Delight und NeoForge verwenden ist erwünscht.
- Client-Code strikt getrennt: Der Mod muss auf einem reinen Server ohne Client-Klassen starten.
- Keine toten Code-Reste, keine auskommentierten Blöcke, keine offenen `TODO`-Kommentare in der Veröffentlichung.
- Feste Zahlen (Fassungsvermögen, Zeiten) als benannte Konstanten oder aus der Konfiguration.
- Keine veränderlichen statischen Zustände. Keine Arbeit im Tick, wenn sie nicht nötig ist.
- Einheitliche Benennung: Klassen auf Englisch, Kommentare auf Deutsch, IDs in Kleinschreibung mit Unterstrichen.
- Keine eigenen Mixins. Wenn etwas ohne Mixin nicht geht, frag mich vorher.
- Bei jeder Stelle, die du von Farmer's Delight abschaust, kurz kommentieren, worauf sie sich bezieht.

**Daten:**
- Alles Erzeugbare kommt aus dem Datengenerator. Der Generator läuft ohne Fehler und ohne Warnungen.
- Jedes Item hat: Modell, Textur, beide Übersetzungen, mindestens ein Rezept oder eine andere Quelle im Überlebensmodus, einen Platz im Kreativ-Tab.
- Jeder Block hat zusätzlich: Blockzustand, Beutetabelle, passende Tags für Werkzeug.

**Log:**
- Beim Start von Client und Server und beim Laden einer Welt erscheint keine Fehler- oder Warnzeile, die `brotzeitdelight` nennt.

**Selbstprüfung nach jedem Meilenstein:**
1. Baue das Projekt neu und starte Client und Server.
2. Lies das Log vollständig nach `brotzeitdelight`, `ERROR` und `WARN` durch.
3. Geh deine Änderungen einmal kritisch durch, als würdest du fremden Code prüfen, und behebe, was du findest.
4. Aktualisiere `CHANGELOG.md` und `TEXTUREN.md`.
5. Lege einen Git-Commit an.

---

## 16. Tests

### 16.1 Automatische Tests

Nutze das Spieltest-System von Minecraft (GameTests), wo es mit vertretbarem Aufwand geht:
- Gärfass: Befüllen, Verschließen, Ablauf der Gärung (mit verkürzter Dauer), Entnahme, Komparator-Werte, Abbau mit Inhalt, Speichern und Laden der Block-Entity.
- Senfpflanze: wächst mit Knochenmehl bis Alter 7 und gibt Senfkörner.
- Rezepte: Jedes Rezept aus Abschnitt 8 ist geladen und ergibt das richtige Ergebnis in richtiger Anzahl.
- Sprachdateien: gleiche Schlüsselmenge in beiden Sprachen.
- Gerichte: Jedes Gericht hat die Hunger- und Sättigungswerte aus Abschnitt 7.

Wenn ein Test nur mit sehr viel Aufwand möglich wäre, sag es mir und nimm ihn in das Handprotokoll auf.

### 16.2 Handprotokoll für mich

Erstelle `TESTPROTOKOLL.md` mit Kästchen zum Abhaken. Es muss jeden einzelnen Punkt enthalten, den ich im Überlebensmodus prüfen soll, in einer Reihenfolge, die man in einer Sitzung durchspielen kann:
- jedes Rezept einmal herstellen,
- jedes Gericht einmal essen und Werte, Effekt und Schüssel-Rückgabe prüfen,
- Senf pflanzen, wachsen lassen, ernten; Wilden Senf in einer neuen Welt suchen (mit Angabe eines Befehls zum Finden des Bioms),
- jede Zeile der Bedientabelle des Gärfasses,
- Welt verlassen und neu laden, während ein Fass gärt,
- Fass in jedem Zustand abbauen,
- Sprache auf Englisch stellen und alle Namen ansehen.

### 16.3 Verträglichkeit

Starte das Spiel je einmal zusätzlich mit diesen Mods und prüfe, dass nichts abstürzt und die Rezepte angezeigt werden: JEI, EMI, Jade. Wenn das Gärfass in JEI oder EMI nicht erscheint, ist das für Version 0.1.0 in Ordnung, es darf aber keinen Fehler geben.

### 16.4 Mehrspieler

Starte einen eigenen Server und verbinde dich. Prüfe Gärfass, Pflanze und Essen dort erneut. Wenn möglich, mit zwei Spielern gleichzeitig am selben Fass.

---

## 17. Meilensteine

Arbeite streng in dieser Reihenfolge. Nach jedem Meilenstein: Selbstprüfung aus Abschnitt 15, dann stoppen und mir berichten. Erst nach meinem Okay geht es weiter.

1. **Grundgerüst:** Projekt aufsetzen, Farmer's Delight einbinden, Client und Server starten mit beiden Mods. Kreativ-Tab vorhanden. `ABWEICHUNGEN.md`, `TEXTUREN.md`, `CHANGELOG.md`, `IDEEN.md` angelegt.
2. **Faktencheck:** Liste mir die echten IDs, Tags und Klassen von Farmer's Delight auf, die du verwenden wirst, mit Fundstelle. Nenne alle Abweichungen von dieser Datei.
3. **Ein Gericht komplett:** Breze mit roher Breze, allen Rezepten, Rezeptbuch-Freischaltung, Platzhalter-Textur, beiden Sprachen, Kompost-Wert, Test. Das ist die Vorlage für alles Weitere.
4. **Alle Zutaten und Gerichte** aus den Abschnitten 6 und 7 mit den Rezepten aus Abschnitt 8, außer dem Gär-Rezept. Sauerkraut ist vorerst nur im Kreativ-Tab erhältlich.
5. **Senfpflanze** und **Wilder Senf** samt Welterzeugung.
6. **Gärfass** vollständig nach Abschnitt 10.
7. **Fortschritte, Tags, Tierfutter, Tooltips, Untertitel, Konfiguration.**
8. **Texturen und Modelle:** alle Platzhalter ersetzen, einzeln von mir abgenommen.
9. **Tests:** automatische Tests vollständig, Handprotokoll erstellt, Verträglichkeit und Mehrspieler geprüft.
10. **Abschluss:** Abnahmeliste aus Abschnitt 18, Veröffentlichung vorbereiten nach Abschnitt 19.

---

## 18. Abnahmeliste

Version 0.1.0 ist fertig, wenn alles davon stimmt:

- [ ] Client startet mit NeoForge 1.21.1, Farmer's Delight und Brotzeit Delight ohne Fehler oder Warnungen unseres Mods im Log.
- [ ] Ein eigener Server startet ebenso, ein Spieler kann beitreten und alle Funktionen nutzen.
- [ ] Jedes Rezept aus Abschnitt 8 funktioniert im Überlebensmodus und erscheint im Rezeptbuch.
- [ ] Kein Rezept vervielfältigt Schüsseln, Flaschen oder Eimer.
- [ ] Jedes Gericht hat die Werte aus Abschnitt 7; Effekte stehen im Tooltip.
- [ ] Senf lässt sich pflanzen, wächst, wird geerntet; Wilder Senf erscheint in neuen Welten in den genannten Biomen.
- [ ] Das Gärfass verhält sich in jeder Zeile der Bedientabelle wie beschrieben.
- [ ] Inhalt und Fortschritt des Gärfasses überstehen Speichern, Neuladen und Server-Neustart; beim Abbauen geht nichts verloren.
- [ ] Alle automatischen Tests laufen durch.
- [ ] Ich habe `TESTPROTOKOLL.md` vollständig abgehakt.
- [ ] Keine fehlenden Texturen, keine unübersetzten Namen in Deutsch und Englisch.
- [ ] Alle Texturen sind in `TEXTUREN.md` als abgenommen markiert.
- [ ] Start mit JEI, EMI und Jade ohne Absturz.
- [ ] Keine Datei im Projekt stammt aus einem anderen Mod.
- [ ] `ABWEICHUNGEN.md` ist aktuell, `IDEEN.md` enthält alles Zurückgestellte.

---

## 19. Veröffentlichung auf Modrinth

Bereite alles vor, lade aber nichts hoch. Das Hochladen mache ich selbst.

- **Mod-Datei:** `.jar` für NeoForge 1.21.1, Version 0.1.0, Dateiname `brotzeitdelight-1.21.1-0.1.0.jar`.
- **Icon:** 512×512 Pixel, die Breze aus dem Spiel stark vergrößert (ohne Glättung) auf einfarbigem warmem Hintergrund.
- **Kurzbeschreibung (ein Satz, Englisch):** Vorschlag: „German comfort food for Farmer's Delight: pretzels, bratwurst, schnitzel and a fermenting barrel for sauerkraut."
- **Beschreibung:** Englisch als Haupttext, Deutsch darunter. Inhalt: was der Mod ist, Liste der Gerichte, wie das Gärfass funktioniert, wie man Senf findet, benötigte Mods, Hinweis, dass der Mod nicht offiziell zu Farmer's Delight gehört, Hinweis für Modpacks (Nutzung erlaubt), wo man Fehler meldet.
- **Galerie:** Nenne mir fünf Screenshots, die ich im Spiel machen soll, mit genauer Beschreibung von Aufbau und Blickwinkel. Vorschlag: gedeckter Tisch mit allen Gerichten, Gärfass in allen vier Zuständen nebeneinander, Senffeld in voller Blüte, Wilder Senf in einer Wiese, Küche mit Kochtopf und Gärfass.
- **Angaben auf Modrinth:** Kategorie Essen; Client und Server benötigt; Abhängigkeit Farmer's Delight als „benötigt"; Lizenz MIT; bei den Inhaltsangaben offenlegen, dass Code und Grafiken mit KI-Hilfe erstellt wurden.
- **Im Projekt:** `LICENSE`, `README.md` (Englisch, kurz), `CHANGELOG.md`.
- **Quellcode:** Bereite das Projekt für ein öffentliches GitHub-Repository vor. Der Ordner `referenzen/` wird nicht mit veröffentlicht (in `.gitignore` eintragen), weil er Screenshots fremder Mods enthält.

---

## 20. Nicht im Umfang von Version 0.1.0

Baue nichts davon ein, auch wenn es naheliegt:
- Käse, Bier oder andere alkoholische Getränke
- Weitere Pflanzen, Tiere, Dorfbewohner-Berufe, Handel, Strukturen, Beute in Truhen
- Menüs (GUIs) für Blöcke
- Fabric-Version oder andere Minecraft-Versionen
- Trichter-Anbindung des Gärfasses
- Eigene JEI- oder EMI-Kategorie für das Gärfass
- Platzierbare Festmahl-Blöcke

Wenn dir etwas davon sinnvoll erscheint, schreib es mit kurzer Begründung in `IDEEN.md`, statt es umzusetzen.

---

## 21. Arbeitsregeln

- Frag nach, wenn eine Angabe fehlt oder zwei Angaben sich widersprechen. Rate nicht.
- Ändere keine Werte aus dieser Datei eigenmächtig. Wenn du etwas für unausgewogen oder technisch ungünstig hältst, schlag die Änderung vor und warte auf mein Okay.
- Behaupte nie, etwas funktioniere, ohne es gebaut und gestartet zu haben. Sag ausdrücklich, was du geprüft hast und was nicht.
- Wenn ein Build oder Test fehlschlägt, behebe die Ursache, bevor du weitermachst, und sag mir, was los war.
- Mach kleine Schritte: lieber fünf kleine Commits als ein großer.
- Am Ende jeder Sitzung: kurzer Stand in `STAND.md` (was fertig ist, was als Nächstes kommt, offene Fragen), damit eine neue Sitzung nahtlos weitermachen kann.
