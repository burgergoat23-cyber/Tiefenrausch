# Faktencheck (Meilenstein 2)

Stand: 11.11.2026. Geprüft am Quellcode, nicht geraten.

**Quellen**
- **FD** = Farmer's Delight, Repository `vectorwing/FarmersDelight`, Branch `1.21`, Commit `dd8b9b0` (29.08.2026, Version 1.3.4). Pfade unten relativ zu `src/main/java/vectorwing/farmersdelight/`, erzeugte Daten unter `src/generated/resources/data/farmersdelight/`.
- **MC/NF** = Minecraft 1.21.1 mit NeoForge 21.1.265 (entpackter Quellcode `build/moddev/artifacts/neoforge-21.1.265-sources.jar`, Spieldaten in `…-client-extra-aka-minecraft-resources.jar`).

## 1. Versionen

| Was | Ergebnis | Fundstelle |
|---|---|---|
| Farmer's Delight für NeoForge 1.21.1 | **1.3.4** ist die neueste (Modrinth, 29.08.2026). Die Angabe in Vorgabe Abschnitt 3 stimmt. | Modrinth-API `project/farmers-delight/version` |
| NeoForge für 1.21.1 | 21.1.265 (gebaut), Mod startet ab 21.1.219 | `maven.neoforged.net` |
| In Arbeit bei FD | Branch `update-1.21/1.4` (Stand 16.09.2026): `FoodValues` wird umgebaut, neue Klasse `FoodItem`. `ConsumableItem`, Tags und Rezeptformate bleiben erhalten. Die Fortschritts-IDs sind unverändert. | FD-Branch `update-1.21/1.4` |

## 2. Item- und Block-IDs von FD, die wir benutzen

| Deutsch (FD) | ID | Fundstelle |
|---|---|---|
| Weißkohl | `farmersdelight:cabbage` | `common/registry/ModItems.java:269` |
| Weißkohlblatt | `farmersdelight:cabbage_leaf` | `ModItems.java:325` |
| Zwiebel | `farmersdelight:onion` | `ModItems.java:273` |
| Teigball (Weizenteig) | `farmersdelight:wheat_dough` | `ModItems.java:319` |
| Rohe Nudeln | `farmersdelight:raw_pasta` | `ModItems.java:321` |
| Hackfleisch | `farmersdelight:minced_beef` | `ModItems.java:327` |
| Roher Speck | `farmersdelight:bacon` | `ModItems.java:335` |
| Milchflasche | `farmersdelight:milk_bottle` | `ModItems.java:309` |
| Kochtopf, Schneidebrett, Bratpfanne, Herd | `farmersdelight:cooking_pot`, `cutting_board`, `skillet`, `stove` | `ModItems.java:60–67` |
| Wildweißkohl (Block und Item) | `farmersdelight:wild_cabbages` | `ModBlocks.java:297`, `ModItems.java:248` |
| Feldfrucht-Blöcke | `farmersdelight:cabbages`, `farmersdelight:onions` | `ModBlocks.java:313–316` |
| Effekt „Nahrhaft" (deutsch bei FD: „Gesättigt") | `farmersdelight:nourishment` | `common/registry/ModEffects.java:15` |
| Effekt „Komfort" (wird nicht benutzt) | `farmersdelight:comfort` | `ModEffects.java:16` |

## 3. Tags für die Zutaten (Vorgabe Abschnitt 8)

