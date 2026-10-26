package com.burgergoat.vantage.tracker;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.mixin.ServerChunkLoadingManagerInvoker;
import com.burgergoat.vantage.mixin.ServerChunkManagerAccessor;
import it.unimi.dsi.fastutil.longs.LongOpenHashSet;
import net.minecraft.client.MinecraftClient;
import net.minecraft.registry.RegistryKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.world.ChunkTicketType;
import net.minecraft.server.world.ServerChunkManager;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockBox;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.World;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Beute-Pruefung im Einzelspieler (Server-Thread). Chunks, die schon einmal fertig erzeugt wurden, werden
 * kurz geladen (mit einem Ticket, das von selbst wieder ablaeuft), damit auch weit entfernte Schiffe
 * geprueft werden koennen. Chunks, die noch nie erzeugt wurden, bleiben unangetastet: dort war nie jemand.
 */
public final class ServerLoot {
	/** Mehr Chunks werden fuer eine Pruefung nicht geladen. */
	private static final int MAX_LOAD = 100;
	private static final int MAX_WAIT_TICKS = 160;
	private static final ArrayDeque<Job> QUEUE = new ArrayDeque<>();
	private static Job current;

	private ServerLoot() {
	}

	/** Vom Client aufrufen. */
	public static void request(MinecraftServer server, RegistryKey<World> dim, Site site) {
		server.execute(() -> {
			ServerWorld world = server.getWorld(dim);
			if (world == null) return;
			if (current != null && current.site.pos().equals(site.pos())) return;
			QUEUE.removeIf(j -> j.site.pos().equals(site.pos()));
			QUEUE.add(new Job(world, site));
		});
	}

	public static void serverTick(MinecraftServer server) {
		if (current == null) current = QUEUE.poll();
		Job j = current;
		if (j == null) return;
		if (j.world.getServer() != server) {
			current = null;
			QUEUE.clear();
			return;
		}
		try {
			if (j.step()) current = null;
		} catch (Exception e) {
			VantageClient.LOG.error("Beute-Prüfung fehlgeschlagen", e);
			j.release();
			current = null;
			RegistryKey<World> dim = j.world.getRegistryKey();
			BlockPos pos = j.site.pos();
			MinecraftClient.getInstance().execute(() -> StructureTracker.onLoot(dim, pos,
					new LootStatus(List.of(), LootStatus.Verdict.UNKNOWN, "Fehler bei der Prüfung", true)));
		}
	}

	private static final class Job {
		final ServerWorld world;
		final Site site;
		final BlockBox area;
		final List<ChunkPos> chunks = new ArrayList<>();
		final LongOpenHashSet pristine = new LongOpenHashSet();
		final List<ChunkPos> toLoad = new ArrayList<>();
		final List<ChunkPos> ticketed = new ArrayList<>();
		int classified;
		int phase;
		int waited;

		Job(ServerWorld world, Site site) {
			this.world = world;
			this.site = site;
			BlockBox b = site.scanBox();
			if (site.part() != null) b = BlockBox.encompass(List.of(b, site.part())).orElse(b);
			this.area = b;
			for (int cx = area.getMinX() >> 4; cx <= area.getMaxX() >> 4; cx++) {
				for (int cz = area.getMinZ() >> 4; cz <= area.getMaxZ() >> 4; cz++) chunks.add(new ChunkPos(cx, cz));
			}
			// Naheliegende Chunks zuerst (wichtig, falls nicht alle geladen werden)
			ChunkPos c = new ChunkPos(site.pos());
			chunks.sort(Comparator.comparingInt(p -> p.getChebyshevDistance(c)));
		}

		ServerChunkManager cm() {
			return (ServerChunkManager) world.getChunkManager();
		}

		/** Zaehlt Chunks, deren Bloecke da sind, deren Entities (z. B. Item-Rahmen) aber noch fehlen. */
		LootScanner.Census fix(LootScanner.Census c, BlockBox box) {
			for (int cx = box.getMinX() >> 4; cx <= box.getMaxX() >> 4; cx++) {
				for (int cz = box.getMinZ() >> 4; cz <= box.getMaxZ() >> 4; cz++) {
					if (cm().getWorldChunk(cx, cz) != null && !world.isChunkLoaded(ChunkPos.toLong(cx, cz))) c.unloaded++;
				}
			}
			return c;
		}

		boolean step() {
			switch (phase) {
				case 0 -> {
					// Welche Chunks gibt es schon? (Liest notfalls kurz von der Festplatte, daher in Portionen)
					ServerChunkLoadingManagerInvoker mgr = (ServerChunkLoadingManagerInvoker) ((ServerChunkManagerAccessor) cm()).vantage$getChunkLoadingManager();
					int budget = 24;
					while (budget-- > 0 && classified < chunks.size()) {
						ChunkPos p = chunks.get(classified++);
						if (cm().getWorldChunk(p.x, p.z) != null) {
							if (!world.isChunkLoaded(p.toLong())) toLoad.add(p); // Bloecke da, Entities fehlen noch
						} else if (mgr.vantage$isLevelChunk(p)) {
							toLoad.add(p);
						} else {
							pristine.add(p.toLong());
						}
					}
					if (classified >= chunks.size()) phase = 1;
				}
				case 1 -> {
					for (ChunkPos p : toLoad) {
						if (ticketed.size() >= MAX_LOAD) break;
						cm().addTicket(ChunkTicketType.PORTAL, p, 0);
						ticketed.add(p);
					}
					phase = 2;
				}
				case 2 -> {
					boolean ready = true;
					for (ChunkPos p : ticketed) {
						if (cm().getWorldChunk(p.x, p.z) == null || !world.isChunkLoaded(p.toLong())) {
							ready = false;
							break;
						}
					}
					if (ready || ++waited > MAX_WAIT_TICKS) phase = 3;
				}
				default -> {
					finish();
					return true;
				}
			}
			return false;
		}

		void finish() {
			Site s = site;
			BlockBox main = s.scanBox();
			BlockBox part = s.part();
			LootStatus status;
			if (s.type() == TrackType.END_CITY && part != null) {
				LootScanner.Census city = fix(LootScanner.census(world, main, part, s.type(), pristine::contains), main);
				LootScanner.Census ship = fix(LootScanner.census(world, part, null, TrackType.END_SHIP, pristine::contains), part);
				status = LootScanner.evaluate(s, city, ship, true, true);
			} else if (s.type() == TrackType.STRONGHOLD && part != null) {
				LootScanner.Census all = fix(LootScanner.census(world, main, part, s.type(), pristine::contains), main);
				LootScanner.Census room = fix(LootScanner.census(world, part, null, s.type(), pristine::contains), part);
				status = LootScanner.evaluate(s, all, room, true, true);
			} else {
				status = LootScanner.evaluate(s, fix(LootScanner.census(world, main, null, s.type(), pristine::contains), main), null, true, true);
			}
			release();
			RegistryKey<World> dim = world.getRegistryKey();
			BlockPos pos = s.pos();
			LootStatus result = status;
			MinecraftClient.getInstance().execute(() -> StructureTracker.onLoot(dim, pos, result));
		}

		void release() {
			for (ChunkPos p : ticketed) cm().removeTicket(ChunkTicketType.PORTAL, p, 0);
			ticketed.clear();
		}
	}
}
