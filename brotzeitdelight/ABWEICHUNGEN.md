# Abweichungen von der Vorgabe

Hier steht jede Stelle, an der das Projekt von `BROTZEIT_DELIGHT_SPEC.md` abweicht,
weil technische Tatsachen aus Minecraft, NeoForge oder Farmer's Delight es verlangen
(Rangfolge in der Vorgabe: Tatsachen vor Vorgabe vor Annahmen).

| Nr. | Meilenstein | Vorgabe | Abweichung | Warum | Quelle |
|---|---|---|---|---|---|
| 1 | 1 | Abschnitt 17: Die Breze entsteht erst in Meilenstein 3. | Das Item `pretzel` ist schon in Meilenstein 1 angemeldet, aber nur als einfaches Item ohne Essenswerte und ohne Rezepte. Alles Weitere folgt wie geplant in Meilenstein 3. | Minecraft blendet einen Kreativ-Tab ohne Inhalt aus, und das Symbol des Tabs soll laut Abschnitt 2 eine Breze sein. Ohne Item wäre der Tab im Spiel nicht zu sehen und Meilenstein 1 nicht prüfbar. | Minecraft 1.21.1, Klasse `net.minecraft.world.item.CreativeModeTab`, Methode `shouldDisplay()` |
| 2 | 2 | Abschnitt 8: Zutaten wo möglich über `c:`-Tags. | Rinderhack ist das Item `farmersdelight:minced_beef`, das Schweinekotelett das Item `minecraft:porkchop`, Kohl und Kohlblatt im Gärfass sind ebenfalls einzelne Items. | `c:foods/raw_beef` enthält auch rohes Rindfleisch, `c:foods/raw_pork` auch Speck, `c:crops/cabbage` Kohl und Blatt zusammen. Mit den Tags würden Rezepte Gegenstände vervielfältigen (1 Rindfleisch ergibt auf dem Schneidebrett 2 Hack) bzw. Kohl und Blatt gleich zählen. „Wo möglich" ist hier also nicht möglich. | FD `data/ItemTags.java:296,311,313` |
| 3 | 2 | Abschnitt 8: Jedes Rezept bekommt eine Rezeptbuch-Freischaltung. | Die zwei Schneidebrett-Rezepte und die zwei Gärfass-Rezepte bekommen keine. | Das Schneidebrett hat kein Rezeptbuch, FD legt für seine Schneiderezepte auch keine Freischaltung an. Das Gärfass hat bewusst kein Menü, also auch kein Rezeptbuch. | FD `data/builder/CuttingBoardRecipeBuilder.java:89` |
