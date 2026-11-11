package de.brotzeitdelight.registry;

import de.brotzeitdelight.BrotzeitDelight;
import de.brotzeitdelight.item.ModFoods;
import net.minecraft.world.item.Item;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

/**
 * Alle Items des Mods.
 */
public final class ModItems {
    public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(BrotzeitDelight.MOD_ID);

    // Zutaten und Zwischenprodukte (Vorgabe Abschnitt 6)
    public static final DeferredItem<Item> RAW_PRETZEL = ITEMS.registerSimpleItem("raw_pretzel");

    // Gerichte (Vorgabe Abschnitt 7)
    public static final DeferredItem<Item> PRETZEL = ITEMS.registerSimpleItem("pretzel",
            new Item.Properties().food(ModFoods.PRETZEL));

    private ModItems() {
    }
}
