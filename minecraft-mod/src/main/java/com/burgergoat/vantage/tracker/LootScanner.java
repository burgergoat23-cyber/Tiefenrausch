package com.burgergoat.vantage.tracker;

import com.burgergoat.vantage.tracker.LootStatus.Row;
import com.burgergoat.vantage.tracker.LootStatus.State;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.BrewingStandBlock;
import net.minecraft.block.EndPortalFrameBlock;
import net.minecraft.block.entity.BarrelBlockEntity;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.block.entity.BrewingStandBlockEntity;
import net.minecraft.block.entity.BrushableBlockEntity;
import net.minecraft.block.entity.ChestBlockEntity;
import net.minecraft.block.entity.EndPortalBlockEntity;
import net.minecraft.block.entity.MobSpawnerBlockEntity;
import net.minecraft.block.entity.SkullBlockEntity;
import net.minecraft.block.entity.TrialSpawnerBlockEntity;
import net.minecraft.block.entity.VaultBlockEntity;
import net.minecraft.entity.decoration.ItemFrameEntity;
import net.minecraft.entity.mob.ElderGuardianEntity;
import net.minecraft.inventory.Inventory;
import net.minecraft.inventory.LootableInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.util.math.BlockBox;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.world.World;
import net.minecraft.world.chunk.ChunkSection;
import net.minecraft.world.chunk.WorldChunk;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.function.LongPredicate;

/**
 * Zaehlt, was in einer Struktur noch da ist (Kisten, Elytra im Rahmen, Drachenkopf …) und macht daraus
 * die Zeilen fuer die Tracker-Karte. Laeuft im Einzelspieler auf dem Server-Thread (dort ist auch der
 * Kisteninhalt bekannt), auf Servern auf dem Client (nur was man sehen kann).
 */
public final class LootScanner {
	private LootScanner() {
	}

	/** Strichliste fuer einen Bereich. */
	static final class Census {
		int chests;
		int sealed;
		int opened;
		int empty;
		int elytra;
		int emptyFrames;
		int heads;
		int stands;
		int potions;
		int spawners;
		int trialSpawners;
		int vaults;
		int brushable;
		int gold;
		int tnt;
		int frames;
		int eyes;
		int portal;
		int elders;
		/** Chunks, die noch nie fertig erzeugt wurden: dort war nie jemand, also ist alles unberuehrt. */
		int pristine;
		/** Chunks, die gerade nicht geladen sind (unbekannt). */
		int unloaded;
		int scanned;

		boolean nothingLoaded() {
			return scanned == 0;
		}
	}

	/**
	 * Zaehlt alles im Bereich {@code box} (ohne {@code exclude}).
	 *
	 * @param pristine Chunk (als long) wurde noch nie fertig erzeugt
	 */
	static Census census(World world, BlockBox box, @Nullable BlockBox exclude, TrackType type, LongPredicate pristine) {
		Census c = new Census();
		boolean exact = !world.isClient();
		boolean gold = type == TrackType.BASTION || type == TrackType.MONUMENT || type == TrackType.RUINED_PORTAL;
		boolean tnt = type == TrackType.DESERT_PYRAMID;
		boolean frames = type == TrackType.STRONGHOLD;
		int minY = Math.max(box.getMinY(), world.getBottomY());
		int maxY = Math.min(box.getMaxY(), world.getTopYInclusive());
		for (int cx = box.getMinX() >> 4; cx <= box.getMaxX() >> 4; cx++) {
			for (int cz = box.getMinZ() >> 4; cz <= box.getMaxZ() >> 4; cz++) {
				WorldChunk chunk = world.getChunkManager().getWorldChunk(cx, cz);
				if (chunk == null) {
					if (pristine.test(net.minecraft.util.math.ChunkPos.toLong(cx, cz))) c.pristine++;
					else c.unloaded++;
					continue;
				}
				c.scanned++;
				for (BlockEntity be : chunk.getBlockEntities().values()) {
					BlockPos p = be.getPos();
					if (!box.contains(p) || (exclude != null && exclude.contains(p))) continue;
					countBlockEntity(c, be, exact);
				}
				if (gold || tnt || frames) countBlocks(c, chunk, box, exclude, minY, maxY, gold, tnt, frames);
			}
		}
		if (c.scanned > 0) {
			Box area = Box.from(box).expand(1.5);
			for (ItemFrameEntity f : world.getEntitiesByClass(ItemFrameEntity.class, area, e -> true)) {
				if (exclude != null && exclude.contains(f.getBlockPos())) continue;
				ItemStack held = f.getHeldItemStack();
				if (held.isOf(Items.ELYTRA)) c.elytra++;
				else if (held.isEmpty()) c.emptyFrames++;
			}
			if (type == TrackType.MONUMENT) {
				c.elders = world.getEntitiesByClass(ElderGuardianEntity.class, area, e -> e.isAlive()).size();
			}
		}
		return c;
	}

