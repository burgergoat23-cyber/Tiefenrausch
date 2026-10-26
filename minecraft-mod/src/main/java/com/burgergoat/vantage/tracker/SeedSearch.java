package com.burgergoat.vantage.tracker;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.mixin.SimpleStructurePieceAccessor;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.registry.BuiltinRegistries;
import net.minecraft.registry.DynamicRegistryManager;
import net.minecraft.registry.Registries;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.registry.RegistryWrapper;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.resource.LifecycledResourceManagerImpl;
import net.minecraft.resource.ResourceType;
import net.minecraft.resource.VanillaDataPackProvider;
import net.minecraft.structure.SimpleStructurePiece;
import net.minecraft.structure.StructurePiece;
import net.minecraft.structure.StructureStart;
import net.minecraft.structure.StructureTemplateManager;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockBox;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.HeightLimitView;
import net.minecraft.world.World;
import net.minecraft.world.biome.Biome;
import net.minecraft.world.biome.BiomeKeys;
import net.minecraft.world.biome.source.TheEndBiomeSource;
import net.minecraft.world.gen.chunk.ChunkGeneratorSettings;
import net.minecraft.world.gen.chunk.NoiseChunkGenerator;
import net.minecraft.world.gen.chunk.placement.RandomSpreadStructurePlacement;
import net.minecraft.world.gen.noise.NoiseConfig;
import net.minecraft.world.gen.structure.Structure;
import net.minecraft.world.level.storage.LevelStorage;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;

/**
 * Suche mit bekanntem Seed (fuer den eigenen Server, z. B. auf Aternos): rechnet mit der Weltgenerierung des
 * Spiels selbst aus, wo Endsiedlungen stehen und welche ein Schiff haben – auch weit ausserhalb der Sichtweite.
 * Funktioniert nur mit dem echten Seed der Welt (Aternos-Panel oder Befehl /seed). Kein Seed-Knacken.
 */
public final class SeedSearch {
	private static final int MAX_RESULTS = 8;
	private static final ExecutorService EXEC = Executors.newSingleThreadExecutor(r -> {
		Thread t = new Thread(r, "Vantage-Seed");
		t.setDaemon(true);
		t.setPriority(Thread.MIN_PRIORITY);
		return t;
	});
	private static final AtomicInteger RUN = new AtomicInteger();
	private static volatile Gen cached;
	private static StructureTemplateManager templates;

	private SeedSearch() {
	}

	/** Mit Seed geht bisher das Ende (Endsiedlungen und Endschiffe). */
	public static boolean supports(RegistryKey<World> dim, TrackType t) {
		return World.END.equals(dim) && (t == TrackType.END_CITY || t == TrackType.END_SHIP);
	}

	public static void cancel() {
		RUN.incrementAndGet();
	}

	/** Startet die Suche im Hintergrund. Ergebnisse kommen wie bei der Einzelspieler-Suche im Client-Thread an. */
	public static void start(MinecraftClient client, long seed, BlockPos center, int radius) {
		int run = RUN.incrementAndGet();
		DynamicRegistryManager drm = client.world.getRegistryManager();
		EXEC.execute(() -> {
			try {
				find(seed, drm, center, radius, run, (found, done, msg) ->
						MinecraftClient.getInstance().execute(() -> StructureTracker.onServerResults(World.END, found, done, msg)));
			} catch (Throwable e) {
				VantageClient.LOG.error("Seed-Suche fehlgeschlagen", e);
				MinecraftClient.getInstance().execute(() -> StructureTracker.onServerResults(World.END, new EnumMap<>(TrackType.class), true,
						"Seed-Suche fehlgeschlagen (siehe Log)"));
			}
		});
	}

	public interface Sink {
		void accept(Map<TrackType, List<Site>> found, boolean done, String msg);
	}

	/**
	 * Die eigentliche Suche (laeuft im Hintergrund-Thread, fuer den Test auch direkt aufrufbar).
	 * Geht ringfoermig die Regionen um {@code center} ab, genau wie das Spiel die Endsiedlungen verteilt.
	 */
	public static Map<TrackType, List<Site>> find(long seed, DynamicRegistryManager drm, BlockPos center, int radius, int run, Sink sink) throws Exception {
		Gen g = gen(seed);
		int spacing = g.placement.getSpacing();
		int cx = Math.floorDiv(center.getX() >> 4, spacing);
		int cz = Math.floorDiv(center.getZ() >> 4, spacing);
		int maxRing = Math.max(1, (int) Math.ceil(radius / (spacing * 16.0)));
		List<Site> cities = new ArrayList<>();
		List<Site> ships = new ArrayList<>();
		long lastReport = System.currentTimeMillis();
		for (int ring = 0; ring <= maxRing; ring++) {
			// Genug Schiffe gefunden und der naechste Ring ist sicher weiter weg -> fertig
			if (ships.size() >= MAX_RESULTS) {
				double ringMin = (ring - 1) * spacing * 16.0;
				List<Double> d = new ArrayList<>();
				for (Site s : ships) d.add(dist2(s.pos(), center));
				d.sort(Double::compare);
				if (ringMin * ringMin > d.get(MAX_RESULTS - 1)) break;
			}
			for (int dx = -ring; dx <= ring; dx++) {
				for (int dz = -ring; dz <= ring; dz++) {
					if (Math.max(Math.abs(dx), Math.abs(dz)) != ring) continue;
					if (run != 0 && RUN.get() != run) return Map.of();
					ChunkPos start = g.placement.getStartChunk(seed, (cx + dx) * spacing, (cz + dz) * spacing);
					StructureStart s = g.structure.value().createStructureStart(g.structure, World.END, drm, g.generator, g.biomes, g.noise,
							g.templates, seed, start, 0, g.height, g.biomeOk);
					if (s == null || !s.hasChildren()) continue;
					BlockBox ship = null;
					for (StructurePiece piece : s.getChildren()) {
						if (piece instanceof SimpleStructurePiece sp) {
							String tpl = ((SimpleStructurePieceAccessor) sp).vantage$getTemplateIdString();
							if (tpl != null && tpl.contains("ship")) ship = piece.getBoundingBox();
						}
					}
					BlockBox box = s.getBoundingBox();
					cities.add(new Site(TrackType.END_CITY, box.getCenter(), box, ship));
					if (ship != null) ships.add(new Site(TrackType.END_SHIP, ship.getCenter(), ship, null));
				}
			}
			long now = System.currentTimeMillis();
			if (sink != null && now - lastReport > 500) {
				lastReport = now;
				int pct = Math.round(100f * (ring + 1) / (maxRing + 1));
				sink.accept(result(cities, ships, center), false, "Suche mit Seed … " + pct + " %");
			}
		}
		Map<TrackType, List<Site>> out = result(cities, ships, center);
		if (sink != null) sink.accept(out, true, "Fertig");
		return out;
	}

