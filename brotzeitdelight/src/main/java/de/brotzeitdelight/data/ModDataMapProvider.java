package de.brotzeitdelight.data;

import de.brotzeitdelight.registry.ModItems;
import net.minecraft.core.HolderLookup;
import net.minecraft.data.PackOutput;
import net.neoforged.neoforge.common.data.DataMapProvider;
import net.neoforged.neoforge.registries.datamaps.builtin.Compostable;
import net.neoforged.neoforge.registries.datamaps.builtin.NeoForgeDataMaps;

import java.util.concurrent.CompletableFuture;

/**
 * Datenkarten von NeoForge, hier die Kompost-Wahrscheinlichkeiten (Vorgabe Abschnitt 12).
 * Vorbild: vectorwing.farmersdelight.data.DataMaps.
 */
public final class ModDataMapProvider extends DataMapProvider {
    public ModDataMapProvider(PackOutput output, CompletableFuture<HolderLookup.Provider> lookupProvider) {
        super(output, lookupProvider);
    }

    @Override
    protected void gather(HolderLookup.Provider provider) {
        builder(NeoForgeDataMaps.COMPOSTABLES)
                .add(ModItems.RAW_PRETZEL, new Compostable(0.65F), false)
                .add(ModItems.PRETZEL, new Compostable(0.85F), false);
    }
}
