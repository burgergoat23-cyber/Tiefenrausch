package com.burgergoat.arsenal.tracker;

import com.burgergoat.arsenal.config.ArsenalConfig;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.registry.RegistryKey;
import net.minecraft.server.integrated.IntegratedServer;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.util.math.MathHelper;
import net.minecraft.world.World;
import net.minecraft.world.chunk.Chunk;
import net.minecraft.world.chunk.ChunkSection;
import net.minecraft.world.chunk.ChunkStatus;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Struktur-Tracker. Einzelspieler: Suche ueber den eingebauten Server (weiter als die Sichtweite).
 * Server: nur wenn erlaubt, und nur in bereits geladenen Chunks (mehr weiss der Client nicht).
 */
public final class StructureTracker {
	public record Found(TrackType type, BlockPos pos) {
	}

	private static final Map<TrackType, List<BlockPos>> RESULTS = new EnumMap<>(TrackType.class);
	private static final Set<BlockPos> IGNORED = new HashSet<>();
	private static RegistryKey<World> dim;
	private static BlockPos lastCenter;
	private static boolean searching;
	private static String status = "Noch nicht gesucht";
	private static int ticks;

	// Chunk-Scan (Server-Modus)
	private static final List<ChunkPos> ORDER = new ArrayList<>();
	private static final Set<Long> SCANNED = new HashSet<>();
	private static ChunkPos scanCenter;
	private static int scanIndex;

	private StructureTracker() {
	}

	public static String status() {
		return status;
	}

	public static boolean searching() {
		return searching;
	}

	public static Set<TrackType> enabledTypes(RegistryKey<World> d) {
		Set<TrackType> out = new LinkedHashSet<>();
		for (String id : ArsenalConfig.get().trackTypes) {
			TrackType t = TrackType.byId(id);
			if (t != null && (d == null || t.fits(d))) out.add(t);
		}
		return out;
	}

	public static List<Found> results(MinecraftClient client) {
		List<Found> out = new ArrayList<>();
		if (client.world == null || !client.world.getRegistryKey().equals(dim)) return out;
		Set<TrackType> types = enabledTypes(dim);
		for (Map.Entry<TrackType, List<BlockPos>> e : RESULTS.entrySet()) {
			if (!types.contains(e.getKey())) continue;
			for (BlockPos p : e.getValue()) if (!IGNORED.contains(p)) out.add(new Found(e.getKey(), p));
		}
		if (client.player != null) {
			double px = client.player.getX();
			double pz = client.player.getZ();
			out.sort((a, b) -> Double.compare(d2(a.pos(), px, pz), d2(b.pos(), px, pz)));
		}
		return out;
	}

	private static double d2(BlockPos p, double x, double z) {
		double dx = p.getX() + 0.5 - x;
		double dz = p.getZ() + 0.5 - z;
		return dx * dx + dz * dz;
	}

	public static void ignore(BlockPos p) {
		IGNORED.add(p);
	}

	public static void clear() {
		RESULTS.clear();
		IGNORED.clear();
		SCANNED.clear();
		scanIndex = 0;
		lastCenter = null;
		status = "Liste geleert";
	}

	public static void search(MinecraftClient client) {
		if (client.player == null || client.world == null) return;
		RegistryKey<World> d = client.world.getRegistryKey();
		Set<TrackType> types = enabledTypes(d);
		lastCenter = client.player.getBlockPos();
		if (!d.equals(dim)) {
			RESULTS.clear();
			dim = d;
		}
		if (types.isEmpty()) {
			status = "Für diese Dimension ist nichts ausgewählt";
			return;
		}
		IntegratedServer server = client.getServer();
		if (server != null) {
			searching = true;
			status = "Suche läuft …";
			ServerSearch.start(server, d, lastCenter, types, ArsenalConfig.get().trackerRadius);
		} else if (ArsenalConfig.get().trackerServers) {
			SCANNED.clear();
			scanIndex = 0;
			scanCenter = null;
			status = "Scanne geladene Chunks (Sichtweite) …";
		} else {
			status = "Auf Servern ausgeschaltet (siehe Einstellung)";
		}
	}

	/** Ergebnis vom Server-Thread (im Client-Thread aufgerufen). */
	static void onServerResults(RegistryKey<World> d, Map<TrackType, List<BlockPos>> found, boolean done, String msg) {
		if (!d.equals(dim)) return;
		for (Map.Entry<TrackType, List<BlockPos>> e : found.entrySet()) RESULTS.put(e.getKey(), new ArrayList<>(e.getValue()));
		status = msg;
		if (done) {
			searching = false;
			int n = 0;
			for (List<BlockPos> l : RESULTS.values()) n += l.size();
			status = n == 0 ? "Nichts gefunden (Suchradius vergrößern?)" : n + " Fundorte";
		}
	}

