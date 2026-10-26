package com.burgergoat.vantage.skin;

import com.burgergoat.vantage.VantageClient;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Liest assets/vantage/skins.json (vom Generator erzeugt): Kategorien, Formen und Muster. */
public final class SkinCatalog {
	public record Finish(String id, String name, int rarity) {
	}

	public record ShapeDef(String id, String name) {
	}

	public record Skin(String id, Category category, ShapeDef shape, Finish finish) {
		public String displayName() {
			if (shape == null) return finish.name();
			return "★ " + shape.name() + " | " + finish.name();
		}

		public int rarity() {
			return finish.rarity();
		}
	}

	public static final class Category {
		public final String id;
		public final String name;
		public final List<String> items = new ArrayList<>();
		public final List<ShapeDef> shapes = new ArrayList<>();
		public final List<Finish> finishes = new ArrayList<>();
		public final List<Skin> skins = new ArrayList<>();

		Category(String id, String name) {
			this.id = id;
			this.name = name;
		}

		public String skinId(ShapeDef shape, Finish finish) {
			return shape == null ? id + "_" + finish.id() : id + "_" + shape.id() + "_" + finish.id();
		}

		public boolean hasShapes() {
			return !shapes.isEmpty();
		}
	}

	/** Seltenheitsfarben wie in CS (Konsum ... Gold). */
	public static final int[] RARITY_COLORS = {0xFFB0C3D9, 0xFF5E98D9, 0xFF4B69FF, 0xFF8847FF, 0xFFD32CE6, 0xFFEB4B4B, 0xFFE4AE39};
	public static final String[] RARITY_NAMES = {"Konsum", "Industrie", "Militär", "Begrenzt", "Geheim", "Verdeckt", "★ Gold"};

	private static final Map<String, Category> CATEGORIES = new LinkedHashMap<>();
	private static final Map<String, Category> BY_ITEM = new HashMap<>();
	private static final Map<String, Skin> SKINS = new HashMap<>();

	private SkinCatalog() {
	}

	public static void load() {
		CATEGORIES.clear();
		BY_ITEM.clear();
		SKINS.clear();
		try (InputStream in = SkinCatalog.class.getResourceAsStream("/assets/vantage/skins.json")) {
			if (in == null) {
				VantageClient.LOG.error("skins.json fehlt");
				return;
			}
			JsonObject root = JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonObject();
			for (JsonElement ce : root.getAsJsonArray("categories")) {
				JsonObject co = ce.getAsJsonObject();
				Category cat = new Category(co.get("id").getAsString(), co.get("name").getAsString());
				for (JsonElement e : co.getAsJsonArray("items")) cat.items.add(e.getAsString());
				JsonArray shapes = co.getAsJsonArray("shapes");
				for (JsonElement e : shapes) {
					JsonObject o = e.getAsJsonObject();
					cat.shapes.add(new ShapeDef(o.get("id").getAsString(), o.get("name").getAsString()));
				}
				for (JsonElement e : co.getAsJsonArray("finishes")) {
					JsonObject o = e.getAsJsonObject();
					cat.finishes.add(new Finish(o.get("id").getAsString(), o.get("name").getAsString(), o.get("rarity").getAsInt()));
				}
				if (cat.hasShapes()) {
					for (ShapeDef s : cat.shapes) {
						for (Finish f : cat.finishes) cat.skins.add(new Skin(cat.skinId(s, f), cat, s, f));
					}
				} else {
					for (Finish f : cat.finishes) cat.skins.add(new Skin(cat.skinId(null, f), cat, null, f));
				}
				for (Skin s : cat.skins) SKINS.put(s.id(), s);
				for (String item : cat.items) BY_ITEM.put(item, cat);
				CATEGORIES.put(cat.id, cat);
			}
			VantageClient.LOG.info("Vantage: {} Skins in {} Kategorien geladen", SKINS.size(), CATEGORIES.size());
		} catch (Exception e) {
			VantageClient.LOG.error("skins.json konnte nicht gelesen werden", e);
		}
	}

	public static Collection<Category> categories() {
		return CATEGORIES.values();
	}

	public static Category category(String id) {
		return CATEGORIES.get(id);
	}

	public static Category forItem(String itemPath) {
		return BY_ITEM.get(itemPath);
	}

	public static Skin skin(String id) {
		return id == null ? null : SKINS.get(id);
	}

	public static int rarityColor(int rarity) {
		return RARITY_COLORS[Math.max(0, Math.min(RARITY_COLORS.length - 1, rarity))];
	}
}
