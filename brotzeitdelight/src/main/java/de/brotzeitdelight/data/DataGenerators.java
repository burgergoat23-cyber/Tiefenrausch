package de.brotzeitdelight.data;

import net.minecraft.data.DataGenerator;
import net.minecraft.data.PackOutput;
import net.neoforged.neoforge.common.data.ExistingFileHelper;
import net.neoforged.neoforge.data.event.GatherDataEvent;

/**
 * Meldet alle Datengeneratoren an. Sie erzeugen die Dateien in src/generated/resources.
 */
public final class DataGenerators {
    private DataGenerators() {
    }

    public static void gatherData(GatherDataEvent event) {
        DataGenerator generator = event.getGenerator();
        PackOutput output = generator.getPackOutput();
        ExistingFileHelper existingFileHelper = event.getExistingFileHelper();

        generator.addProvider(event.includeClient(), new ModItemModelProvider(output, existingFileHelper));
        for (ModLanguage language : ModLanguage.values()) {
            generator.addProvider(event.includeClient(), new ModLanguageProvider(output, language));
        }
    }
}