| Zutat laut Vorgabe | Tag oder Item, das ich verwende | Inhalt / Begründung | Fundstelle |
|---|---|---|---|
| Kohl, Kohlblatt (Gärfass) | Items `farmersdelight:cabbage` und `farmersdelight:cabbage_leaf` einzeln | Das Tag `c:crops/cabbage` enthält **beides**. Kohl gibt 2, ein Blatt 1 Sauerkraut, darum braucht jede Sorte ihr eigenes Rezept. | FD `data/ItemTags.java:296` |
| Zwiebel | `c:crops/onion` | So nutzt es FD selbst in allen Kochtopf-Rezepten | `data/recipe/CookingRecipes.java:157` |
| Weizenteig | `c:foods/dough` | So nutzt es FD (z. B. Nudeln schneiden). Enthält `c:foods/dough/wheat` = Teigball. | `CuttingRecipes.java:113`, `ItemTags.java:247,305` |
| Rohe Nudeln | `c:foods/pasta` | enthält `raw_pasta` | `ItemTags.java:307` |
| Milch | `c:drinks/milk` | Tag von **NeoForge** (Milcheimer), FD trägt die Milchflasche ein. Eimer und Flasche haben beide einen Rest (Eimer bzw. Glasflasche), den der Kochtopf auswirft. | NF `data/c/tags/item/drinks/milk.json`, FD `ItemTags.java:243`, MC `Items.java:1222`, FD `CookingPotBlockEntity.java` (`processCooking`) |
| Speck | `c:foods/raw_bacon` | enthält nur `bacon` | `ItemTags.java:310` |
| Rinderhack | **Item** `farmersdelight:minced_beef` | Das Tag `c:foods/raw_beef` enthält auch rohes Rindfleisch. Damit könnte man das Schneidebrett überspringen (1 Rindfleisch = 2 Hack). FD nimmt in eigenen Rezepten auch das Item. | `ItemTags.java:311`, `CookingRecipes.java:207` |
| Rohes Schweinekotelett | **Item** `minecraft:porkchop` | Das Tag `c:foods/raw_pork` enthält auch Speck. | `ItemTags.java:313` |
| Ei | `c:eggs` | | NF-Tag, FD `CookingRecipes.java:72` |
| Brot | `c:foods/bread` | | NF-Tag, FD `CraftingRecipes.java:765` |
| Braune Pilze | Item `minecraft:brown_mushroom` | `c:mushrooms` enthält auch rote | NF-Tag |
| Messer | Werkzeug-Aktion `knife_dig` **oder** Tag `c:tools/knife` | genau wie FD (`CuttingRecipes.KNIVES`) | `data/recipe/CuttingRecipes.java:27` |
| Holzstufe, Bretter, Eisenbarren | `minecraft:wooden_slabs`, `minecraft:planks`, `c:ingots/iron` | | MC/NF-Tags |
| Zucker, Äpfel, Ofenkartoffel, Schüssel, Glasflasche | Vanilla-Items | | – |

## 4. Rezeptformate

**Kochtopf** – Typ `farmersdelight:cooking` (`common/crafting/CookingPotRecipe.java:164–176`)
- `ingredients` (Liste, nicht leer, höchstens 6 Plätze im Topf), `result` (`{"id","count"}`), `container` (optional), `experience` (Standard 0), `cookingtime` (Standard 200), `recipe_book_tab` (`meals`, `drinks`, `misc`; Standard `misc`), `group` (optional). **Die Vorgabe stimmt.**
- Ohne `container` nimmt der Topf automatisch den Werkbank-Rest des Ergebnisses. Bei Schüsselgerichten ist das die Schüssel (Zeile 45–51).
- Erzeugung mit FD-Klasse `data/builder/CookingPotRecipeBuilder` (in der FD-Datei enthalten). Sie speichert unter `<namespace>/cooking/<ergebnis>`, also genau `brotzeitdelight:cooking/mustard`, und legt die Rezeptbuch-Freischaltung an.

**Schneidebrett** – Typ `farmersdelight:cutting` (`CuttingBoardRecipe.java:161–190`)
- `ingredients` (Liste mit **genau einem** Eintrag), `tool`, `result` (Liste von bis zu 4 `{"item":{"id","count"},"chance"}`), `sound` (optional).
- Erzeugung mit `data/builder/CuttingBoardRecipeBuilder`. **Das Schneidebrett hat kein Rezeptbuch.** FD legt dafür keine Freischaltung an (`CuttingBoardRecipeBuilder.java:89`).

**Pfanne und Herd** benutzen Lagerfeuer-Rezepte (`RecipeType.CAMPFIRE_COOKING`). Die Pfanne verkürzt die Zeit (`SkilletBlock.getSkilletCookingTime`). Die Vorgabe stimmt. (`SkilletBlockEntity.java:48`, `StoveBlockEntity.java:16`)

**Ofen, Räucherofen, Lagerfeuer** bei FD: 200 / 100 / 600 Ticks, 0,35 Erfahrung – genau die Werte der Vorgabe. (`data/recipe/SmeltingRecipes.java:44–55`)

**Weizenteig** entsteht bei FD auf zwei Wegen: 1 Weizen + Wassereimer → 1 Teig (Eimer bleibt), oder 3 Weizen + 1 Ei → 3 Teig. (`common/crafting/DoughRecipe.java`, `CraftingRecipes.java:607`)

## 5. Gerichte, Effekte, Schüsseln

