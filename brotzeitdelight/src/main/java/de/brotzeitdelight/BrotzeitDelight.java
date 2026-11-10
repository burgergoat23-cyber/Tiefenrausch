package de.brotzeitdelight;

import de.brotzeitdelight.data.DataGenerators;
import de.brotzeitdelight.registry.ModCreativeTabs;
import de.brotzeitdelight.registry.ModItems;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;

/**
 * Einstiegspunkt des Mods. Meldet alle Inhalte beim Spiel an.
 */
@Mod(BrotzeitDelight.MOD_ID)
public final class BrotzeitDelight {
    /** Muss mit der Mod-ID in neoforge.mods.toml übereinstimmen. */
    public static final String MOD_ID = "brotzeitdelight";

    public BrotzeitDelight(IEventBus modEventBus) {
        ModItems.ITEMS.register(modEventBus);
        ModCreativeTabs.CREATIVE_TABS.register(modEventBus);

        // Wird nur beim Lauf des Datengenerators ausgelöst, nicht im normalen Spiel.
        modEventBus.addListener(DataGenerators::gatherData);
    }
}
