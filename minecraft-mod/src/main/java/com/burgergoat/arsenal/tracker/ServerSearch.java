package com.burgergoat.arsenal.tracker;

import com.burgergoat.arsenal.ArsenalClient;
import com.burgergoat.arsenal.mixin.SimpleStructurePieceAccessor;
import com.mojang.datafixers.util.Pair;
import net.minecraft.client.MinecraftClient;
import net.minecraft.registry.RegistryEntryLookup;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.registry.entry.RegistryEntryList;
import net.minecraft.registry.tag.TagKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.world.ServerChunkManager;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.structure.SimpleStructurePiece;
import net.minecraft.structure.StructurePiece;
import net.minecraft.structure.StructureStart;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.World;
import net.minecraft.world.chunk.Chunk;
import net.minecraft.world.chunk.ChunkStatus;
import net.minecraft.world.gen.chunk.ChunkGenerator;
import net.minecraft.world.gen.chunk.placement.RandomSpreadStructurePlacement;
import net.minecraft.world.gen.chunk.placement.StructurePlacement;
import net.minecraft.world.gen.chunk.placement.StructurePlacementCalculator;
import net.minecraft.world.gen.structure.Structure;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Suche im Einzelspieler: laeuft auf dem eingebauten Server und kennt deshalb die ganze Welt
 * (auch weit ausserhalb der Sichtweite) - genau wie der Befehl /locate. Pro Server-Tick wird
 * nur ein kleines Stueck gesucht, damit das Spiel nicht ruckelt.
 */
public final class ServerSearch {
	public static final int MAX_RESULTS = 4;
	private static Job job;

	private ServerSearch() {
	}

	/** Vom Client aufrufen. Die eigentliche Arbeit passiert im Server-Thread. */
	public static void start(MinecraftServer server, RegistryKey<World> dim, BlockPos center, Set<TrackType> types, int radius) {
		List<TrackType> list = new ArrayList<>(types);
		server.execute(() -> {
			ServerWorld world = server.getWorld(dim);
			if (world == null) return;
			try {
				job = new Job(world, center, list, radius);
			} catch (Exception e) {
				ArsenalClient.LOG.error("Tracker-Suche konnte nicht starten", e);
				job = null;
				MinecraftClient.getInstance().execute(() -> StructureTracker.onServerResults(dim, new EnumMap<>(TrackType.class), true, "Fehler bei der Suche"));
			}
		});
	}

	public static void cancel(MinecraftServer server) {
		server.execute(() -> job = null);
	}

	/** Wird jeden Server-Tick aufgerufen (ServerTickEvents). */
	public static void serverTick(MinecraftServer server) {
		Job j = job;
		if (j == null) return;
		if (j.world.getServer() != server) {
			job = null;
			return;
		}
		try {
			if (j.step(6_000_000L)) job = null;
		} catch (Exception e) {
			ArsenalClient.LOG.error("Tracker-Suche abgebrochen", e);
			job = null;
		}
	}

	private interface Part {
		/** @return true wenn fertig */
		boolean step();

		double progress();
	}

	private static final class Job {
		final ServerWorld world;
		final BlockPos center;
		final ChunkGenerator generator;
		final StructurePlacementCalculator calculator;
		final RegistryEntryLookup<Structure> structures;
		final ArrayDeque<Part> parts = new ArrayDeque<>();
		final int totalParts;
		final Map<TrackType, List<BlockPos>> found = new EnumMap<>(TrackType.class);
		final int radius;
		long lastReport;

		Job(ServerWorld world, BlockPos center, List<TrackType> types, int radius) {
			this.world = world;
			this.center = center;
			this.radius = radius;
			ServerChunkManager cm = (ServerChunkManager) world.getChunkManager();
			this.generator = cm.getChunkGenerator();
			this.calculator = cm.getStructurePlacementCalculator();
			this.structures = world.getRegistryManager().getOrThrow(RegistryKeys.STRUCTURE);
			boolean city = types.contains(TrackType.END_CITY);
			boolean ship = types.contains(TrackType.END_SHIP);
			for (TrackType t : types) {
				if (t == TrackType.END_SHIP && city) continue; // wird zusammen mit END_CITY gesucht
				found.put(t, new ArrayList<>());
				for (RegistryEntry<Structure> entry : entries(t)) {
					addParts(t, entry, t == TrackType.END_CITY && ship);
				}
			}
			if (ship) found.put(TrackType.END_SHIP, found.getOrDefault(TrackType.END_SHIP, new ArrayList<>()));
			if (city) found.putIfAbsent(TrackType.END_CITY, new ArrayList<>());
			totalParts = Math.max(1, parts.size());
		}

