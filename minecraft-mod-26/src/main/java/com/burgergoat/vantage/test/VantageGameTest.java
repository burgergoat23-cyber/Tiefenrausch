package com.burgergoat.vantage.test;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.anim.KnifeAnimations;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.feature.Macros;
import com.burgergoat.vantage.feature.Viewmodel;
import com.burgergoat.vantage.gui.VantageScreen;
import com.burgergoat.vantage.skin.SkinPacks;
import com.burgergoat.vantage.tracker.LootStatus;
import com.burgergoat.vantage.tracker.SeedSearch;
import com.burgergoat.vantage.tracker.Site;
import com.burgergoat.vantage.tracker.StructureTracker;
import com.burgergoat.vantage.tracker.TrackType;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.decoration.ItemFrame;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.ChestBlockEntity;
import net.minecraft.world.level.levelgen.structure.BoundingBox;
import net.minecraft.world.phys.AABB;
import java.util.List;
import java.util.Map;

/**
 * Automatischer Test (laeuft nur auf GitHub mit -Dfabric.client.gametest, nie beim normalen Spielen):
 * startet eine Welt, ruestet Skins aus, oeffnet alle Menue-Reiter und testet den Tracker. Macht Screenshots.
 */
@SuppressWarnings("UnstableApiUsage")
public class VantageGameTest implements FabricClientGameTest {
	@Override
	public void runTest(ClientGameTestContext ctx) {
		ctx.runOnClient(mc -> {
			VantageConfig c = VantageConfig.get();
			SkinPacks.apply(SkinPacks.all().get(0));
			c.skins.put("diamond_sword", "knife_butterfly_doppler");
			c.skins.put("golden_sword", "knife_shadow_daggers_sapphire");
			c.skins.put("shield", "shield_riot");
			c.chEnabled = true;
			c.hudInfo = true;
			VantageConfig.save();
		});
		try (TestSingleplayerContext sp = ctx.worldBuilder().setUseConsistentSettings(false).adjustSettings(w -> {
			w.setSeed("20261025");
			w.setGenerateStructures(true);
			w.setAllowCommands(true);
		}).create()) {
			sp.getConnection().waitForChunksRender();
			sp.getServer().runCommand("gamemode creative @a");
			sp.getServer().runCommand("time set noon");
			sp.getServer().runCommand("weather clear");
			sp.getServer().runCommand("item replace entity @p hotbar.0 with netherite_sword");
			sp.getServer().runCommand("item replace entity @p hotbar.1 with diamond_sword");
			sp.getServer().runCommand("item replace entity @p hotbar.2 with netherite_axe");
			sp.getServer().runCommand("item replace entity @p hotbar.3 with mace");
			sp.getServer().runCommand("item replace entity @p hotbar.4 with netherite_spear");
			sp.getServer().runCommand("item replace entity @p hotbar.5 with ender_pearl 16");
			sp.getServer().runCommand("item replace entity @p hotbar.6 with wind_charge 16");
			sp.getServer().runCommand("item replace entity @p hotbar.7 with golden_sword");
			sp.getServer().runCommand("item replace entity @p inventory.0 with totem_of_undying");
			sp.getServer().runCommand("item replace entity @p inventory.1 with iron_sword");
			sp.getServer().runCommand("item replace entity @p inventory.2 with wooden_sword");
			sp.getServer().runCommand("item replace entity @p weapon.offhand with shield");
			ctx.waitTicks(20);
			ctx.runOnClient(mc -> mc.gui.hud.getChat().clearMessages(false));
			for (int slot : new int[]{0, 1, 2, 3, 4, 5}) {
				ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(slot));
				ctx.waitTicks(12);
				ctx.takeScreenshot("hand_" + slot);
			}
			// Zieh- und Inspect-Animationen: Karambit (0), Butterfly (1), Schattendolche (7)
			for (int slot : new int[]{0, 1, 7}) {
				ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(8));
				ctx.waitTicks(6);
				ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(slot));
				ctx.waitTicks(3);
				ctx.takeScreenshot("draw_" + slot + "_a");
				ctx.waitTicks(5);
				ctx.takeScreenshot("draw_" + slot + "_b");
				ctx.waitTicks(20);
				ctx.runOnClient(Viewmodel::startInspect);
				ctx.waitTicks(10);
				ctx.takeScreenshot("inspect_" + slot + "_a");
				ctx.waitTicks(16);
				ctx.takeScreenshot("inspect_" + slot + "_b");
				ctx.waitTicks(18);
				ctx.takeScreenshot("inspect_" + slot + "_c");
				ctx.waitTicks(50);
			}
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(0));
			ctx.waitTicks(30);
			// Viewmodel verstellt
			ctx.runOnClient(mc -> {
				VantageConfig c = VantageConfig.get();
				c.vmX = -0.4f;
				c.vmY = 0.2f;
				c.vmRotZ = 35f;
				c.vmScale = 0.7f;
			});
			ctx.waitTicks(3);
			ctx.takeScreenshot("viewmodel_custom");
			ctx.runOnClient(mc -> {
				VantageConfig c = VantageConfig.get();
				c.vmX = 0;
				c.vmY = 0;
				c.vmRotZ = 0;
				c.vmScale = 1;
			});

			// Schild hochnehmen (Hand leer, Schild in der zweiten Hand)
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(8));
			ctx.waitTicks(5);
			ctx.getInput().holdKey(o -> o.keyUse);
			ctx.waitTicks(12);
			ctx.takeScreenshot("shield_block");
			ctx.getInput().releaseKey(o -> o.keyUse);
			ctx.waitTicks(5);

			// Schnell-Perle
			ctx.getInput().pressKey(VantageClient.pearlKey);
			ctx.waitTicks(3);
			ctx.takeScreenshot("quick_pearl");
			ctx.waitTicks(10);
			int pearlAfter = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
			VantageClient.LOG.info("TEST Schnell-Perle: danach={} (erwartet 8 = vorheriger Platz)", pearlAfter);

			// Attribut-Swap: mit der Axt (Slot 2) auf ein Ziel schlagen -> Streitkolben (Slot 3)
			ctx.runOnClient(mc -> {
				VantageConfig.get().maceSwap = true;
				VantageConfig.get().maceOnlyFalling = false;
				mc.player.getInventory().setSelectedSlot(2);
			});
			sp.getServer().runCommand("execute at @p run fill ~-3 ~30 ~-3 ~3 ~30 ~6 minecraft:glass");
			sp.getServer().runCommand("execute at @p run tp @p ~ ~31 ~ 0 0");
			ctx.waitTicks(20);
			sp.getServer().runCommand("execute at @p run summon minecraft:husk ~ ~ ~2.5 {NoAI:1b,PersistenceRequired:1b}");
			ctx.waitTicks(30);
			ctx.runOnClient(mc -> mc.gui.hud.getChat().clearMessages(false));
			ctx.waitTicks(2);
			String target = ctx.computeOnClient(mc -> String.valueOf(mc.hitResult == null ? null : mc.hitResult.getType()));
			ctx.getInput().pressMouse(0);
			ctx.waitTicks(1);
			int maceDuring = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
			ctx.waitTicks(10);
			int maceAfter = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
			int swaps = ctx.computeOnClient(mc -> Macros.attributeSwaps);
			VantageClient.LOG.info("TEST Attribut-Swap: Ziel={} Swaps={} waehrend={} danach={} (erwartet Swaps=1, danach 2)", target, swaps, maceDuring, maceAfter);

			// Lunge-Swap mit echtem Sprungangriff: misst, ob der Spieler wirklich nach vorne springt
			sp.getServer().runCommand("kill @e[type=minecraft:husk]");
			sp.getServer().runCommand("item replace entity @p hotbar.4 with netherite_spear[enchantments={lunge:3}]");
			sp.getServer().runCommand("execute at @p run fill ~-12 ~-1 ~-12 ~12 ~-1 ~12 minecraft:glass");
			ctx.waitTicks(5);
			double[] center = ctx.computeOnClient(mc -> new double[]{mc.player.getX(), mc.player.getY(), mc.player.getZ()});
			String tpCenter = String.format(java.util.Locale.ROOT, "tp @p %.2f %.2f %.2f 180 0", center[0], center[1], center[2]);
			// {Modus 1=Ueberleben, Stoss-Wartezeit, Zurueck-Wartezeit, Ausloeser 0=Taste 1=Windladung-Rechtsklick 2=Windladung ohne Makro}
			int[][] runs = {{0, 1, 1, 0}, {1, 1, 1, 0}, {1, 0, 0, 0}, {1, 0, 0, 0}, {1, 0, 0, 1}, {1, 0, 0, 2}};
			for (int[] run : runs) {
				int delay = run[1];
				sp.getServer().runCommand(run[0] == 1 ? "gamemode survival @a" : "gamemode creative @a");
				sp.getServer().runCommand(tpCenter);
				ctx.runOnClient(mc -> {
					VantageConfig.get().lungeDelay = delay;
					VantageConfig.get().lungeReturnDelay = run[2];
					VantageConfig.get().lungeAfterWind = run[3] == 1;
					VantageConfig.get().lungeAfterWindDelay = 0;
					Macros.lastJab = false;
					mc.player.getInventory().setSelectedSlot(6);
				});
				ctx.waitTicks(40);
				double[] before = ctx.computeOnClient(mc -> new double[]{mc.player.getX(), mc.player.getZ()});
				if (run[3] == 0) ctx.getInput().pressKey(VantageClient.lungeKey);
				else ctx.getInput().pressMouse(1);
				ctx.waitTicks(1);
				int slotDuring = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
				ctx.waitTicks(9);
				double[] after = ctx.computeOnClient(mc -> new double[]{mc.player.getX(), mc.player.getZ()});
				int slotAfter = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
				double moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
				boolean jab = ctx.computeOnClient(mc -> Macros.lastJab);
				String trigger = run[3] == 0 ? "Taste" : run[3] == 1 ? "Windladung+Makro" : "Windladung ohne Makro";
				VantageClient.LOG.info("TEST Lunge-Stoss ({}, {}, Stoss nach {} Ticks, zurueck nach {}): bewegt {} Bloecke, doAttack={}, Slot nach 1 Tick={}, danach={}",
						run[0] == 1 ? "Ueberleben" : "Kreativ", trigger, delay, run[2], String.format(java.util.Locale.ROOT, "%.2f", moved), jab, slotDuring, slotAfter);
			}
			sp.getServer().runCommand("gamemode creative @a");
			sp.getServer().runCommand(tpCenter);
			ctx.runOnClient(mc -> {
				VantageConfig.get().lungeDelay = 0;
				VantageConfig.get().lungeReturnDelay = 0;
				VantageConfig.get().lungeAfterWind = false;
			});
			// Schlaganimationen (CS) mit echtem Linksklick: Karambit, Butterfly (Vorhand + Rueckhand), Schattendolche, Axt, Streitkolben
			for (int slot : new int[]{0, 1, 1, 7, 2, 3}) {
				ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(slot));
				ctx.waitTicks(30);
				ctx.getInput().pressMouse(0);
				ctx.waitTicks(1);
				boolean sw = ctx.computeOnClient(mc -> Viewmodel.swinging());
				VantageClient.LOG.info("TEST Schlag Slot {}: Animation={}", slot, sw);
				ctx.waitTicks(15);
			}
			// Standbilder der Schlag-Posen (zum Pruefen der Bewegung)
			Object[][] poses = {
					{1, KnifeAnimations.SLASH_RIGHT}, {1, KnifeAnimations.SLASH_LEFT}, {1, KnifeAnimations.STAB},
					{0, KnifeAnimations.HOOK_RIGHT}, {0, KnifeAnimations.HOOK_LEFT}, {7, KnifeAnimations.PUNCH_A},
					{2, KnifeAnimations.CHOP}, {2, KnifeAnimations.CHOP_DIAGONAL}, {3, KnifeAnimations.SMASH}};
			for (Object[] pose : poses) {
				int slot = (Integer) pose[0];
				KnifeAnimations.Anim anim = (KnifeAnimations.Anim) pose[1];
				ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(slot));
				ctx.waitTicks(25);
				for (float t : new float[]{0.15f, 0.3f, 0.4f, 0.58f, 0.8f}) {
					ctx.runOnClient(mc -> Viewmodel.freeze(mc, anim, t));
					ctx.waitTicks(2);
					ctx.takeScreenshot("pose_" + anim.name() + "_" + Math.round(t * 100));
				}
				ctx.runOnClient(mc -> Viewmodel.stop());
			}
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(0));
			ctx.waitTicks(25);

			ctx.runOnClient(mc -> mc.options.setCameraType(CameraType.THIRD_PERSON_FRONT));
			ctx.waitTicks(10);
			ctx.takeScreenshot("third_person");
			ctx.runOnClient(mc -> mc.options.setCameraType(CameraType.FIRST_PERSON));

			ctx.setScreen(() -> new InventoryScreen(Minecraft.getInstance().player));
			ctx.waitTicks(5);
			ctx.takeScreenshot("inventory");
			ctx.setScreen(() -> null);

			for (int t = 0; t < VantageScreen.TABS.length; t++) {
				int tab = t;
				ctx.runOnClient(mc -> VantageScreen.setTab(tab));
				ctx.setScreen(VantageScreen::new);
				ctx.waitTicks(4);
				ctx.takeScreenshot("menu_" + t);
			}
			ctx.setScreen(() -> null);

			for (String f : new String[]{"clear", "vivid", "cinematic", "golden", "frost", "dream", "hdr", "noir", "comic", "nightvision"}) {
				ctx.runOnClient(mc -> VantageConfig.get().filter = f);
				ctx.waitTicks(5);
				ctx.takeScreenshot("filter_" + f);
			}
			ctx.runOnClient(mc -> VantageConfig.get().filter = "none");

			// Tracker im Nether
			sp.getServer().runCommand("execute in minecraft:the_nether run tp @p 0 100 0");
			ctx.waitFor(mc -> mc.level != null && mc.level.dimension() == Level.NETHER, 2400);
			sp.getConnection().waitForChunksRender();
			ctx.runOnClient(StructureTracker::search);
			ctx.waitTicks(5);
			ctx.waitFor(mc -> !StructureTracker.searching(), 3000);
			ctx.runOnClient(mc -> VantageClient.LOG.info("TEST Tracker Nether: {} | {}", StructureTracker.status(), StructureTracker.results(mc)));
			ctx.takeScreenshot("tracker_nether");

			// Tracker im End
			sp.getServer().runCommand("execute in minecraft:the_end run tp @p 0 80 0");
			ctx.waitFor(mc -> mc.level != null && mc.level.dimension() == Level.END, 2400);
			sp.getConnection().waitForChunksRender();
			ctx.runOnClient(StructureTracker::search);
			ctx.waitTicks(5);
			ctx.waitFor(mc -> !StructureTracker.searching(), 6000);
			ctx.runOnClient(mc -> VantageClient.LOG.info("TEST Tracker End: {} | {}", StructureTracker.status(), StructureTracker.results(mc)));
			// Seed-Suche (fuer eigene Server): muss dieselben Schiffe finden wie die echte Welt
			long worldSeed = sp.getServer().computeOnServer(server -> server.overworld().getSeed());
			long t0 = System.currentTimeMillis();
			Map<TrackType, List<Site>> bySeed = ctx.computeOnClient(mc -> {
				try {
					return SeedSearch.find(worldSeed, mc.level.registryAccess(), new BlockPos(0, 80, 0), 3000, 0, null);
				} catch (Exception e) {
					VantageClient.LOG.error("TEST Seed-Suche fehlgeschlagen", e);
					return Map.<TrackType, List<Site>>of();
				}
			});
			long took = System.currentTimeMillis() - t0;
			List<BlockPos> real = ctx.computeOnClient(mc -> StructureTracker.results(mc).stream().map(Site::pos).toList());
			int hits = 0;
			for (BlockPos p : real) {
				for (Site s : bySeed.getOrDefault(TrackType.END_SHIP, List.of())) if (s.pos().equals(p)) hits++;
			}
			VantageClient.LOG.info("TEST Seed-Suche: {} von {} Schiffen gleich, {} Endsiedlungen, {} ms | Seed-Schiffe {}", hits, real.size(),
					bySeed.getOrDefault(TrackType.END_CITY, List.of()).size(), took,
					bySeed.getOrDefault(TrackType.END_SHIP, List.of()).stream().map(Site::pos).toList());
			waitLoot(ctx);
			logLoot(ctx, "fern");
			ctx.takeScreenshot("tracker_end");
			ctx.runOnClient(mc -> VantageScreen.setTab(5));
			ctx.setScreen(VantageScreen::new);
			ctx.waitTicks(4);
			ctx.takeScreenshot("menu_tracker_end");
			ctx.setScreen(() -> null);

			// Zum naechsten Endschiff fliegen und es Stueck fuer Stueck pluendern
			Site ship = ctx.computeOnClient(StructureTracker::target);
			if (ship == null || ship.box() == null) {
				VantageClient.LOG.info("TEST Schiff: keins gefunden");
				return;
			}
			BoundingBox box = ship.box();
			int sx = box.getCenter().getX();
			int sy = box.maxY() + 6;
			int sz = box.minZ() - 10;
			// Kleine Glasplatte, damit man nicht ins Leere faellt
			sp.getServer().runCommand(String.format(java.util.Locale.ROOT, "execute in minecraft:the_end run fill %d %d %d %d %d %d minecraft:glass", sx - 1, sy - 1, sz - 1, sx + 1, sy - 1, sz + 1));
			sp.getServer().runCommand(String.format(java.util.Locale.ROOT, "execute in minecraft:the_end run tp @p %d %d %d 0 35", sx, sy, sz));
			ctx.waitTicks(40);
			sp.getConnection().waitForChunksRender();
			ctx.waitTicks(60);
			waitLoot(ctx);
			logLoot(ctx, "angekommen");
			ctx.takeScreenshot("ship_arrived");

			// Elytra aus dem Rahmen nehmen, eine Kiste oeffnen, Drachenkopf abbauen
			String did = sp.getServer().computeOnServer(server -> {
				ServerLevel world = server.getLevel(Level.END);
				StringBuilder sb = new StringBuilder();
				for (ItemFrame f : world.getEntitiesOfClass(ItemFrame.class, AABB.of(box).inflate(2), e -> true)) {
					sb.append("Rahmen=").append(f.getItem().getItem()).append(' ');
					f.setItem(ItemStack.EMPTY);
				}
				int chests = 0;
				for (BlockPos p : BlockPos.betweenClosed(box.minX(), box.minY(), box.minZ(), box.maxX(), box.maxY(), box.maxZ())) {
					BlockEntity be = world.getBlockEntity(p);
					if (be instanceof ChestBlockEntity chest) {
						chests++;
						if (chests == 1) chest.unpackLootTable(null);
					}
					if (world.getBlockState(p).is(Blocks.DRAGON_HEAD) || world.getBlockState(p).is(Blocks.DRAGON_WALL_HEAD)) {
						world.removeBlock(p.immutable(), false);
						sb.append("Kopf ");
					}
				}
				return sb.append("Kisten=").append(chests).toString();
			});
			VantageClient.LOG.info("TEST Schiff gepluendert: {}", did);
			ctx.runOnClient(mc -> StructureTracker.recheck());
			ctx.waitTicks(10);
			waitLoot(ctx);
			logLoot(ctx, "teilweise");
			ctx.takeScreenshot("ship_partly");

			// Rest auch noch: Kisten leeren, Braustand abbauen -> ganz gepluendert
			sp.getServer().runOnServer(server -> {
				ServerLevel world = server.getLevel(Level.END);
				for (BlockPos p : BlockPos.betweenClosed(box.minX(), box.minY(), box.minZ(), box.maxX(), box.maxY(), box.maxZ())) {
					BlockEntity be = world.getBlockEntity(p);
					if (be instanceof ChestBlockEntity chest) {
						chest.setLootTable(null);
						chest.clearContent();
					}
					if (world.getBlockState(p).is(Blocks.BREWING_STAND)) world.removeBlock(p.immutable(), false);
				}
			});
			ctx.runOnClient(mc -> StructureTracker.recheck());
			ctx.waitTicks(10);
			waitLoot(ctx);
			logLoot(ctx, "leer");
			ctx.takeScreenshot("ship_looted");

			// "Gepluenderte ueberspringen": jetzt muss ein anderes Schiff angezeigt werden
			ctx.runOnClient(mc -> VantageConfig.get().trackerSkipLooted = true);
			ctx.waitTicks(10);
			waitLoot(ctx);
			ctx.waitTicks(20);
			waitLoot(ctx);
			BlockPos next = ctx.computeOnClient(mc -> {
				Site s = StructureTracker.target(mc);
				return s == null ? null : s.pos();
			});
			VantageClient.LOG.info("TEST Ueberspringen: vorher {} jetzt {} (anders = gut)", ship.pos(), next);
			logLoot(ctx, "naechstes");
			ctx.takeScreenshot("ship_skip");
			ctx.runOnClient(mc -> VantageConfig.get().trackerSkipLooted = false);
			// Groesse der Tracker-Karte
			for (float scale : new float[]{0.6f, 1.4f}) {
				ctx.runOnClient(mc -> VantageConfig.get().trackerScale = scale);
				ctx.waitTicks(3);
				ctx.takeScreenshot("card_scale_" + Math.round(scale * 100));
			}
			ctx.runOnClient(mc -> VantageConfig.get().trackerScale = 1f);
		}
	}

	/** Wartet, bis die Beute-Pruefung fuer das aktuelle Ziel fertig ist. */
	private static void waitLoot(ClientGameTestContext ctx) {
		for (int i = 0; i < 120; i++) {
			boolean done = ctx.computeOnClient(mc -> {
				Site s = StructureTracker.target(mc);
				return s == null || StructureTracker.loot(s).verdict != LootStatus.Verdict.CHECKING;
			});
			if (done) return;
			ctx.waitTicks(5);
		}
		VantageClient.LOG.info("TEST Beute: Pruefung dauert zu lange");
	}

	private static void logLoot(ClientGameTestContext ctx, String when) {
		ctx.runOnClient(mc -> {
			Site s = StructureTracker.target(mc);
			if (s == null) {
				VantageClient.LOG.info("TEST Beute ({}): kein Ziel", when);
				return;
			}
			LootStatus st = StructureTracker.loot(s);
			StringBuilder sb = new StringBuilder();
			for (LootStatus.Row r : st.rows) sb.append(r.label()).append('=').append(r.value()).append('[').append(r.state()).append("] ");
			VantageClient.LOG.info("TEST Beute ({}): {} {} | {}| Hinweis: {} | Entfernung {}", when, s.type(), st.verdict, sb, st.note, StructureTracker.distance(mc, s.pos()));
		});
	}
}