| Thema | Fakt | Fundstelle |
|---|---|---|
| Schüssel-Rückgabe | Klasse `ConsumableItem`: gibt nach dem Essen den Werkbank-Rest (Schüssel) zurück, bei vollem Inventar fällt er zu Boden. Eigenschaften wie FD: `ModItems.bowlFoodItem(...)` = Rest Schüssel, Stapel 16. | `common/item/ConsumableItem.java:49–80`, `ModItems.java:51` |
| Effekt-Tooltip | `ConsumableItem` zeigt die Effekte über `TextUtils.addFoodEffectTooltip`, abschaltbar in FDs Client-Einstellung `enableFoodEffectTooltip`. | `ConsumableItem.java:90–98`, `common/Configuration.java:130` |
| Nahrhaft | `FoodValues.nourishment(dauer)` (Stufe 0, ohne Partikel). Dauern: 600 / 1200 / 3600 / 6000 Ticks = 30 s / 1 / 3 / 5 min. Wirkung: setzt die Erschöpfung auf 0. | `common/FoodValues.java:17–24`, `effect/NourishmentEffect.java` |
| Komfort | Gibt es in 1.3.4 noch, kein FD-Gericht vergibt ihn mehr. Wir benutzen ihn nicht. | `ModEffects.java:16` |
| Stärkstes FD-Gericht | **14 Hunger, Sättigung 0,75**, 5 min Nahrhaft (z. B. Gebratene Hammelkoteletts, Festmahl-Portionen). | `FoodValues.java:187–215` |
| Schnell essen | `FoodProperties.Builder.fast()` = 0,8 s = 16 Ticks (normal 1,6 s = 32). FD nutzt das bei Kuchenstücken. | MC `FoodProperties.java:20,91`, FD `FoodValues.java:87` |
| Rohe Bratwurst | Vorbild FD-Teigball: 30 % Chance auf 30 s Hunger | `FoodValues.java:43` |
| **Schüssel in der Werkbank** | Ein Schüsselgericht hat die Schüssel als Werkbank-Rest. Legt man den Kartoffelsalat in die Werkbank, bleibt seine Schüssel liegen (Minecraft-Standard bei allen Werkbank-Rezepten). | MC `CraftingRecipe.getRemainingItems` |

## 6. Senfpflanze und Wilder Senf