		List<RegistryEntry<Structure>> entries(TrackType t) {
			List<RegistryEntry<Structure>> out = new ArrayList<>();
			if (t.structure.startsWith("#")) {
				TagKey<Structure> tag = TagKey.of(RegistryKeys.STRUCTURE, Identifier.ofVanilla(t.structure.substring(1)));
				structures.getOptional(tag).ifPresent(list -> {
					for (RegistryEntry<Structure> e : list) out.add(e);
				});
			} else {
				structures.getOptional(RegistryKey.of(RegistryKeys.STRUCTURE, Identifier.ofVanilla(t.structure))).ifPresent(out::add);
			}
			return out;
		}

		void addParts(TrackType type, RegistryEntry<Structure> entry, boolean alsoShip) {
			List<StructurePlacement> placements = calculator.getPlacements(entry);
			boolean added = false;
			for (StructurePlacement p : placements) {
				if (p instanceof RandomSpreadStructurePlacement rs && rs.getSpacing() >= 8) {
					parts.add(new SpreadPart(type, entry, rs, alsoShip));
					added = true;
				}
			}
			if (!added && !placements.isEmpty()) {
				parts.add(new LocatePart(type, entry));
			}
		}

		boolean step(long budgetNanos) {
			long t0 = System.nanoTime();
			while (!parts.isEmpty() && System.nanoTime() - t0 < budgetNanos) {
				if (parts.peek().step()) parts.poll();
			}
			if (parts.isEmpty()) {
				deliver(true);
				return true;
			}
			long now = System.currentTimeMillis();
			if (now - lastReport > 400) {
				lastReport = now;
				deliver(false);
			}
			return false;
		}

		void deliver(boolean done) {
			Map<TrackType, List<BlockPos>> copy = new EnumMap<>(TrackType.class);
			for (Map.Entry<TrackType, List<BlockPos>> e : found.entrySet()) {
				List<BlockPos> l = new ArrayList<>(e.getValue());
				l.sort(Comparator.comparingDouble(p -> dist2(p)));
				if (l.size() > MAX_RESULTS) l = new ArrayList<>(l.subList(0, MAX_RESULTS));
				copy.put(e.getKey(), l);
			}
			double prog = 1.0 - (parts.size() - (parts.isEmpty() ? 0 : 1 - parts.peek().progress())) / totalParts;
			String msg = done ? "Fertig" : "Suche läuft … " + Math.round(Math.max(0, Math.min(1, prog)) * 100) + " %";
			RegistryKey<World> dim = world.getRegistryKey();
			MinecraftClient.getInstance().execute(() -> StructureTracker.onServerResults(dim, copy, done, msg));
		}

		double dist2(BlockPos p) {
			double dx = p.getX() - center.getX();
			double dz = p.getZ() - center.getZ();
			return dx * dx + dz * dz;
		}

		void add(TrackType type, BlockPos pos) {
			List<BlockPos> l = found.computeIfAbsent(type, k -> new ArrayList<>());
			for (BlockPos q : l) if (q.getSquaredDistance(pos) < 64 * 64) return;
			l.add(pos);
		}

		/** Sucht ringfoermig die moeglichen Startpunkte einer Struktur ab (wie das Spiel selbst). */
		final class SpreadPart implements Part {
			final TrackType type;
			final RegistryEntry<Structure> entry;
			final RandomSpreadStructurePlacement placement;
			final boolean alsoShip;
			final int spacing;
			final int cx;
			final int cz;
			final int maxRing;
			int ring;
			final List<int[]> cells = new ArrayList<>();
			int index;
			int hits;
			double bestNeeded = Double.MAX_VALUE;