	private static void countBlockEntity(Census c, BlockEntity be, boolean exact) {
		if (be instanceof ChestBlockEntity || be instanceof BarrelBlockEntity) {
			c.chests++;
			if (exact) {
				// Erst die Beutetabelle pruefen: isEmpty() wuerde die Beute sonst sofort erzeugen
				if (((LootableInventory) be).getLootTable() != null) c.sealed++;
				else if (((Inventory) be).isEmpty()) c.empty++;
				else c.opened++;
			}
		} else if (be instanceof SkullBlockEntity) {
			BlockState st = be.getCachedState();
			if (st.isOf(Blocks.DRAGON_HEAD) || st.isOf(Blocks.DRAGON_WALL_HEAD)) c.heads++;
		} else if (be instanceof BrewingStandBlockEntity) {
			c.stands++;
			BlockState st = be.getCachedState();
			if (st.isOf(Blocks.BREWING_STAND)) {
				for (var prop : BrewingStandBlock.BOTTLE_PROPERTIES) if (st.get(prop)) c.potions++;
			}
		} else if (be instanceof MobSpawnerBlockEntity) {
			c.spawners++;
		} else if (be instanceof TrialSpawnerBlockEntity) {
			c.trialSpawners++;
		} else if (be instanceof VaultBlockEntity) {
			c.vaults++;
		} else if (be instanceof BrushableBlockEntity) {
			c.brushable++;
		} else if (be instanceof EndPortalBlockEntity && be.getCachedState().isOf(Blocks.END_PORTAL)) {
			c.portal++;
		}
	}

	private static void countBlocks(Census c, WorldChunk chunk, BlockBox box, @Nullable BlockBox exclude, int minY, int maxY,
									boolean gold, boolean tnt, boolean frames) {
		ChunkSection[] sections = chunk.getSectionArray();
		int x0 = chunk.getPos().getStartX();
		int z0 = chunk.getPos().getStartZ();
		for (int i = 0; i < sections.length; i++) {
			ChunkSection s = sections[i];
			if (s == null || s.isEmpty()) continue;
			int baseY = chunk.sectionIndexToCoord(i) << 4;
			if (baseY + 15 < minY || baseY > maxY) continue;
			if (!s.hasAny(st -> interesting(st.getBlock(), gold, tnt, frames))) continue;
			for (int y = 0; y < 16; y++) {
				int wy = baseY + y;
				if (wy < minY || wy > maxY) continue;
				for (int z = 0; z < 16; z++) {
					int wz = z0 + z;
					if (wz < box.getMinZ() || wz > box.getMaxZ()) continue;
					for (int x = 0; x < 16; x++) {
						int wx = x0 + x;
						if (wx < box.getMinX() || wx > box.getMaxX()) continue;
						BlockState st = s.getBlockState(x, y, z);
						Block b = st.getBlock();
						if (!interesting(b, gold, tnt, frames)) continue;
						if (exclude != null && exclude.contains(wx, wy, wz)) continue;
						if (b == Blocks.GOLD_BLOCK) c.gold++;
						else if (b == Blocks.TNT) c.tnt++;
						else if (b == Blocks.END_PORTAL_FRAME) {
							c.frames++;
							if (st.get(EndPortalFrameBlock.EYE)) c.eyes++;
						}
					}
				}
			}
		}
	}

	private static boolean interesting(Block b, boolean gold, boolean tnt, boolean frames) {
		return (gold && b == Blocks.GOLD_BLOCK) || (tnt && b == Blocks.TNT) || (frames && b == Blocks.END_PORTAL_FRAME);
	}

	// ------------------------------------------------------------------ Auswertung

