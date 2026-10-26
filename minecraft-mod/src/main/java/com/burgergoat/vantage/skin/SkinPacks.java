package com.burgergoat.vantage.skin;

import com.burgergoat.vantage.config.VantageConfig;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fertige Skin-Pakete – wie ein Resourcepack: ein Klick, und jede Schwert-Stufe bekommt ein anderes
 * CS-Messer im selben Muster, passend dazu Axt, Kolben, Speer, Schild, Perle, Windladung und Totem.
 */
public final class SkinPacks {
	public record Pack(String id, String name, String desc, Map<String, String> skins) {
		public boolean active() {
			Map<String, String> cur = VantageConfig.get().skins;
			for (Map.Entry<String, String> e : skins.entrySet()) {
				if (!e.getValue().equals(cur.get(e.getKey()))) return false;
			}
			return true;
		}
	}

	/** Welches Messer welche Schwert-Stufe bekommt. */
	private static final String[][] SWORD_KNIVES = {
			{"netherite_sword", "karambit"}, {"diamond_sword", "butterfly"}, {"iron_sword", "m9"},
			{"golden_sword", "talon"}, {"copper_sword", "flip"}, {"stone_sword", "gut"}, {"wooden_sword", "bayonet"},
	};
	private static final String[] MATS = {"wooden", "stone", "copper", "iron", "golden", "diamond", "netherite"};

	private static final List<Pack> PACKS = new ArrayList<>();

	static {
		add("fade", "Fade", "Gelb-Pink-Lila Verlauf – der Klassiker", "fade", "fade", "fade", "he", "vortex", "medishot");
		add("doppler", "Doppler", "Dunkle Klinge mit pinken Wirbeln", "doppler", "doppler", "doppler", "flash", "vortex", "medishot");
		add("ruby", "Ruby", "Tiefrote Doppler-Edelsteinklingen", "ruby", "ruby", "ruby", "incendiary", "lightning", "heart");
		add("sapphire", "Sapphire", "Leuchtend blaue Doppler-Klingen", "sapphire", "sapphire", "sapphire", "flash", "frost", "medishot");
		add("emerald", "Emerald", "Grüne Gamma-Doppler-Klingen", "emerald", "emerald", "emerald", "smoke", "vortex", "medishot");
		add("marble", "Marble Fade", "Feuer und Eis: Rot, Gelb, Blau", "marble_fade", "marble_fade", "marble_fade", "molotov", "lightning", "c4");
		add("tiger", "Tiger Tooth", "Gold mit Tigerstreifen", "tiger_tooth", "tiger_tooth", "tiger_tooth", "molotov", "lightning", "c4");
		add("crimson", "Crimson Web", "Rot mit schwarzem Spinnennetz", "crimson_web", "crimson_web", "crimson_web", "incendiary", "smoke_bomb", "dogtags");
		add("case", "Case Hardened", "Blau-goldener Härtestahl", "case_hardened", "case_hardened", "case_hardened", "he", "frost", "defuse_kit");
		add("slaughter", "Slaughter", "Rote Muster wie Marmor", "slaughter", "slaughter", "dragon", "incendiary", "lightning", "heart");
		add("night", "Night (Stealth)", "Schwarz und unauffällig", "night", "night", "ballistic", "smoke", "smoke_bomb", "dogtags");
		add("lore", "Lore (Gold)", "Goldene Gravuren", "lore", "lore", "spartan", "molotov", "lightning", "c4");
		add("damascus", "Damascus Steel", "Geschmiedeter Wellenstahl", "damascus", "damascus", "crusader", "he", "frost", "defuse_kit");
		add("camo", "Camo", "Tarnmuster wie beim Militär", "forest_ddpat", "night", "wood", "smoke", "smoke_bomb", "dogtags");
	}

	private static void add(String id, String name, String desc, String knifeFinish, String toolFinish, String shield,
			String grenade, String wind, String totem) {
		Map<String, String> m = new LinkedHashMap<>();
		for (String[] sk : SWORD_KNIVES) m.put(sk[0], "knife_" + sk[1] + "_" + knifeFinish);
		for (String mat : MATS) m.put(mat + "_axe", "axe_dz_axe_" + toolFinish);
		m.put("mace", "mace_mjolnir_" + toolFinish);
		for (String mat : MATS) m.put(mat + "_spear", "spear_naginata_" + toolFinish);
		m.put("shield", "shield_" + shield);
		m.put("ender_pearl", "grenade_" + grenade);
		m.put("wind_charge", "wind_" + wind);
		m.put("totem_of_undying", "totem_" + totem);
		// nur Skins, die es wirklich gibt
		m.values().removeIf(v -> v == null);
		PACKS.add(new Pack(id, name, desc, m));
	}

	private SkinPacks() {
	}

	public static List<Pack> all() {
		return PACKS;
	}

	public static void apply(Pack pack) {
		Map<String, String> cur = VantageConfig.get().skins;
		for (Map.Entry<String, String> e : pack.skins().entrySet()) {
			if (SkinCatalog.skin(e.getValue()) != null) cur.put(e.getKey(), e.getValue());
		}
		VantageConfig.save();
	}

	public static void clear() {
		VantageConfig.get().skins.clear();
		VantageConfig.save();
	}
}
