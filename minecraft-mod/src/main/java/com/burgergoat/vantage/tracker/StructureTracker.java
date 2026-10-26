package com.burgergoat.vantage.tracker;

import com.burgergoat.vantage.config.VantageConfig;
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
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Struktur-Tracker. Zeigt immer nur das naechste Ziel des gewaehlten Typs (pro Dimension einstellbar)
 * und darunter, was dort noch zu holen ist.
 * Einzelspieler: Suche und Beute-Pruefung ueber den eingebauten Server (weiter als die Sichtweite).
 * Server: nur wenn erlaubt, und nur in bereits geladenen Chunks (mehr weiss der Client nicht).
 */
public final class StructureTracker {
	private static final Map<TrackType, List<Site>> RESULTS = new EnumMap<>(TrackType.class);
	/** Wo zuletzt nach einem Typ gesucht wurde (fuer die automatische Suche). */
	private static final Map<TrackType, BlockPos> SEARCHED = new EnumMap<>(TrackType.class);
	private static final Set<BlockPos> IGNORED = new HashSet<>();
	private static final Map<BlockPos, LootStatus> LOOT = new HashMap<>();
	private static final Map<BlockPos, Long> PENDING = new HashMap<>();
	private static RegistryKey<World> dim;
	@Nullable
	private static TrackType searchingType;
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
		return searchingType != null;
	}

	// ------------------------------------------------------------------ Ziel

	public static String dimKey(RegistryKey<World> d) {
		return d.getValue().getPath();
	}

	/** Der gewaehlte Strukturtyp fuer diese Dimension. */
	@Nullable
	public static TrackType targetType(@Nullable RegistryKey<World> d) {
		if (d == null) return null;
		TrackType[] all = TrackType.forDimension(d);
		if (all.length == 0) return null;
		TrackType t = TrackType.byId(VantageConfig.get().trackTarget.getOrDefault(dimKey(d), ""));
		if (t != null && t.fits(d)) return t;
		if (d.equals(World.NETHER)) return TrackType.BASTION;
		if (d.equals(World.END)) return TrackType.END_SHIP;
		if (d.equals(World.OVERWORLD)) return TrackType.STRONGHOLD;
		return all[0];
	}

	public static void setTarget(RegistryKey<World> d, TrackType t) {
		VantageConfig.get().trackTarget.put(dimKey(d), t.id);
		VantageConfig.save();
	}

	/** Naechster Typ in dieser Dimension (Taste "Ziel wechseln"). */
	@Nullable
	public static TrackType cycleTarget(MinecraftClient client) {
		if (client.world == null) return null;
		RegistryKey<World> d = client.world.getRegistryKey();
		TrackType[] all = TrackType.forDimension(d);
		TrackType cur = targetType(d);
		if (all.length == 0 || cur == null) return null;
		int i = 0;
		for (int k = 0; k < all.length; k++) if (all[k] == cur) i = k;
		TrackType next = all[(i + 1) % all.length];
		setTarget(d, next);
		return next;
	}

	/** Alle Fundorte des gewaehlten Typs, naechster zuerst. */
	public static List<Site> results(MinecraftClient client) {
		List<Site> out = new ArrayList<>();
		if (client.world == null || !client.world.getRegistryKey().equals(dim)) return out;
		TrackType t = targetType(dim);
		if (t == null) return out;
		for (Site s : RESULTS.getOrDefault(t, List.of())) if (!IGNORED.contains(s.pos())) out.add(s);
		if (client.player != null) {
			double px = client.player.getX();
			double pz = client.player.getZ();
			out.sort((a, b) -> Double.compare(d2(a.pos(), px, pz), d2(b.pos(), px, pz)));
		}
		return out;
	}

	/** Das eine Ziel, das angezeigt wird. */
	@Nullable
	public static Site target(MinecraftClient client) {
		List<Site> list = results(client);
		if (list.isEmpty()) return null;
		if (!VantageConfig.get().trackerSkipLooted) return list.get(0);
		for (Site s : list) {
			LootStatus st = LOOT.get(s.pos());
			if (st == null || st.verdict != LootStatus.Verdict.LOOTED) return s;
		}
		return list.get(0);
	}

	public static LootStatus loot(Site site) {
		LootStatus st = LOOT.get(site.pos());
		return st != null ? st : LootStatus.CHECKING;
	}

	/** Wie viele Fundorte es vom gewaehlten Typ gibt. */
	public static int count(MinecraftClient client) {
		return results(client).size();
	}

	private static double d2(BlockPos p, double x, double z) {
		double dx = p.getX() + 0.5 - x;
		double dz = p.getZ() + 0.5 - z;
		return dx * dx + dz * dz;
	}

	/** Aktuelles Ziel ueberspringen (z. B. schon besucht). */
	public static void skip(MinecraftClient client) {
		Site s = target(client);
		if (s != null) IGNORED.add(s.pos());
	}

	/** Beute aller Fundorte neu pruefen. */
	public static void recheck() {
		LOOT.clear();
		PENDING.clear();
	}

	public static void clear() {
		RESULTS.clear();
		SEARCHED.clear();
		IGNORED.clear();
		LOOT.clear();
		PENDING.clear();
		SCANNED.clear();
		scanIndex = 0;
		status = "Liste geleert";
	}

	// ------------------------------------------------------------------ Suche

	public static void search(MinecraftClient client) {
		if (client.player == null || client.world == null) return;
		RegistryKey<World> d = client.world.getRegistryKey();
		if (!d.equals(dim)) resetDimension(d);
		TrackType t = targetType(d);
		if (t == null) {
			status = "In dieser Dimension gibt es nichts zu suchen";
			return;
		}
		BlockPos center = client.player.getBlockPos();
		SEARCHED.put(t, center);
		IntegratedServer server = client.getServer();
		if (server != null) {
			searchingType = t;
			status = "Suche läuft …";
			ServerSearch.start(server, d, center, Set.of(t), VantageConfig.get().trackerRadius);
		} else if (VantageConfig.get().trackerServers) {
			SCANNED.clear();
			scanIndex = 0;
			scanCenter = null;
			status = "Scanne geladene Chunks (Sichtweite) …";
		} else {
			status = "Auf Servern ausgeschaltet (siehe Einstellung)";
		}
	}

	/** Ergebnis vom Server-Thread (im Client-Thread aufgerufen). */
	static void onServerResults(RegistryKey<World> d, Map<TrackType, List<Site>> found, boolean done, String msg) {
		if (!d.equals(dim)) return;
		for (Map.Entry<TrackType, List<Site>> e : found.entrySet()) RESULTS.put(e.getKey(), new ArrayList<>(e.getValue()));
		status = msg;
		if (done) {
			TrackType t = searchingType;
			searchingType = null;
			int n = t == null ? 0 : RESULTS.getOrDefault(t, List.of()).size();
			status = n == 0 ? "Nichts gefunden (Suchradius vergrößern?)" : n + " Fundorte, der nächste wird angezeigt";
		}
	}

	/** Ergebnis einer Beute-Pruefung (im Client-Thread aufgerufen). */
	static void onLoot(RegistryKey<World> d, BlockPos pos, LootStatus st) {
		PENDING.remove(pos);
		if (d.equals(dim)) LOOT.put(pos, st);
	}

	private static void resetDimension(RegistryKey<World> d) {
		RESULTS.clear();
		SEARCHED.clear();
		IGNORED.clear();
		LOOT.clear();
		PENDING.clear();
		SCANNED.clear();
		ORDER.clear();
		dim = d;
		searchingType = null;
		status = "Neue Dimension";
	}

	public static void tick(MinecraftClient client) {
		ticks++;
		ClientWorld world = client.world;
		if (world == null || client.player == null) {
			if (dim != null) {
				RESULTS.clear();
				LOOT.clear();
				PENDING.clear();
				dim = null;
				searchingType = null;
			}
			return;
		}
		VantageConfig c = VantageConfig.get();
		RegistryKey<World> d = world.getRegistryKey();
		boolean singleplayer = client.getServer() != null;
		if (!d.equals(dim)) resetDimension(d);
		TrackType t = targetType(d);
		if (t == null) return;
		if (c.trackerAuto && !searching() && ticks % 20 == 0 && (singleplayer || c.trackerServers)) {
			BlockPos p = client.player.getBlockPos();
			BlockPos last = SEARCHED.get(t);
			if (last == null || (singleplayer && last.getSquaredDistance(p) > 400 * 400)) search(client);
		}
		if (!singleplayer && c.trackerServers) scanChunks(client, world);
		if (ticks % 5 == 0) checkLoot(client, world, singleplayer);
		if (c.trackerBeam && ticks % 3 == 0) beam(client, world);
	}

	/** Haelt den Beute-Status des Ziels (und bei "Gepluenderte ueberspringen" der naechsten) aktuell. */
	private static void checkLoot(MinecraftClient client, ClientWorld world, boolean singleplayer) {
		List<Site> list = results(client);
		if (list.isEmpty()) return;
		int n = VantageConfig.get().trackerSkipLooted ? Math.min(list.size(), 6) : 1;
		long now = System.currentTimeMillis();
		for (int i = 0; i < n; i++) {
			Site s = list.get(i);
			LootStatus st = LOOT.get(s.pos());
			double dist = Math.sqrt(d2(s.pos(), client.player.getX(), client.player.getZ()));
			if (singleplayer) {
				long maxAge = dist < 160 ? 2_000 : dist < 600 ? 15_000 : 120_000;
				Long asked = PENDING.get(s.pos());
				boolean waiting = asked != null && now - asked < 20_000;
				if (!waiting && (st == null || st.age() > maxAge)) {
					PENDING.put(s.pos(), now);
					ServerLoot.request(client.getServer(), dim, s);
				}
			} else if (st == null || st.age() > 1_000) {
				boolean near = dist < 64;
				LootScanner.Census census = LootScanner.census(world, s.scanBox(), null, s.type(), l -> false);
				LOOT.put(s.pos(), LootScanner.evaluate(s, census, null, false, near));
			}
			// Bei "ueberspringen" nur so weit pruefen, bis ein nicht gepluendertes Ziel gefunden ist
			LootStatus now2 = LOOT.get(s.pos());
			if (now2 == null || now2.verdict != LootStatus.Verdict.LOOTED) break;
		}
	}

	private static void beam(MinecraftClient client, ClientWorld world) {
		Site s = target(client);
		if (s == null) return;
		double dist = Math.sqrt(d2(s.pos(), client.player.getX(), client.player.getZ()));
		if (dist > 220) return;
		double x = s.pos().getX() + 0.5 + (world.random.nextDouble() - 0.5) * 0.6;
		double z = s.pos().getZ() + 0.5 + (world.random.nextDouble() - 0.5) * 0.6;
		double y = client.player.getY() - 8 + world.random.nextDouble() * 50;
		world.addParticleClient(ParticleTypes.END_ROD, true, true, x, y, z, 0, 0.08, 0);
	}

	// ------------------------------------------------------------ Chunk-Scan fuer Server

	private static void scanChunks(MinecraftClient client, ClientWorld world) {
		TrackType[] types = TrackType.forDimension(world.getRegistryKey());
		if (types.length == 0) return;
		Set<TrackType> wanted = Set.of(types);
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
				TrackType t = targetType(world.getRegistryKey());
				int n = t == null ? 0 : RESULTS.getOrDefault(t, List.of()).size();
				status = "Geladene Chunks: " + n + " Fundorte";
			}
			ChunkPos cp = ORDER.get(scanIndex++);
			if (SCANNED.contains(cp.toLong())) continue;
			Chunk chunk = world.getChunk(cp.x, cp.z, ChunkStatus.FULL, false);
			if (chunk == null) continue;
			SCANNED.add(cp.toLong());
			budget--;
			scanChunk(chunk, cp, wanted);
		}
	}

	private static void scanChunk(Chunk chunk, ChunkPos cp, Set<TrackType> types) {
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
		List<Site> l = RESULTS.computeIfAbsent(t, k -> new ArrayList<>());
		for (Site q : l) if (q.pos().getSquaredDistance(p) < 48 * 48) return;
		l.add(Site.at(t, p));
	}

	// ------------------------------------------------------------ Anzeige-Hilfen

	/** Richtung zum Ziel relativ zur Blickrichtung, in Grad (0 = geradeaus, 90 = rechts). */
	public static float relativeYaw(MinecraftClient client, BlockPos target) {
		double dx = target.getX() + 0.5 - client.player.getX();
		double dz = target.getZ() + 0.5 - client.player.getZ();
		float yawTo = (float) Math.toDegrees(Math.atan2(-dx, dz));
		return MathHelper.wrapDegrees(yawTo - client.player.getYaw());
	}

	public static String arrow(MinecraftClient client, BlockPos target) {
		int idx = Math.floorMod(Math.round(relativeYaw(client, target) / 45f), 8);
		return new String[]{"↑", "↗", "→", "↘", "↓", "↙", "←", "↖"}[idx];
	}

	public static double distanceTo(MinecraftClient client, BlockPos target) {
		return Math.sqrt(d2(target, client.player.getX(), client.player.getZ()));
	}

	public static String distance(MinecraftClient client, BlockPos target) {
		double d = distanceTo(client, target);
		if (d >= 1000) return String.format("%.1f km", d / 1000.0).replace('.', ',');
		return Math.round(d) + " m";
	}
}