	/**
	 * Macht aus den Zaehlungen die Anzeige.
	 *
	 * @param main   ganze Struktur (bei Endsiedlungen ohne das Schiff)
	 * @param part   Schiff / Portalraum, falls bekannt
	 * @param exact  Kisteninhalt bekannt (Einzelspieler)
	 * @param near   Spieler ist nah genug, dass fehlende Dinge wirklich fehlen (nur Server-Modus wichtig)
	 */
	static LootStatus evaluate(Site site, Census main, @Nullable Census part, boolean exact, boolean near) {
		Census all = part == null ? main : merge(main, part);
		if (all.scanned == 0 && all.pristine > 0 && all.unloaded == 0) return untouched(site);
		if (all.scanned == 0) {
			return new LootStatus(List.of(), LootStatus.Verdict.UNKNOWN,
					exact ? "Bereich konnte nicht geladen werden" : "Erst in Sichtweite prüfbar", exact);
		}
		// Fehlende Dinge nur dann als "weg" zaehlen, wenn wirklich alles geladen ist
		boolean complete = all.unloaded == 0 && (exact || near);
		List<Row> rows = new ArrayList<>();
		switch (site.type()) {
			case END_SHIP -> shipRows(rows, all, exact, complete);
			case END_CITY -> {
				rows.add(chests(main, -1, exact, complete, "Kisten (Stadt)"));
				if (part != null) {
					rows.add(elytra(part, part.unloaded == 0, "Schiff: Elytra"));
				} else if (exact) {
					rows.add(new Row(new ItemStack(Items.ELYTRA), "Schiff", "keins", State.INFO));
				} else if (main.elytra > 0 || main.heads > 0 || main.stands > 0 || main.emptyFrames > 0) {
					rows.add(elytra(main, complete, "Schiff: Elytra"));
				} else {
					rows.add(new Row(new ItemStack(Items.ELYTRA), "Schiff", "keins gesehen", State.INFO));
				}
			}
			case BASTION -> {
				rows.add(chests(all, -1, exact, complete, "Kisten"));
				rows.add(new Row(new ItemStack(Items.GOLD_BLOCK), "Goldblöcke", all.gold + " Stück", State.INFO));
				if (all.spawners > 0) rows.add(new Row(new ItemStack(Items.SPAWNER), "Spawner", all.spawners + "", State.INFO));
			}
			case FORTRESS -> {
				rows.add(chests(all, -1, exact, complete, "Kisten"));
				rows.add(new Row(new ItemStack(Items.BLAZE_ROD), "Lohen-Spawner", all.spawners == 0 ? "keine gesehen" : all.spawners + " da", State.INFO));
			}
			case STRONGHOLD -> {
				Census room = part != null ? part : all;
				if (room.portal > 0) {
					rows.add(new Row(new ItemStack(Items.ENDER_EYE), "Endportal", "aktiv", State.GOOD));
				} else if (room.frames > 0) {
					rows.add(new Row(new ItemStack(Items.ENDER_EYE), "Endportal", room.eyes + "/12 Augen", State.INFO));
				} else {
					rows.add(new Row(new ItemStack(Items.ENDER_EYE), "Endportal", room.pristine > 0 ? "unberührt" : "nicht gefunden", State.INFO));
				}
				rows.add(chests(all, -1, exact, complete, "Kisten"));
			}
			case TRIAL_CHAMBERS -> {
				rows.add(chests(all, -1, exact, complete, "Kisten"));
				rows.add(new Row(new ItemStack(Items.VAULT), "Tresore", all.vaults + "", State.INFO));
				rows.add(new Row(new ItemStack(Items.TRIAL_SPAWNER), "Prüfungs-Spawner", all.trialSpawners + "", State.INFO));
			}
			case MONUMENT -> {
				State st = all.gold >= 8 ? State.GOOD : all.gold > 0 ? State.MIXED : complete ? State.BAD : State.UNKNOWN;
				rows.add(new Row(new ItemStack(Items.GOLD_BLOCK), "Goldschatz", all.gold + "/8 Blöcke", st));
				rows.add(new Row(new ItemStack(Items.PRISMARINE_SHARD), "Großwächter", all.elders + "/3 leben", State.INFO));
			}
			case DESERT_PYRAMID -> {
				rows.add(chests(all, 4, exact, complete, "Kisten"));
				rows.add(new Row(new ItemStack(Items.TNT), "TNT-Falle", all.tnt > 0 ? "scharf!" : "entschärft", all.tnt > 0 ? State.MIXED : State.INFO));
				if (all.brushable > 0) rows.add(new Row(new ItemStack(Items.SUSPICIOUS_SAND), "Seltsamer Sand", all.brushable + "", State.INFO));
			}
			case JUNGLE_PYRAMID -> rows.add(chests(all, 2, exact, complete, "Kisten"));
			case OUTPOST -> rows.add(chests(all, 1, exact, complete, "Kiste"));
			case BURIED_TREASURE -> rows.add(chests(all, 1, exact, complete, "Schatzkiste"));
			case TRAIL_RUINS -> rows.add(new Row(new ItemStack(Items.SUSPICIOUS_GRAVEL), "Seltsamer Kies",
					all.brushable > 0 ? all.brushable + " übrig" : "alles ausgegraben", all.brushable > 0 ? State.GOOD : complete ? State.BAD : State.UNKNOWN));
			case RUINED_PORTAL -> {
				rows.add(chests(all, -1, exact, complete, "Kiste"));
				rows.add(new Row(new ItemStack(Items.GOLD_BLOCK), "Goldblöcke", all.gold + "", State.INFO));
			}
			case SWAMP_HUT -> {
			}
			default -> rows.add(chests(all, -1, exact, complete, "Kisten"));
		}
		LootStatus.Verdict v = LootStatus.judge(rows);
		String note;
		if (all.unloaded > 0) note = "Teilweise nicht geladen";
		else if (!exact) note = "Server: Kisteninhalt unbekannt";
		else if (all.pristine > 0) note = "Teile nie betreten";
		else note = "";
		return new LootStatus(rows, v, note, exact);
	}