			SpreadPart(TrackType type, RegistryEntry<Structure> entry, RandomSpreadStructurePlacement placement, boolean alsoShip) {
				this.type = type;
				this.entry = entry;
				this.placement = placement;
				this.alsoShip = alsoShip;
				this.spacing = placement.getSpacing();
				this.cx = Math.floorDiv(center.getX() >> 4, spacing);
				this.cz = Math.floorDiv(center.getZ() >> 4, spacing);
				this.maxRing = Math.max(1, (int) Math.ceil(radius / (spacing * 16.0)));
				fillRing();
			}

			void fillRing() {
				cells.clear();
				index = 0;
				if (ring == 0) {
					cells.add(new int[]{cx, cz});
					return;
				}
				for (int dx = -ring; dx <= ring; dx++) {
					for (int dz = -ring; dz <= ring; dz++) {
						if (Math.max(Math.abs(dx), Math.abs(dz)) == ring) cells.add(new int[]{cx + dx, cz + dz});
					}
				}
			}

			@Override
			public double progress() {
				return Math.min(1.0, ring / (double) (maxRing + 1));
			}

			@Override
			public boolean step() {
				if (index >= cells.size()) {
					ring++;
					if (ring > maxRing) return true;
					// Genug Treffer und der naechste Ring ist sicher weiter weg -> fertig
					double ringMin = (ring - 1) * spacing * 16.0;
					if (hits >= 3 && ringMin * ringMin > bestNeeded) return true;
					fillRing();
				}
				int[] c = cells.get(index++);
				ChunkPos start = placement.getStartChunk(calculator.getStructureSeed(), c[0], c[1]);
				if (!placement.shouldGenerate(calculator, start.x, start.z)) return false;
				Chunk chunk = world.getChunk(start.x, start.z, ChunkStatus.STRUCTURE_STARTS, true);
				if (chunk == null) return false;
				StructureStart s = chunk.getStructureStart(entry.value());
				if (s == null || !s.hasChildren()) return false;
				boolean wantCity = type != TrackType.END_SHIP;
				if (wantCity) add(type, s.getBoundingBox().getCenter());
				if (type == TrackType.END_SHIP || alsoShip) {
					for (StructurePiece piece : s.getChildren()) {
						if (piece instanceof SimpleStructurePiece sp) {
							String tpl = ((SimpleStructurePieceAccessor) sp).arsenal$getTemplateIdString();
							if (tpl != null && tpl.contains("ship")) {
								add(TrackType.END_SHIP, piece.getBoundingBox().getCenter());
								break;
							}
						}
					}
				}
				List<BlockPos> mine = found.get(type == TrackType.END_SHIP || (alsoShip && !wantCity) ? TrackType.END_SHIP : type);
				if (mine != null) {
					hits = mine.size();
					if (hits >= 3) {
						List<Double> d = new ArrayList<>();
						for (BlockPos p : mine) d.add(dist2(p));
						d.sort(Double::compare);
						bestNeeded = d.get(2);
					}
				}
				if (alsoShip) {
					// Bei Endsiedlung + Schiff erst aufhoeren, wenn auch Schiffe gefunden wurden
					List<BlockPos> ships = found.get(TrackType.END_SHIP);
					if (ships == null || ships.size() < 2) bestNeeded = Double.MAX_VALUE;
				}
				return false;
			}
		}

		/** Fuer Strukturen ohne Raster (z. B. Festungen): normale /locate-Suche. */
		final class LocatePart implements Part {
			final TrackType type;
			final RegistryEntry<Structure> entry;

			LocatePart(TrackType type, RegistryEntry<Structure> entry) {
				this.type = type;
				this.entry = entry;
			}

			@Override
			public double progress() {
				return 0;
			}

			@Override
			public boolean step() {
				Pair<BlockPos, RegistryEntry<Structure>> r = generator.locateStructure(world, RegistryEntryList.of(entry), center, 100, false);
				if (r != null) add(type, r.getFirst());
				return true;
			}
		}
	}
}
