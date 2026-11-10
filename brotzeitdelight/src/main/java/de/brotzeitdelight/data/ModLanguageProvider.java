package de.brotzeitdelight.data;

import de.brotzeitdelight.BrotzeitDelight;
import net.minecraft.data.PackOutput;
import net.neoforged.neoforge.common.data.LanguageProvider;

/**
 * Erzeugt die Sprachdatei für eine Sprache aus der gemeinsamen Textliste.
 */
public final class ModLanguageProvider extends LanguageProvider {
    private final ModLanguage language;

    public ModLanguageProvider(PackOutput output, ModLanguage language) {
        super(output, BrotzeitDelight.MOD_ID, language.locale());
        this.language = language;
    }

    @Override
    protected void addTranslations() {
        for (Translation translation : ModTranslations.all()) {
            add(translation.key(), translation.text(language));
        }
    }
}
