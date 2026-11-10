package de.brotzeitdelight.data;

/**
 * Die Sprachen, in denen der Mod vollständig übersetzt ist.
 */
public enum ModLanguage {
    GERMAN("de_de"),
    ENGLISH("en_us");

    private final String locale;

    ModLanguage(String locale) {
        this.locale = locale;
    }

    /** Sprachkürzel von Minecraft, zugleich der Dateiname der Sprachdatei. */
    public String locale() {
        return locale;
    }
}
