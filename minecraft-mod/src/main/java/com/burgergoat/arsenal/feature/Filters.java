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
			{"none", "Aus", "Normales Bild"},
			{"vibrance", "Digital Vibrance", "Kräftige Farben wie bei CS-Profis"},
			{"cinematic", "Kino", "Mehr Kontrast, warmer Ton, dunkle Ränder"},
			{"warm", "Warm", "Sonnenuntergang-Stimmung"},
			{"cold", "Kalt", "Kühles, blaues Bild"},
			{"noir", "Noir", "Schwarzweiß mit Kontrast"},
			{"sharp", "Scharf", "Kanten werden nachgeschärft"},
			{"bright", "Hell", "Etwas helleres Bild"},
			{"retro", "Retro", "Weniger Farbstufen, Comic-Look"},
			{"nightvision", "Nachtsicht-Look", "Grünes Nachtsichtgerät"},
	};

	private Filters() {
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
