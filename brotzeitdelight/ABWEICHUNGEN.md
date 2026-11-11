# Abweichungen von der Vorgabe

Hier steht jede Stelle, an der das Projekt von `BROTZEIT_DELIGHT_SPEC.md` abweicht,
weil technische Tatsachen aus Minecraft, NeoForge oder Farmer's Delight es verlangen
(Rangfolge in der Vorgabe: Tatsachen vor Vorgabe vor Annahmen).

| Nr. | Meilenstein | Vorgabe | Abweichung | Warum | Quelle |
|---|---|---|---|---|---|
| 1 | 1 | Abschnitt 17: Die Breze entsteht erst in Meilenstein 3. | Das Item `pretzel` ist schon in Meilenstein 1 angemeldet, aber nur als einfaches Item ohne Essenswerte und ohne Rezepte. Alles Weitere folgt wie geplant in Meilenstein 3. | Minecraft blendet einen Kreativ-Tab ohne Inhalt aus, und das Symbol des Tabs soll laut Abschnitt 2 eine Breze sein. Ohne Item wäre der Tab im Spiel nicht zu sehen und Meilenstein 1 nicht prüfbar. | Minecraft 1.21.1, Klasse `net.minecraft.world.item.CreativeModeTab`, Methode `shouldDisplay()` |
| 2 | 2 | Abschnitt 8: Zutaten wo möglich über `c:`-Tags. | Rinderhack ist das Item `farmersdelight:minced_beef`, das Schweinekotelett das Item `minecraft:porkchop`, Kohl und Kohlblatt im Gärfass sind ebenfalls einzelne Items. | `c:foods/raw_beef` enthält auch rohes Rindfleisch, `c:foods/raw_pork` auch Speck, `c:crops/cabbage` Kohl und Blatt zusammen. Mit den Tags würden Rezepte Gegenstände vervielfältigen (1 Rindfleisch ergibt auf dem Schneidebrett 2 Hack) bzw. Kohl und Blatt gleich zählen. „Wo möglich" ist hier also nicht möglich. | FD `data/ItemTags.java:296,311,313` |
| 3 | 2 | Abschnitt 8: Jedes Rezept bekommt eine Rezeptbuch-Freischaltung. | Die zwei Schneidebrett-Rezepte und die zwei Gärfass-Rezepte bekommen keine. | Das Schneidebrett hat kein Rezeptbuch, FD legt für seine Schneiderezepte auch keine Freischaltung an. Das Gärfass hat bewusst kein Menü, also auch kein Rezeptbuch. | FD `data/builder/CuttingBoardRecipeBuilder.java:89` |

## Von dir entschiedene Änderungen (11.11.2026)

Diese Punkte weichen von der Vorgabe ab, weil Tatsachen sie unklar oder widersprüchlich gemacht haben. Du hast meinen Empfehlungen zugestimmt („mach alles so wie du denkst"). Umgesetzt werden sie in dem Meilenstein, zu dem sie gehören.

| Nr. | Vorgabe | Neu | Warum | Quelle |
|---|---|---|---|---|
| 4 | Abschnitt 7: Schnitzel mit Kartoffelsalat 14 Hunger, Sättigung 0,8 | Sättigung **0,75** | Sonst stärker als das stärkste FD-Gericht (14 / 0,75), was Abschnitt 3 verbietet | FD `common/FoodValues.java:187–195` |
| 5 | Abschnitt 9.1: Senfpflanze im Kreuzmodell „wie Vanilla-Feldfrüchte" | Modell `block/crop` (Raute aus 4 Flächen) wie Vanilla-Weizen | Vanilla-Feldfrüchte haben kein Kreuzmodell | MC `models/block/wheat_stage7.json` |
| 6 | Abschnitt 9.1: Ernte 2 bis 4 Senfkörner, „gleiche Formel wie Weizensamen" | **2 bis 4** Senfkörner (2 fest plus Zufall), mit Glück mehr | Die Weizen-Formel ergibt 1 bis 4, die beiden Angaben widersprechen sich | MC `loot_table/blocks/wheat.json`, `carrots.json` |
| 7 | Abschnitt 9.2: (kein Effekt genannt) | Wilder Senf gibt in Verdächtiger Suppe **Feuerresistenz für 4 Sekunden** | Als Blume (Tag `minecraft:small_flowers`, wie FDs Wildpflanzen) braucht er einen Suppen-Effekt | FD `common/block/WildCropBlock.java:25`, MC `FlowerBlock` |
| 8 | Abschnitt 13: Tooltip „Rechtsklick mit Kohl: befüllen" | „Rechtsklick mit **Weißkohl**: befüllen" | FD nennt den Kohl auf Deutsch „Weißkohl" | FD `lang/de_de.json` |
| 9 | Abschnitt 12: Breze „als Brot-artiges" | Tag `c:foods/bread`. Folge: Die Breze geht auch in FD-Sandwiches und in unseren Rezepten mit Brot. Bewusst so gewollt. | Das ist das allgemeine Brot-Tag von NeoForge | NF `Tags.Items.FOODS_BREAD` |
