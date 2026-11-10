# Abweichungen von der Vorgabe

Hier steht jede Stelle, an der das Projekt von `BROTZEIT_DELIGHT_SPEC.md` abweicht,
weil technische Tatsachen aus Minecraft, NeoForge oder Farmer's Delight es verlangen
(Rangfolge in der Vorgabe: Tatsachen vor Vorgabe vor Annahmen).

| Nr. | Meilenstein | Vorgabe | Abweichung | Warum | Quelle |
|---|---|---|---|---|---|
| 1 | 1 | Abschnitt 17: Die Breze entsteht erst in Meilenstein 3. | Das Item `pretzel` ist schon in Meilenstein 1 angemeldet, aber nur als einfaches Item ohne Essenswerte und ohne Rezepte. Alles Weitere folgt wie geplant in Meilenstein 3. | Minecraft blendet einen Kreativ-Tab ohne Inhalt aus, und das Symbol des Tabs soll laut Abschnitt 2 eine Breze sein. Ohne Item wäre der Tab im Spiel nicht zu sehen und Meilenstein 1 nicht prüfbar. | Minecraft 1.21.1, Klasse `net.minecraft.world.item.CreativeModeTab`, Methode `shouldDisplay()` |
