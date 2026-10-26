package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.mixin.GameRendererAccessor;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;

/** Bild-Filter (eigene Post-Processing-Shader unter assets/vantage/post_effect). */
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

	public static void tick(Minecraft client) {
		if (client.gameRenderer == null || client.level == null) return;
		GameRendererAccessor acc = (GameRendererAccessor) client.gameRenderer;
		Identifier current = acc.vantage$getPostProcessorId();
		boolean ours = current != null && VantageClient.MOD_ID.equals(current.getNamespace());
		String f = VantageConfig.get().filter;
		if (f != null && !known(f)) {
			// alter Filtername aus einer frueheren Version
			f = "none";
			VantageConfig.get().filter = f;
		}
		if (f == null || f.equals("none")) {
			if (ours) acc.vantage$clearPostProcessor();
			return;
		}
		Identifier want = Identifier.fromNamespaceAndPath(VantageClient.MOD_ID, f);
		if (current == null || (ours && !current.equals(want))) {
			acc.vantage$setPostProcessor(want);
		}
	}
}