	private static void shipRows(List<Row> rows, Census c, boolean exact, boolean complete) {
		rows.add(elytra(c, complete, "Elytra"));
		ItemStack head = new ItemStack(Items.DRAGON_HEAD);
		if (c.heads > 0) rows.add(new Row(head, "Drachenkopf", "noch da", State.GOOD));
		else if (c.pristine > 0) rows.add(new Row(head, "Drachenkopf", "noch da", State.GOOD));
		else rows.add(new Row(head, "Drachenkopf", complete ? "weg" : "nicht gesehen", complete ? State.BAD : State.UNKNOWN));
		rows.add(chests(c, 2, exact, complete, "Kisten"));
		ItemStack pot = new ItemStack(Items.BREWING_STAND);
		if (c.stands > 0) {
			if (c.potions > 0) rows.add(new Row(pot, "Heiltränke", c.potions + " noch da", State.GOOD));
			else rows.add(new Row(pot, "Heiltränke", "weg", State.BAD));
		} else if (c.pristine > 0) {
			rows.add(new Row(pot, "Heiltränke", "noch da", State.GOOD));
		} else {
			rows.add(new Row(pot, "Heiltränke", complete ? "Braustand weg" : "nicht gesehen", complete ? State.BAD : State.UNKNOWN));
		}
	}

	private static Row elytra(Census c, boolean complete, String label) {
		ItemStack icon = new ItemStack(Items.ELYTRA);
		if (c.elytra > 0) return new Row(icon, label, "noch da", State.GOOD);
		if (c.emptyFrames > 0) return new Row(icon, label, "weg", State.BAD);
		if (c.pristine > 0) return new Row(icon, label, "noch da", State.GOOD);
		if (!complete) return new Row(icon, label, "näher ran", State.UNKNOWN);
		return new Row(icon, label, "weg (Rahmen ab)", State.BAD);
	}

