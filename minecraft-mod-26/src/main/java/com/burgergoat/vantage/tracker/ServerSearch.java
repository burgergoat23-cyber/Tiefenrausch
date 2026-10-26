package com.burgergoat.vantage.tracker;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.mixin.SimpleStructurePieceAccessor;
import com.mojang.datafixers.util.Pair;
import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.HolderGetter;
import net.minecraft.core.HolderSet;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerChunkCache;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.tags.TagKey;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.chunk.ChunkAccess;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.chunk.ChunkGeneratorStructureState;
import net.minecraft.world.level.chunk.status.ChunkStatus;
import net.minecraft.world.level.levelgen.structure.BoundingBox;
import net.minecraft.world.level.levelgen.structure.Structure;
import net.minecraft.world.level.levelgen.structure.StructurePiece;
import net.minecraft.world.level.levelgen.structure.StructureStart;
import net.minecraft.world.level.levelgen.structure.TemplateStructurePiece;
import net.minecraft.world.level.levelgen.structure.pieces.StructurePieceType;
import net.minecraft.world.level.levelgen.structure.placement.RandomSpreadStructurePlacement;
import net.minecraft.world.level.levelgen.structure.placement.StructurePlacement;
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
	public static final int MAX_RESULTS = 6;
	private static Job job;

	private ServerSearch() {
	}

	/** Vom Client aufrufen. Die eigentliche Arbeit passiert im Server-Thread. */
	public static void start(MinecraftServer server, ResourceKey<Level> dim, BlockPos center, Set<TrackType> types, int radius) {
		List<TrackType> list = new ArrayList<>(types);
		server.execute(() -> {
			ServerLevel world = server.getLevel(dim);
			if (world == null) return;
			try {
				job = new Job(world, center, list, radius);
			} catch (Exception e) {
				VantageClient.LOG.error("Tracker-Suche konnte nicht starten", e);
				job = null;
				Minecraft.getInstance().execute(() -> StructureTracker.onServerResults(dim, new EnumMap<>(TrackType.class), true, "Fehler bei der Suche"));
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
			VantageClient.LOG.error("Tracker-Suche abgebrochen", e);
			job = null;
		}
	}

	private interface Part {
		/** @return true wenn fertig */
		boolean step();

		double progress();
	}

	private static final class Job {
		final ServerLevel world;
		final BlockPos center;
		final ChunkGenerator generator;
		final ChunkGeneratorStructureState calculator;
		final HolderGetter<Structure> structures;
		final ArrayDeque<Part> parts = new ArrayDeque<>();
		final int totalParts;
		final Map<TrackType, List<Site>> found = new EnumMap<>(TrackType.class);
		final int radius;
		long lastReport;

		Job(ServerLevel world, BlockPos center, List<TrackType> types, int radius) {
			this.world = world;
			this.center = center;
			this.radius = radius;
			ServerChunkCache cm = (ServerChunkCache) world.getChunkSource();
			this.generator = cm.getGenerator();
			this.calculator = cm.getGeneratorState();
			this.structures = world.registryAccess().lookupOrThrow(Registries.STRUCTURE);
			boolean city = types.contains(TrackType.END_CITY);
			boolean ship = types.contains(TrackType.END_SHIP);
			for (TrackType t : types) {
				if (t == TrackType.END_SHIP && city) continue; // wird zusammen mit END_CITY gesucht
				found.put(t, new ArrayList<>());
				for (Holder<Structure> entry : entries(t)) {
					addParts(t, entry, t == TrackType.END_CITY && ship);
				}
			}
			if (ship) found.put(TrackType.END_SHIP, found.getOrDefault(TrackType.END_SHIP, new ArrayList<>()));
			if (city) found.putIfAbsent(TrackType.END_CITY, new ArrayList<>());
			totalParts = Math.max(1, parts.size());
		}

		List<Holder<Structure>> entries(TrackType t) {
			List<Holder<Structure>> out = new ArrayList<>();
			if (t.structure.startsWith("#")) {
				TagKey<Structure> tag = TagKey.create(Registries.STRUCTURE, Identifier.withDefaultNamespace(t.structure.substring(1)));
				structures.get(tag).ifPresent(list -> {
					for (Holder<Structure> e : list) out.add(e);
				});
			} else {
				structures.get(ResourceKey.create(Registries.STRUCTURE, Identifier.withDefaultNamespace(t.structure))).ifPresent(out::add);
			}
			return out;
		}

		void addParts(TrackType type, Holder<Structure> entry, boolean alsoShip) {
			List<StructurePlacement> placements = calculator.getPlacementsForStructure(entry);
			boolean added = false;
			for (StructurePlacement p : placements) {
				if (p instanceof RandomSpreadStructurePlacement rs && rs.spacing() >= 8) {
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
			Map<TrackType, List<Site>> copy = new EnumMap<>(TrackType.class);
			for (Map.Entry<TrackType, List<Site>> e : found.entrySet()) {
				List<Site> l = new ArrayList<>(e.getValue());
				l.sort(Comparator.comparingDouble(p -> dist2(p.pos())));
				if (l.size() > MAX_RESULTS) l = new ArrayList<>(l.subList(0, MAX_RESULTS));
				copy.put(e.getKey(), l);
			}
			double prog = 1.0 - (parts.size() - (parts.isEmpty() ? 0 : 1 - parts.peek().progress())) / totalParts;
			String msg = done ? "Fertig" : "Suche läuft … " + Math.round(Math.max(0, Math.min(1, prog)) * 100) + " %";
			ResourceKey<Level> dim = world.dimension();
			Minecraft.getInstance().execute(() -> StructureTracker.onServerResults(dim, copy, done, msg));
		}

		double dist2(BlockPos p) {
			double dx = p.getX() - center.getX();
			double dz = p.getZ() - center.getZ();
			return dx * dx + dz * dz;
		}

		void add(Site site) {
			List<Site> l = found.computeIfAbsent(site.type(), k -> new ArrayList<>());
			for (Site q : l) if (q.pos().distSqr(site.pos()) < 64 * 64) return;
			l.add(site);
		}

		/** Fundort aus einem Strukturstart: Umriss + wichtiger Teil (Schiff, Portalraum). */
		void addStart(TrackType type, StructureStart s, boolean alsoShip) {
			BoundingBox ship = null;
			BoundingBox portalRoom = null;
			for (StructurePiece piece : s.getPieces()) {
				if (piece instanceof TemplateStructurePiece sp && (type == TrackType.END_CITY || type == TrackType.END_SHIP)) {
					String tpl = ((SimpleStructurePieceAccessor) sp).vantage$getTemplateIdString();
					if (tpl != null && tpl.contains("ship")) ship = piece.getBoundingBox();
				}
				if (piece.getType() == StructurePieceType.STRONGHOLD_PORTAL_ROOM) portalRoom = piece.getBoundingBox();
			}
			BoundingBox box = s.getBoundingBox();
			if (type == TrackType.END_SHIP) {
				if (ship != null) add(new Site(TrackType.END_SHIP, ship.getCenter(), ship, null));
				return;
			}
			if (type == TrackType.STRONGHOLD && portalRoom != null) {
				add(new Site(type, portalRoom.getCenter(), box, portalRoom));
				return;
			}
			add(new Site(type, box.getCenter(), box, type == TrackType.END_CITY ? ship : null));
			if (alsoShip && ship != null) add(new Site(TrackType.END_SHIP, ship.getCenter(), ship, null));
		}

		/** Sucht ringfoermig die moeglichen Startpunkte einer Struktur ab (wie das Spiel selbst). */
		final class SpreadPart implements Part {
			final TrackType type;
			final Holder<Structure> entry;
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

			SpreadPart(TrackType type, Holder<Structure> entry, RandomSpreadStructurePlacement placement, boolean alsoShip) {
				this.type = type;
				this.entry = entry;
				this.placement = placement;
				this.alsoShip = alsoShip;
				this.spacing = placement.spacing();
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
				// getStartChunk erwartet Chunk-Koordinaten (nicht Regionen)
				ChunkPos start = placement.getPotentialStructureChunk(calculator.getLevelSeed(), c[0] * spacing, c[1] * spacing);
				if (!placement.isStructureChunk(calculator, start.x, start.z)) return false;
				ChunkAccess chunk = world.getChunk(start.x, start.z, ChunkStatus.STRUCTURE_STARTS, true);
				if (chunk == null) return false;
				StructureStart s = chunk.getStartForStructure(entry.value());
				if (s == null || !s.isValid()) return false;
				boolean wantCity = type != TrackType.END_SHIP;
				addStart(type, s, alsoShip);
				List<Site> mine = found.get(type == TrackType.END_SHIP || (alsoShip && !wantCity) ? TrackType.END_SHIP : type);
				if (mine != null) {
					hits = mine.size();
					if (hits >= 3) {
						List<Double> d = new ArrayList<>();
						for (Site p : mine) d.add(dist2(p.pos()));
						d.sort(Double::compare);
						bestNeeded = d.get(2);
					}
				}
				if (alsoShip) {
					// Bei Endsiedlung + Schiff erst aufhoeren, wenn auch Schiffe gefunden wurden
					List<Site> ships = found.get(TrackType.END_SHIP);
					if (ships == null || ships.size() < 2) bestNeeded = Double.MAX_VALUE;
				}
				return false;
			}
		}

		/** Fuer Strukturen ohne Raster (z. B. Festungen): normale /locate-Suche. */
		final class LocatePart implements Part {
			final TrackType type;
			final Holder<Structure> entry;

			LocatePart(TrackType type, Holder<Structure> entry) {
				this.type = type;
				this.entry = entry;
			}

			@Override
			public double progress() {
				return 0;
			}

			@Override
			public boolean step() {
				Pair<BlockPos, Holder<Structure>> r = generator.findNearestMapStructure(world, HolderSet.direct(entry), center, 100, false);
				if (r == null) return true;
				BlockPos p = r.getFirst();
				// Umriss aus dem Strukturstart holen (fuer die Beute-Pruefung)
				ChunkAccess chunk = world.getChunk(p.getX() >> 4, p.getZ() >> 4, ChunkStatus.STRUCTURE_STARTS, true);
				StructureStart s = chunk == null ? null : chunk.getStartForStructure(entry.value());
				if (s != null && s.isValid()) addStart(type, s, false);
				else add(Site.at(type, p));
				return true;
			}
		}
	}
}