| Thema | Fakt | Fundstelle |
|---|---|---|
| Feldfrucht | Vanilla-Klasse `CropBlock` mit Eigenschaften von Weizen, wie FD bei Kohl und Zwiebel | FD `ModBlocks.java:313` |
| Modell | Vanilla-Weizen benutzt das Modell `block/crop` (4 Flächen als Raute „#"), **kein** Kreuzmodell. FD nutzt bei Zwiebeln `crop`, bei Kohl ein eigenes Kreuzmodell. | MC `models/block/wheat_stage7.json`, FD `data/BlockStates.java:84–85` |
| Bienen | Tag `minecraft:bee_growables` enthält `#minecraft:crops`; Bienen lassen jede `CropBlock` darin wachsen. Kein Zusatzcode nötig. | MC `Bee.java:965–968` |
| Ackerboden | Tag `minecraft:maintains_farmland` (sonst trocknet der Boden aus), FD trägt seine Pflanzen dort ein | MC `FarmBlock.java:124`, FD `BlockTags.java:210` |
| Weizensamen-Formel | Alter 7: 1 Weizen + Samen mit `binomial_with_bonus_count` (extra 3, p 0,5714). Bei reinen Samen-Pflanzen (Karotte): **1 bis 4** Stück, mit Glück mehr. | MC `loot_table/blocks/wheat.json`, `carrots.json` |
| Wildpflanzen-Klasse | `WildCropBlock` (erbt `FlowerBlock`): Knochenmehl **vermehrt** die Pflanze, wächst auch auf Sand, braucht einen Effekt für Verdächtige Suppe. | FD `common/block/WildCropBlock.java` |
| Brennbarkeit | Wie Gras: 60 / 100 | FD `WildCropBlock.java:45–52`, MC `FireBlock.java:444` |
| Tags der Wildpflanzen | `farmersdelight:wild_crops` (Block und Item) und `minecraft:small_flowers` | FD `BlockTags.java:199,282`, `ItemTags.java:31–32` |
| Beute Wildweißkohl | Schere → Block; sonst Kohlsamen (Glück: Bonus ×2) und 20 % Chance auf einen Kohl. Behutsamkeit wird nicht beachtet. | FD `loot_table/blocks/wild_cabbages.json` |
| **Häufigkeit Wildweißkohl** | `rarity_filter` 1 von **30** Chunks, je Gruppe **64** Versuche, Streuung **6** waagerecht / **3** senkrecht, nur Oberwelt. (Zum Vergleich: Wildzwiebel und Wildkarotte 1 von 120.) | FD `common/world/WildCropGeneration.java:122,161`, `worldgen/placed_feature/patch_wild_cabbages.json` |
| Biome-Modifier | FD-Typ `farmersdelight:add_features_by_filter`; NeoForge hat dafür den Standardtyp `neoforge:add_features` | `neoforge/biome_modifier/wild_cabbages.json` |

## 7. Gärfass

| Thema | Fakt | Fundstelle |
|---|---|---|
| Vanilla-Fass | Härte 2,5, Holzgeräusch, Kartenfarbe Holz, Axt. Es ist nicht brennbar; nur Lava entzündet es (`ignitedByLava`). Das lassen wir weg. | MC `Blocks.java:6040` |
| Geräusche | `block.composter.fill`, `block.barrel.close`, `block.barrel.open`, `entity.item.pickup`, `block.bubble_column.bubble_pop` | MC `SoundEvents.java` |
| Blasen-Partikel | `minecraft:bubble` und `minecraft:bubble_column_up` verschwinden sofort außerhalb von Wasser. `minecraft:bubble_pop` prüft kein Wasser und ist sichtbar → Vorschlag. Endgültige Wahl nach Sichtprüfung im Spiel (Vorgabe 10.5). | MC `BubbleParticle.java:35`, `BubbleColumnUpParticle.java:27`, `BubblePopParticle.java` |

## 8. Tags, Kompost, Tierfutter

| Thema | Fakt | Fundstelle |
|---|---|---|
| Samen | `c:seeds` (NeoForge-Art: Unter-Tag `c:seeds/mustard`). FD trägt seine Samen auch in `minecraft:villager_plantable_seeds`, `chicken_food`, `parrot_food` ein. | FD `ItemTags.java:47,75,84,280` |
| Feldfrucht (Block) | `minecraft:crops` | FD `BlockTags.java:120` |
| Gekochtes / rohes Fleisch | `c:foods/cooked_meat`, `c:foods/raw_meat` (NeoForge) | FD `ItemTags.java:248–250` |
| Brot-artig | `c:foods/bread` | NF-Tag |
| Lebensmittelvergiftung | `c:foods/food_poisoning` (FD trägt rohe Teige ein) – passt für rohe Bratwurst | FD `ItemTags.java:252` |
| FD-Sammeltags | `farmersdelight:meals` (Teller/Schüssel), `snacks`, `sweets` | FD `common/tag/ModTags.java:81–90` |
| Wolfsfutter | `minecraft:wolf_food` = `#minecraft:meat`. FD trägt Fleisch in `minecraft:meat` ein. | MC-Tag, FD `ItemTags.java:60` |
| Mit Axt abbaubar | `minecraft:mineable/axe` | MC-Tag |
| Kompost | NeoForge-Datenkarte `neoforge:compostables`. FD-Werte: Samen 30 %, Wildpflanzen 65 %, Kuchenstücke 85 %, ganze Kuchen 100 % – deine Werte passen dazu. | FD `data/DataMaps.java:53–96` |

## 9. Fortschritte

FD hat einen eigenen Baum mit der Wurzel `farmersdelight:main/root`. Unsere vier Fortschritte können daran hängen. Vorschlag für die Eltern:

| Unser Fortschritt | Eltern bei FD |
|---|---|
| `get_mustard_seeds` | `farmersdelight:main/get_fd_seed` (Wildpflanze gefunden) |
| `get_sauerkraut` | `farmersdelight:main/place_cooking_pot` |
| `get_pretzel` | `farmersdelight:main/place_campfire` |
| `eat_everything` | `farmersdelight:main/eat_nourishing_food` |

Fundstelle: `advancement/main/*.json` (Branch 1.21). Im 1.4-Branch sind die IDs gleich.

## 10. Texte bei FD (deutsch)

FD nennt auf Deutsch: Kohl → **„Weißkohl"**, Kohlblatt → **„Weißkohlblatt"**, Weizenteig → **„Teigball"**, Nahrhaft → **„Gesättigt"**. Der Effekt-Tooltip unserer Gerichte zeigt automatisch FDs Text, also „Gesättigt (3:00)". (`assets/farmersdelight/lang/de_de.json`)
