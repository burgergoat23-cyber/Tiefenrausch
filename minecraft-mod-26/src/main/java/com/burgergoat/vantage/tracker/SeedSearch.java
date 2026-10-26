package com.burgergoat.vantage.tracker;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.mixin.SimpleStructurePieceAccessor;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.RegistryAccess;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.data.registries.VanillaRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.packs.PackType;
import net.minecraft.server.packs.repository.ServerPacksSource;
import net.minecraft.server.packs.resources.MultiPackResourceManager;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelHeightAccessor;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.biome.Biomes;
import net.minecraft.world.level.biome.TheEndBiomeSource;
import net.minecraft.world.level.levelgen.NoiseBasedChunkGenerator;
import net.minecraft.world.level.levelgen.NoiseGeneratorSettings;
import net.minecraft.world.level.levelgen.RandomState;
import net.minecraft.world.level.levelgen.structure.BoundingBox;
import net.minecraft.world.level.levelgen.structure.Structure;
import net.minecraft.world.level.levelgen.structure.StructurePiece;
import net.minecraft.world.level.levelgen.structure.StructureStart;
import net.minecraft.world.level.levelgen.structure.TemplateStructurePiece;
import net.minecraft.world.level.levelgen.structure.placement.RandomSpreadStructurePlacement;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplateManager;
import net.minecraft.world.level.storage.LevelStorageSource;
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
	public static boolean supports(ResourceKey<Level> dim, TrackType t) {
		return Level.END.equals(dim) && (t == TrackType.END_CITY || t == TrackType.END_SHIP);
	}

	public static void cancel() {
		RUN.incrementAndGet();
	}

	/** Startet die Suche im Hintergrund. Ergebnisse kommen wie bei der Einzelspieler-Suche im Client-Thread an. */
	public static void start(Minecraft client, long seed, BlockPos center, int radius) {
		int run = RUN.incrementAndGet();
		RegistryAccess drm = client.level.registryAccess();
		EXEC.execute(() -> {
			try {
				find(seed, drm, center, radius, run, (found, done, msg) ->
						Minecraft.getInstance().execute(() -> StructureTracker.onServerResults(Level.END, found, done, msg)));
			} catch (Throwable e) {
				VantageClient.LOG.error("Seed-Suche fehlgeschlagen", e);
				Minecraft.getInstance().execute(() -> StructureTracker.onServerResults(Level.END, new EnumMap<>(TrackType.class), true,
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
	public static Map<TrackType, List<Site>> find(long seed, RegistryAccess drm, BlockPos center, int radius, int run, Sink sink) throws Exception {
		Gen g = gen(seed);
		int spacing = g.placement.spacing();
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
					ChunkPos start = g.placement.getPotentialStructureChunk(seed, (cx + dx) * spacing, (cz + dz) * spacing);
					StructureStart s = g.structure.value().generate(g.structure, Level.END, drm, g.generator, g.biomes, g.noise,
							g.templates, seed, start, 0, g.height, g.biomeOk);
					if (s == null || !s.isValid()) continue;
					BoundingBox ship = null;
					for (StructurePiece piece : s.getPieces()) {
						if (piece instanceof TemplateStructurePiece sp) {
							String tpl = ((SimpleStructurePieceAccessor) sp).vantage$getTemplateIdString();
							if (tpl != null && tpl.contains("ship")) ship = piece.getBoundingBox();
						}
					}
					BoundingBox box = s.getBoundingBox();
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

	private record Gen(long seed, NoiseBasedChunkGenerator generator, TheEndBiomeSource biomes, RandomState noise,
					   Holder<Structure> structure, RandomSpreadStructurePlacement placement,
					   StructureTemplateManager templates, LevelHeightAccessor height, Predicate<Holder<Biome>> biomeOk) {
	}

	private static synchronized Gen gen(long seed) throws Exception {
		Gen g = cached;
		if (g != null && g.seed == seed) return g;
		// Alle Weltgenerierungs-Daten so, wie sie im Spiel eingebaut sind (gleich wie auf jedem Server mit 1.21.11)
		HolderLookup.Provider lookup = VanillaRegistries.createLookup();
		Holder<NoiseGeneratorSettings> settings = lookup.lookupOrThrow(Registries.NOISE_SETTINGS).getOrThrow(NoiseGeneratorSettings.END);
		TheEndBiomeSource biomes = TheEndBiomeSource.create(lookup.lookupOrThrow(Registries.BIOME));
		NoiseBasedChunkGenerator generator = new NoiseBasedChunkGenerator(biomes, settings);
		RandomState noise = RandomState.create(settings.value(), lookup.lookupOrThrow(Registries.NOISE), seed);
		Holder<Structure> city = lookup.lookupOrThrow(Registries.STRUCTURE)
				.getOrThrow(ResourceKey.create(Registries.STRUCTURE, Identifier.withDefaultNamespace("end_city")));
		RandomSpreadStructurePlacement placement = (RandomSpreadStructurePlacement) lookup.lookupOrThrow(Registries.STRUCTURE_SET)
				.getOrThrow(ResourceKey.create(Registries.STRUCTURE_SET, Identifier.withDefaultNamespace("end_cities"))).value().placement();
		Predicate<Holder<Biome>> biomeOk = b -> b.is(Biomes.END_HIGHLANDS) || b.is(Biomes.END_MIDLANDS);
		g = new Gen(seed, generator, biomes, noise, city, placement, templates(), LevelHeightAccessor.create(0, 256), biomeOk);
		cached = g;
		return g;
	}

	/** Bauteile der Endsiedlungen (aus dem Spiel selbst geladen). */
	private static StructureTemplateManager templates() throws Exception {
		if (templates != null) return templates;
		LevelStorageSource storage = LevelStorageSource.createDefault(FabricLoader.getInstance().getGameDir().resolve("vantage-cache"));
		LevelStorageSource.LevelStorageAccess session = storage.validateAndCreateAccess("seed");
		var resources = new MultiPackResourceManager(PackType.SERVER_DATA, List.of(ServerPacksSource.createVanillaPackSource()));
		templates = new StructureTemplateManager(resources, session, Minecraft.getInstance().getFixerUpper(), BuiltInRegistries.BLOCK);
		return templates;
	}
}
