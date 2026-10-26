package com.burgergoat.vantage.tracker;

import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import org.jetbrains.annotations.Nullable;

/** Alle Strukturen, die der Tracker suchen kann. */
public enum TrackType {
	BASTION("bastion", "Bastionsruine", Level.NETHER, "bastion_remnant", 0xFFE8B84A, 48, 30),
	FORTRESS("fortress", "Netherfestung", Level.NETHER, "fortress", 0xFFD04848, 48, 20),
	END_CITY("end_city", "Endsiedlung", Level.END, "end_city", 0xFFC79BFF, 40, 50),
	END_SHIP("end_ship", "Endschiff", Level.END, "end_city", 0xFFFF66E0, 30, 20),
	STRONGHOLD("stronghold", "Festung (Endportal)", Level.OVERWORLD, "stronghold", 0xFF9AD0FF, 48, 24),
	ANCIENT_CITY("ancient_city", "Antike Stätte", Level.OVERWORLD, "ancient_city", 0xFF3EC6C6, 64, 24),
	TRIAL_CHAMBERS("trial_chambers", "Prüfungskammern", Level.OVERWORLD, "trial_chambers", 0xFFE08A3C, 40, 20),
	MONUMENT("monument", "Ozeanmonument", Level.OVERWORLD, "monument", 0xFF4FD6B0, 40, 25),
	MANSION("mansion", "Waldanwesen", Level.OVERWORLD, "mansion", 0xFF9C6B3C, 48, 24),
	OUTPOST("pillager_outpost", "Plünderer-Außenposten", Level.OVERWORLD, "pillager_outpost", 0xFFAAAAAA, 16, 24),
	VILLAGE("village", "Dorf", Level.OVERWORLD, "#village", 0xFF7CD95A, 48, 16),
	DESERT_PYRAMID("desert_pyramid", "Wüstentempel", Level.OVERWORLD, "desert_pyramid", 0xFFF2D27A, 14, 20),
	JUNGLE_PYRAMID("jungle_pyramid", "Dschungeltempel", Level.OVERWORLD, "jungle_pyramid", 0xFF55A040, 14, 14),
	SWAMP_HUT("swamp_hut", "Sumpfhütte", Level.OVERWORLD, "swamp_hut", 0xFF6E8B4A, 8, 8),
	SHIPWRECK("shipwreck", "Schiffswrack", Level.OVERWORLD, "#shipwreck", 0xFF8FB4D9, 16, 10),
	TRAIL_RUINS("trail_ruins", "Pfadruine", Level.OVERWORLD, "trail_ruins", 0xFFC9946A, 20, 12),
	BURIED_TREASURE("buried_treasure", "Vergrabener Schatz", Level.OVERWORLD, "buried_treasure", 0xFFFFD700, 4, 4),
	RUINED_PORTAL("ruined_portal", "Portalruine", null, "#ruined_portal", 0xFF9B59FF, 12, 10);

	public final String id;
	public final String label;
	@Nullable
	public final ResourceKey<Level> dimension;
	/** Struktur-ID oder #Tag */
	public final String structure;
	public final int color;
	/** Geschaetzte Groesse, wenn der genaue Umriss unbekannt ist (Server-Modus). */
	public final int scanRadius;
	public final int scanHeight;

	TrackType(String id, String label, @Nullable ResourceKey<Level> dimension, String structure, int color, int scanRadius, int scanHeight) {
		this.id = id;
		this.label = label;
		this.dimension = dimension;
		this.structure = structure;
		this.color = color;
		this.scanRadius = scanRadius;
		this.scanHeight = scanHeight;
	}

	public boolean fits(ResourceKey<Level> dim) {
		return dimension == null || dimension.equals(dim);
	}

	@Nullable
	public static TrackType byId(String id) {
		for (TrackType t : values()) if (t.id.equals(id)) return t;
		return null;
	}

	/** Alle Typen, die es in dieser Dimension gibt (Reihenfolge wie oben). */
	public static TrackType[] forDimension(ResourceKey<Level> dim) {
		return java.util.Arrays.stream(values()).filter(t -> t.fits(dim)).toArray(TrackType[]::new);
	}

	public ItemStack icon() {
		Item item = switch (this) {
			case BASTION -> Items.GILDED_BLACKSTONE;
			case FORTRESS -> Items.NETHER_BRICKS;
			case END_CITY -> Items.PURPUR_BLOCK;
			case END_SHIP -> Items.ELYTRA;
			case STRONGHOLD -> Items.END_PORTAL_FRAME;
			case ANCIENT_CITY -> Items.SCULK_SHRIEKER;
			case TRIAL_CHAMBERS -> Items.TRIAL_KEY;
			case MONUMENT -> Items.PRISMARINE_BRICKS;
			case MANSION -> Items.TOTEM_OF_UNDYING;
			case OUTPOST -> Items.CROSSBOW;
			case VILLAGE -> Items.BELL;
			case DESERT_PYRAMID -> Items.CHISELED_SANDSTONE;
			case JUNGLE_PYRAMID -> Items.MOSSY_COBBLESTONE;
			case SWAMP_HUT -> Items.CAULDRON;
			case SHIPWRECK -> Items.OAK_BOAT;
			case TRAIL_RUINS -> Items.BRUSH;
			case BURIED_TREASURE -> Items.HEART_OF_THE_SEA;
			case RUINED_PORTAL -> Items.CRYING_OBSIDIAN;
		};
		return new ItemStack(item);
	}

	/** Typischer Block, an dem man die Struktur in geladenen Chunks erkennt (Server-Modus). */
	@Nullable
	public static TrackType marker(Block b) {
		if (b == Blocks.GILDED_BLACKSTONE) return BASTION;
		if (b == Blocks.NETHER_BRICK_FENCE) return FORTRESS;
		// Im Ende gibt es Drachenkoepfe und Braustaende nur auf den Schiffen
		if (b == Blocks.DRAGON_HEAD || b == Blocks.DRAGON_WALL_HEAD || b == Blocks.BREWING_STAND) return END_SHIP;
		if (b == Blocks.PURPUR_PILLAR || b == Blocks.PURPUR_BLOCK) return END_CITY;
		if (b == Blocks.END_PORTAL_FRAME) return STRONGHOLD;
		if (b == Blocks.REINFORCED_DEEPSLATE) return ANCIENT_CITY;
		if (b == Blocks.VAULT) return TRIAL_CHAMBERS;
		if (b == Blocks.BELL) return VILLAGE;
		if (b == Blocks.DARK_PRISMARINE) return MONUMENT;
		if (b == Blocks.CRYING_OBSIDIAN) return RUINED_PORTAL;
		return null;
	}
}
