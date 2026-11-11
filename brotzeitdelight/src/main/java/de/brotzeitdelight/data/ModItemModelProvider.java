package de.brotzeitdelight.data;

import de.brotzeitdelight.BrotzeitDelight;
import de.brotzeitdelight.registry.ModItems;
import net.minecraft.data.PackOutput;
import net.neoforged.neoforge.client.model.generators.ItemModelProvider;
import net.neoforged.neoforge.common.data.ExistingFileHelper;

/**
 * Erzeugt die Item-Modelle.
 */
public final class ModItemModelProvider extends ItemModelProvider {
    public ModItemModelProvider(PackOutput output, ExistingFileHelper existingFileHelper) {
        super(output, BrotzeitDelight.MOD_ID, existingFileHelper);
    }

    @Override
    protected void registerModels() {
        basicItem(ModItems.RAW_PRETZEL.get());
        basicItem(ModItems.PRETZEL.get());
    }
}
