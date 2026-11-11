package de.brotzeitdelight;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Prüft die vom Datengenerator erzeugten Sprachdateien (Vorgabe Abschnitte 13 und 16.1).
 */
class LanguageFilesTest {
    private static final Path ASSETS = Path.of("src/generated/resources/assets", BrotzeitDelight.MOD_ID);
    private static final Path ITEM_MODELS = ASSETS.resolve("models/item");

    @Test
    void bothLanguagesHaveTheSameKeys() throws IOException {
        assertEquals(keys("en_us"), keys("de_de"));
    }

    @Test
    void noTextIsEmpty() throws IOException {
        for (String language : List.of("de_de", "en_us")) {
            JsonObject json = read(language);
            for (String key : json.keySet()) {
                assertFalse(json.get(key).getAsString().isBlank(), language + ": leerer Text bei " + key);
            }
        }
    }

    @Test
    void everyItemHasANameInBothLanguages() throws IOException {
        Set<String> german = keys("de_de");
        Set<String> english = keys("en_us");
        try (Stream<Path> models = Files.list(ITEM_MODELS)) {
            List<String> items = models.map(p -> p.getFileName().toString().replace(".json", "")).toList();
            assertFalse(items.isEmpty(), "Keine Item-Modelle gefunden");
            for (String item : items) {
                String itemKey = "item." + BrotzeitDelight.MOD_ID + "." + item;
                String blockKey = "block." + BrotzeitDelight.MOD_ID + "." + item;
                assertTrue(german.contains(itemKey) || german.contains(blockKey), "Deutsch fehlt: " + item);
                assertTrue(english.contains(itemKey) || english.contains(blockKey), "Englisch fehlt: " + item);
            }
        }
    }

    private static Set<String> keys(String language) throws IOException {
        return new TreeSet<>(read(language).keySet());
    }

    private static JsonObject read(String language) throws IOException {
        return JsonParser.parseString(Files.readString(ASSETS.resolve("lang/" + language + ".json"))).getAsJsonObject();
    }
}