	private static Row chests(Census c, int expected, boolean exact, boolean complete, String label) {
		ItemStack icon = new ItemStack(Items.CHEST);
		int total = c.chests;
		// In nie betretenen Chunks liegen die fehlenden Kisten noch unberuehrt
		int missing = expected > 0 && complete && c.pristine == 0 ? Math.max(0, expected - total) : 0;
		if (!exact) {
			if (expected > 0) {
				State st = total >= expected ? State.INFO : !complete ? State.UNKNOWN : total == 0 ? State.BAD : State.MIXED;
				return new Row(icon, label, Math.min(total, expected) + "/" + expected + " da", st);
			}
			return new Row(icon, label, total == 0 ? "keine gesehen" : total + " da", State.INFO);
		}
		if (total == 0 && missing == 0) {
			if (c.pristine > 0) return new Row(icon, label, "unberührt", State.GOOD);
			return new Row(icon, label, "keine gefunden", State.INFO);
		}
		if (c.sealed == total && missing == 0) {
			return new Row(icon, label, total == 1 ? "unberührt" : "alle " + total + " unberührt", State.GOOD);
		}
		List<String> parts = new ArrayList<>();
		if (c.sealed > 0) parts.add(c.sealed + " unberührt");
		if (c.opened > 0) parts.add(c.opened + " offen");
		if (c.empty > 0) parts.add(c.empty + " leer");
		if (missing > 0) parts.add(missing + " abgebaut");
		State st = c.sealed == 0 && c.opened == 0 ? State.BAD : State.MIXED;
		return new Row(icon, label, String.join(" · ", parts), st);
	}

	private static LootStatus untouched(Site site) {
		List<Row> rows = new ArrayList<>();
		switch (site.type()) {
			case END_SHIP -> {
				rows.add(new Row(new ItemStack(Items.ELYTRA), "Elytra", "noch da", State.GOOD));
				rows.add(new Row(new ItemStack(Items.DRAGON_HEAD), "Drachenkopf", "noch da", State.GOOD));
				rows.add(new Row(new ItemStack(Items.CHEST), "Kisten", "alle 2 unberührt", State.GOOD));
				rows.add(new Row(new ItemStack(Items.BREWING_STAND), "Heiltränke", "noch da", State.GOOD));
			}
			case END_CITY -> {
				rows.add(new Row(new ItemStack(Items.CHEST), "Kisten (Stadt)", "unberührt", State.GOOD));
				if (site.part() != null) rows.add(new Row(new ItemStack(Items.ELYTRA), "Schiff: Elytra", "noch da", State.GOOD));
				else rows.add(new Row(new ItemStack(Items.ELYTRA), "Schiff", "keins", State.INFO));
			}
			case SWAMP_HUT -> {
			}
			case TRAIL_RUINS -> rows.add(new Row(new ItemStack(Items.SUSPICIOUS_GRAVEL), "Seltsamer Kies", "unberührt", State.GOOD));
			case MONUMENT -> rows.add(new Row(new ItemStack(Items.GOLD_BLOCK), "Goldschatz", "8/8 Blöcke", State.GOOD));
			case STRONGHOLD -> {
				rows.add(new Row(new ItemStack(Items.ENDER_EYE), "Endportal", "unberührt", State.INFO));
				rows.add(new Row(new ItemStack(Items.CHEST), "Kisten", "unberührt", State.GOOD));
			}
			default -> rows.add(new Row(new ItemStack(Items.CHEST), "Kisten", "unberührt", State.GOOD));
		}
		return new LootStatus(rows, LootStatus.judge(rows), "Noch nie betreten", true);
	}

	private static Census merge(Census a, Census b) {
		Census c = new Census();
		c.chests = a.chests + b.chests;
		c.sealed = a.sealed + b.sealed;
		c.opened = a.opened + b.opened;
		c.empty = a.empty + b.empty;
		c.elytra = a.elytra + b.elytra;
		c.emptyFrames = a.emptyFrames + b.emptyFrames;
		c.heads = a.heads + b.heads;
		c.stands = a.stands + b.stands;
		c.potions = a.potions + b.potions;
		c.spawners = a.spawners + b.spawners;
		c.trialSpawners = a.trialSpawners + b.trialSpawners;
		c.vaults = a.vaults + b.vaults;
		c.brushable = a.brushable + b.brushable;
		c.gold = a.gold + b.gold;
		c.tnt = a.tnt + b.tnt;
		c.frames = Math.max(a.frames, b.frames);
		c.eyes = Math.max(a.eyes, b.eyes);
		c.portal = Math.max(a.portal, b.portal);
		c.elders = Math.max(a.elders, b.elders);
		c.pristine = a.pristine + b.pristine;
		c.unloaded = a.unloaded + b.unloaded;
		c.scanned = a.scanned + b.scanned;
		return c;
	}
}
