package de.brotzeitdelight.registry;

import de.brotzeitdelight.BrotzeitDelight;
import net.minecraft.world.item.Item;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

/**
 * Alle Items des Mods.
 */
public final class ModItems {
    public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(BrotzeitDelight.MOD_ID);

    /** Breze. Vorerst nur das Symbol des Kreativ-Tabs; essbar wird sie mit Meilenstein 3. */
    public static final DeferredItem<Item> PRETZEL = ITEMS.registerSimpleItem("pretzel");

    private ModItems() {
    }
}
