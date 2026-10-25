package com.burgergoat.arsenal.feature;

import com.burgergoat.arsenal.ArsenalClient;
import com.burgergoat.arsenal.config.ArsenalConfig;
import com.burgergoat.arsenal.mixin.GameRendererAccessor;
import net.minecraft.client.MinecraftClient;
import net.minecraft.util.Identifier;

/** Bild-Filter (eigene Post-Processing-Shader unter assets/arsenal/post_effect). */
public final class Filters {
	/** id, Name, Beschreibung */
	public static final String[][] LIST = {
			{"none", "Aus", "Normales Minecraft-Bild"},
			{"clear", "Klar & Scharf", "Schärfer und etwas kräftiger – wie CS-Profis spielen"},
			{"vivid", "Lebendig", "Kräftige Farben mit leichtem Leuchten"},
			{"cinematic", "Kino", "Filmkurve, Blau-Orange-Look, Linsenrand, Filmkorn"},
			{"golden", "Goldene Stunde", "Warmes Sonnenlicht mit starkem Leuchten"},
			{"frost", "Frost", "Kühles, klares Winterlicht"},
			{"dream", "Traum", "Weiches Glühen und Pastellfarben"},
			{"hdr", "HDR", "Helle Lichter, tiefe Schatten, viel Detail"},
			{"noir", "Noir", "Schwarzweiß-Film mit Korn"},
			{"comic", "Comic", "Farbstufen und dunkle Umrisse"},
			{"nightvision", "Nachtsicht", "Echtes Nachtsichtgerät: hell, Röhre, Rauschen"},
	};

	private Filters() {
	}

	private static boolean known(String id) {
		for (String[] f : LIST) if (f[0].equals(id)) return true;
		return false;
	}

	public static String name(String id) {
		for (String[] f : LIST) if (f[0].equals(id)) return f[1];
		return id;
	}

	public static void tick(MinecraftClient client) {
		if (client.gameRenderer == null || client.world == null) return;
		GameRendererAccessor acc = (GameRendererAccessor) client.gameRenderer;
		Identifier current = acc.arsenal$getPostProcessorId();
		boolean ours = current != null && ArsenalClient.MOD_ID.equals(current.getNamespace());
		String f = ArsenalConfig.get().filter;
		if (f != null && !known(f)) {
			// alter Filtername aus einer frueheren Version
			f = "none";
			ArsenalConfig.get().filter = f;
		}
		if (f == null || f.equals("none")) {
			if (ours) acc.arsenal$clearPostProcessor();
			return;
		}
		Identifier want = Identifier.of(ArsenalClient.MOD_ID, f);
		if (current == null || (ours && !current.equals(want))) {
			acc.arsenal$setPostProcessor(want);
		}
	}
}
