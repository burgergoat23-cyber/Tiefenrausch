package de.brotzeitdelight.data;

import de.brotzeitdelight.registry.ModCreativeTabs;
import de.brotzeitdelight.registry.ModItems;
import net.minecraft.world.level.ItemLike;

import java.util.List;

/**
 * Alle Texte des Mods. Die einzige Stelle, an der Namen und Meldungen stehen.
 */
public final class ModTranslations {
    private ModTranslations() {
    }

    public static List<Translation> all() {
        return List.of(
                new Translation(ModCreativeTabs.TITLE_KEY, "Brotzeit Delight", "Brotzeit Delight"),
                name(ModItems.RAW_PRETZEL, "Rohe Breze", "Raw Pretzel"),
                name(ModItems.PRETZEL, "Breze", "Pretzel"));
    }

    private static Translation name(ItemLike item, String german, String english) {
        return new Translation(item.asItem().getDescriptionId(), german, english);
    }
}