	private static Map<TrackType, List<Site>> result(List<Site> cities, List<Site> ships, BlockPos center) {
		Map<TrackType, List<Site>> out = new EnumMap<>(TrackType.class);
		out.put(TrackType.END_CITY, nearest(cities, center));
		out.put(TrackType.END_SHIP, nearest(ships, center));
		return out;
	}

	private static List<Site> nearest(List<Site> list, BlockPos center) {
		List<Site> l = new ArrayList<>(list);
		l.sort(Comparator.comparingDouble(s -> dist2(s.pos(), center)));
		return l.size() > MAX_RESULTS ? new ArrayList<>(l.subList(0, MAX_RESULTS)) : l;
	}

	private static double dist2(BlockPos p, BlockPos c) {
		double dx = p.getX() - c.getX();
		double dz = p.getZ() - c.getZ();
		return dx * dx + dz * dz;
	}

	// ------------------------------------------------------------------ Weltgenerierung des Endes nachbauen

	private record Gen(long seed, NoiseChunkGenerator generator, TheEndBiomeSource biomes, NoiseConfig noise,
					   RegistryEntry<Structure> structure, RandomSpreadStructurePlacement placement,
					   StructureTemplateManager templates, HeightLimitView height, Predicate<RegistryEntry<Biome>> biomeOk) {
	}

	private static synchronized Gen gen(long seed) throws Exception {
		Gen g = cached;
		if (g != null && g.seed == seed) return g;
		// Alle Weltgenerierungs-Daten so, wie sie im Spiel eingebaut sind (gleich wie auf jedem Server mit 1.21.11)
		RegistryWrapper.WrapperLookup lookup = BuiltinRegistries.createWrapperLookup();
		RegistryEntry<ChunkGeneratorSettings> settings = lookup.getWrapperOrThrow(RegistryKeys.CHUNK_GENERATOR_SETTINGS).getOrThrow(ChunkGeneratorSettings.END);
		TheEndBiomeSource biomes = TheEndBiomeSource.createVanilla(lookup.getWrapperOrThrow(RegistryKeys.BIOME));
		NoiseChunkGenerator generator = new NoiseChunkGenerator(biomes, settings);
		NoiseConfig noise = NoiseConfig.create(settings.value(), lookup.getWrapperOrThrow(RegistryKeys.NOISE_PARAMETERS), seed);
		RegistryEntry<Structure> city = lookup.getWrapperOrThrow(RegistryKeys.STRUCTURE)
				.getOrThrow(RegistryKey.of(RegistryKeys.STRUCTURE, Identifier.ofVanilla("end_city")));
		RandomSpreadStructurePlacement placement = (RandomSpreadStructurePlacement) lookup.getWrapperOrThrow(RegistryKeys.STRUCTURE_SET)
				.getOrThrow(RegistryKey.of(RegistryKeys.STRUCTURE_SET, Identifier.ofVanilla("end_cities"))).value().placement();
		Predicate<RegistryEntry<Biome>> biomeOk = b -> b.matchesKey(BiomeKeys.END_HIGHLANDS) || b.matchesKey(BiomeKeys.END_MIDLANDS);
		g = new Gen(seed, generator, biomes, noise, city, placement, templates(), HeightLimitView.create(0, 256), biomeOk);
		cached = g;
		return g;
	}

	/** Bauteile der Endsiedlungen (aus dem Spiel selbst geladen). */
	private static StructureTemplateManager templates() throws Exception {
		if (templates != null) return templates;
		LevelStorage storage = LevelStorage.create(FabricLoader.getInstance().getGameDir().resolve("vantage-cache"));
		LevelStorage.Session session = storage.createSession("seed");
		var resources = new LifecycledResourceManagerImpl(ResourceType.SERVER_DATA, List.of(VanillaDataPackProvider.createDefaultPack()));
		templates = new StructureTemplateManager(resources, session, MinecraftClient.getInstance().getDataFixer(), Registries.BLOCK);
		return templates;
	}
}