	public static void tick(MinecraftClient client) {
		ticks++;
		ClientWorld world = client.world;
		if (world == null || client.player == null) {
			if (dim != null) {
				RESULTS.clear();
				dim = null;
				searching = false;
			}
			return;
		}
		ArsenalConfig c = ArsenalConfig.get();
		RegistryKey<World> d = world.getRegistryKey();
		boolean singleplayer = client.getServer() != null;
		if (!d.equals(dim)) {
			RESULTS.clear();
			IGNORED.clear();
			SCANNED.clear();
			dim = d;
			lastCenter = null;
			searching = false;
			status = "Neue Dimension";
		}
		if (c.trackerAuto && !searching && !enabledTypes(d).isEmpty() && ticks % 20 == 0) {
			BlockPos p = client.player.getBlockPos();
			if (lastCenter == null || (singleplayer && lastCenter.getSquaredDistance(p) > 400 * 400)) {
				if (singleplayer || c.trackerServers) search(client);
			}
		}
		if (!singleplayer && c.trackerServers) scanChunks(client, world);
		if (c.trackerBeam && ticks % 3 == 0) beams(client, world);
	}

	private static void beams(MinecraftClient client, ClientWorld world) {
		double px = client.player.getX();
		double pz = client.player.getZ();
		int shown = 0;
		for (Found f : results(client)) {
			if (shown++ >= 6) break;
			double dist = Math.sqrt(d2(f.pos(), px, pz));
			if (dist > 220) continue;
			double x = f.pos().getX() + 0.5 + (world.random.nextDouble() - 0.5) * 0.6;
			double z = f.pos().getZ() + 0.5 + (world.random.nextDouble() - 0.5) * 0.6;
			double y = client.player.getY() - 8 + world.random.nextDouble() * 50;
			world.addParticleClient(ParticleTypes.END_ROD, true, true, x, y, z, 0, 0.08, 0);
		}
	}

	// ------------------------------------------------------------ Chunk-Scan fuer Server

	private static void scanChunks(MinecraftClient client, ClientWorld world) {
		Set<TrackType> types = enabledTypes(world.getRegistryKey());
		if (types.isEmpty()) return;
		ChunkPos here = client.player.getChunkPos();
		int r = Math.max(2, client.options.getClampedViewDistance());
		if (scanCenter == null || Math.abs(scanCenter.x - here.x) > 2 || Math.abs(scanCenter.z - here.z) > 2 || ORDER.isEmpty()) {
			scanCenter = here;
			ORDER.clear();
			for (int ring = 0; ring <= r; ring++) {
				for (int dx = -ring; dx <= ring; dx++) {
					for (int dz = -ring; dz <= ring; dz++) {
						if (Math.max(Math.abs(dx), Math.abs(dz)) == ring) ORDER.add(new ChunkPos(here.x + dx, here.z + dz));
					}
				}
			}
			scanIndex = 0;
		}
		int budget = 12;
		int guard = ORDER.size();
		while (budget > 0 && guard-- > 0) {
			if (scanIndex >= ORDER.size()) {
				scanIndex = 0;
				int n = 0;
				for (List<BlockPos> l : RESULTS.values()) n += l.size();
				status = "Geladene Chunks: " + n + " Fundorte";
			}
			ChunkPos cp = ORDER.get(scanIndex++);
			if (SCANNED.contains(cp.toLong())) continue;
			Chunk chunk = world.getChunk(cp.x, cp.z, ChunkStatus.FULL, false);
			if (chunk == null) continue;
			SCANNED.add(cp.toLong());
			budget--;
			scanChunk(world, chunk, cp, types);
		}
	}

	private static void scanChunk(ClientWorld world, Chunk chunk, ChunkPos cp, Set<TrackType> types) {
		ChunkSection[] sections = chunk.getSectionArray();
		for (int i = 0; i < sections.length; i++) {
			ChunkSection s = sections[i];
			if (s == null || s.isEmpty()) continue;
			if (!s.hasAny(st -> isMarker(st, types))) continue;
			int baseY = chunk.sectionIndexToCoord(i) << 4;
			for (int y = 0; y < 16; y++) {
				for (int z = 0; z < 16; z++) {
					for (int x = 0; x < 16; x++) {
						BlockState st = s.getBlockState(x, y, z);
						TrackType t = TrackType.marker(st.getBlock());
						if (t != null && types.contains(t)) addFound(t, new BlockPos(cp.getStartX() + x, baseY + y, cp.getStartZ() + z));
					}
				}
			}
		}
	}

	private static boolean isMarker(BlockState st, Set<TrackType> types) {
		TrackType t = TrackType.marker(st.getBlock());
		return t != null && types.contains(t);
	}

	private static void addFound(TrackType t, BlockPos p) {
		List<BlockPos> l = RESULTS.computeIfAbsent(t, k -> new ArrayList<>());
		for (BlockPos q : l) if (q.getSquaredDistance(p) < 48 * 48) return;
		l.add(p);
	}

	// ------------------------------------------------------------ Anzeige-Hilfen

	public static String arrow(MinecraftClient client, BlockPos target) {
		double dx = target.getX() + 0.5 - client.player.getX();
		double dz = target.getZ() + 0.5 - client.player.getZ();
		float yawTo = (float) Math.toDegrees(Math.atan2(-dx, dz));
		float rel = MathHelper.wrapDegrees(yawTo - client.player.getYaw());
		int idx = Math.floorMod(Math.round(rel / 45f), 8);
		return new String[]{"↑", "↗", "→", "↘", "↓", "↙", "←", "↖"}[idx];
	}

	public static String distance(MinecraftClient client, BlockPos target) {
		double d = Math.sqrt(d2(target, client.player.getX(), client.player.getZ()));
		if (d >= 1000) return String.format("%.1f km", d / 1000.0).replace('.', ',');
		return Math.round(d) + " m";
	}
}
