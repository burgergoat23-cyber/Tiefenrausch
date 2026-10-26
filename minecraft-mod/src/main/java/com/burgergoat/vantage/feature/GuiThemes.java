package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.gui.Draw;
import com.burgergoat.vantage.gui.VantageScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.texture.TextureManager;
import net.minecraft.resource.Resource;
import net.minecraft.util.Identifier;

import java.io.InputStream;
import java.util.Optional;

/**
 * Designs fuer Kisten, Oefen, Crafter, Braustand, Inventar usw.: die Bilder des Spiels (bzw. des Resourcepacks)
 * werden beim Oeffnen eines Fensters umgefaerbt. Graue Flaechen bekommen die Farben des Designs, bunte Teile
 * (Flamme, Pfeile, Lohenstaub-Anzeige) bleiben, wie sie sind. Keine Bilder von Mojang in der Mod.
 */
public final class GuiThemes {
	public static final String[] NAMES = {"Normal", "Dunkel", "Mitternacht", "Glas", "Menü-Farbe"};
	/** Normale Farben des Spiels (zum Vergleich in der Vorschau). */
	private static final int[] VANILLA = {0xFF000000, 0xFF373737, 0xFF555555, 0xFF8B8B8B, 0xFFC6C6C6, 0xFFFFFFFF};
	/** Helligkeits-Stufen der Spiel-Bilder: Umriss, Slot-Schatten, Schatten, Slot, Flaeche, Lichtkante. */
	private static final int[] STOPS = {0, 55, 85, 139, 198, 255};
	private static final String[] TEXTURES = {
			"container/generic_54", "container/inventory", "container/furnace", "container/blast_furnace", "container/smoker",
			"container/crafting_table", "container/crafter", "container/brewing_stand", "container/dispenser",
			"container/hopper", "container/shulker_box", "container/anvil", "container/enchanting_table",
			"container/grindstone", "container/cartography_table", "container/loom", "container/smithing",
			"container/stonecutter", "container/beacon", "container/horse", "container/villager",
			"container/creative_inventory/tab_items", "container/creative_inventory/tab_item_search",
			"container/creative_inventory/tab_inventory", "recipe_book"};
	private static final int LABEL = 0xFF404040;
	private static int applied;
	private static int appliedAccent;

	private GuiThemes() {
	}

	/** Farben (6 Stufen) fuer ein Design. */
	public static int[] palette(int theme) {
		int a = VantageScreen.accent();
		return switch (theme) {
			case 1 -> new int[]{0xFF07080B, 0xFF0D0F13, 0xFF14171C, 0xFF191D24, 0xFF272C35, 0xFF3F4652};
			case 2 -> new int[]{0xFF04060D, 0xFF090E1E, 0xFF0F1630, 0xFF141C3A, 0xFF1F2B52, 0xFF3B4D86};
			case 3 -> new int[]{0xE0000000, 0xB0000000, 0x98000000, 0x88000000, 0xA0161A22, 0x80FFFFFF};
			case 4 -> new int[]{Draw.mix(0xFF000000, a, 0.25f), Draw.mix(0xFF0B0D11, a, 0.10f), Draw.mix(0xFF12151A, a, 0.18f),
					Draw.mix(0xFF161A20, a, 0.06f), Draw.mix(0xFF20252D, a, 0.14f), Draw.mix(0xFF3A414C, a, 0.75f)};
			default -> VANILLA.clone();
		};
	}

	private static int theme() {
		int t = VantageConfig.get().guiTheme;
		return t < 0 || t >= NAMES.length ? 0 : t;
	}

	/** Vor dem Oeffnen eines Fensters (und nach Aenderungen im Menue): Bilder im richtigen Design bereitlegen. */
	public static void ensure(MinecraftClient mc) {
		int theme = theme();
		int accent = VantageScreen.accent();
		if (theme == applied && (theme != 4 || accent == appliedAccent)) return;
		TextureManager tm = mc.getTextureManager();
		int[] pal = palette(theme);
		for (String name : TEXTURES) {
			Identifier id = Identifier.ofVanilla("textures/gui/" + name + ".png");
			if (theme == 0) {
				// Normales Bild: wird beim naechsten Zeichnen frisch aus dem Resourcepack geladen
				tm.destroyTexture(id);
				continue;
			}
			Optional<Resource> res = mc.getResourceManager().getResource(id);
			if (res.isEmpty()) continue;
			try (InputStream in = res.get().getInputStream()) {
				NativeImage img = NativeImage.read(in);
				recolor(img, pal);
				tm.registerTexture(id, new NativeImageBackedTexture(() -> "vantage_gui_" + name, img));
			} catch (Exception e) {
				VantageClient.LOG.warn("GUI-Design: {} nicht umgefaerbt", id, e);
			}
		}
		applied = theme;
		appliedAccent = accent;
	}

	private static void recolor(NativeImage img, int[] pal) {
		for (int y = 0; y < img.getHeight(); y++) {
			for (int x = 0; x < img.getWidth(); x++) {
				int c = img.getColorArgb(x, y);
				int a = c >>> 24;
				if (a == 0) continue;
				int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
				// Bunte Teile bleiben
				if (Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b)) > 24) continue;
				int n = shade((r + g + b) / 3, pal);
				int na = Math.round(a * ((n >>> 24) / 255f));
				img.setColorArgb(x, y, (na << 24) | (n & 0xFFFFFF));
			}
		}
	}

	/** Helligkeit 0..255 -> Farbe des Designs (zwischen den Stufen weich gemischt). */
	public static int shade(int l, int[] pal) {
		for (int i = 1; i < STOPS.length; i++) {
			if (l <= STOPS[i]) {
				float t = (l - STOPS[i - 1]) / (float) (STOPS[i] - STOPS[i - 1]);
				return Draw.mix(pal[i - 1], pal[i], t);
			}
		}
		return pal[pal.length - 1];
	}

	/** Die dunkelgrauen Beschriftungen ("Kiste", "Inventar") werden in dunklen Designs hell. */
	public static int labelColor(int color) {
		if (applied == 0 || (color != LABEL && color != (LABEL & 0xFFFFFF))) return color;
		if (!(MinecraftClient.getInstance().currentScreen instanceof HandledScreen<?>)) return color;
		return 0xFFDDE3EB;
	}
}
