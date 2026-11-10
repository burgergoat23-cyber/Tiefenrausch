package de.brotzeitdelight.data;

/**
 * Ein Text in beiden Sprachen. Weil jeder Eintrag Deutsch und Englisch enthalten muss,
 * kann keine Sprachdatei einen Schlüssel haben, der in der anderen fehlt.
 */
public record Translation(String key, String german, String english) {
    public String text(ModLanguage language) {
        return switch (language) {
            case GERMAN -> german;
            case ENGLISH -> english;
        };
    }
}
