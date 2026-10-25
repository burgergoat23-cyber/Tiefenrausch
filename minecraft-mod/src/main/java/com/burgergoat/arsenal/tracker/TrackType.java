package com.burgergoat.arsenal.tracker;

import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.registry.RegistryKey;
import net.minecraft.world.World;
import org.jetbrains.annotations.Nullable;

/** Alle Strukturen, die der Tracker suchen kann. */
public enum TrackType {
	BASTION("bastion", "Bastionsruine", World.NETHER, "bastion_remnant", 0xFFE8B84A),
	FORTRESS("fortress", "Netherfestung", World.NETHER, "fortress", 0xFFD04848),
	END_CITY("end_city", "Endsiedlung", World.END, "end_city", 0xFFC79BFF),
	END_SHIP("end_ship", "Endschiff (Elytra)", World.END, "end_city", 0xFFFF66E0),
	STRONGHOLD("stronghold", "Festung (Endportal)", World.OVERWORLD, "stronghold", 0xFF9AD0FF),
	ANCIENT_CITY("ancient_city", "Antike Stätte", World.OVERWORLD, "ancient_city", 0xFF3EC6C6),
	TRIAL_CHAMBERS("trial_chambers", "Prüfungskammern", World.OVERWORLD, "trial_chambers", 0xFFE08A3C),
	MONUMENT("monument", "Ozeanmonument", World.OVERWORLD, "monument", 0xFF4FD6B0),
	MANSION("mansion", "Waldanwesen", World.OVERWORLD, "mansion", 0xFF9C6B3C),
	OUTPOST("pillager_outpost", "Plünderer-Außenposten", World.OVERWORLD, "pillager_outpost", 0xFFAAAAAA),
	VILLAGE("village", "Dorf", World.OVERWORLD, "#village", 0xFF7CD95A),
	DESERT_PYRAMID("desert_pyramid", "Wüstentempel", World.OVERWORLD, "desert_pyramid", 0xFFF2D27A),
	JUNGLE_PYRAMID("jungle_pyramid", "Dschungeltempel", World.OVERWORLD, "jungle_pyramid", 0xFF55A040),
	SWAMP_HUT("swamp_hut", "Sumpfhütte", World.OVERWORLD, "swamp_hut", 0xFF6E8B4A),
	SHIPWRECK("shipwreck", "Schiffswrack", World.OVERWORLD, "#shipwreck", 0xFF8FB4D9),
	TRAIL_RUINS("trail_ruins", "Pfadruine", World.OVERWORLD, "trail_ruins", 0xFFC9946A),
	BURIED_TREASURE("buried_treasure", "Vergrabener Schatz", World.OVERWORLD, "buried_treasure", 0xFFFFD700),
	RUINED_PORTAL("ruined_portal", "Portalruine", null, "#ruined_portal", 0xFF9B59FF);

	public final String id;
	public final String label;
	@Nullable
	public final RegistryKey<World> dimension;
	/** Struktur-ID oder #Tag */
	public final String structure;
	public final int color;

	TrackType(String id, String label, @Nullable RegistryKey<World> dimension, String structure, int color) {
		this.id = id;
		this.label = label;
		this.dimension = dimension;
		this.structure = structure;
		this.color = color;
	}

	public boolean fits(RegistryKey<World> dim) {
		return dimension == null || dimension.equals(dim);
	}

	@Nullable
	public static TrackType byId(String id) {
		for (TrackType t : values()) if (t.id.equals(id)) return t;
		return null;
	}

	/** Typischer Block, an dem man die Struktur in geladenen Chunks erkennt (Server-Modus). */
	@Nullable
	public static TrackType marker(Block b) {
		if (b == Blocks.GILDED_BLACKSTONE) return BASTION;
		if (b == Blocks.NETHER_BRICK_FENCE) return FORTRESS;
		if (b == Blocks.DRAGON_HEAD || b == Blocks.DRAGON_WALL_HEAD) return END_SHIP;
		if (b == Blocks.PURPUR_PILLAR || b == Blocks.PURPUR_BLOCK) return END_CITY;
		if (b == Blocks.BELL) return VILLAGE;
		if (b == Blocks.DARK_PRISMARINE) return MONUMENT;
		if (b == Blocks.CRYING_OBSIDIAN) return RUINED_PORTAL;
		return null;
	}
}
