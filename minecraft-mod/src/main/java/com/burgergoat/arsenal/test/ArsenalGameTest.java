package com.burgergoat.arsenal.test;

import com.burgergoat.arsenal.ArsenalClient;
import com.burgergoat.arsenal.config.ArsenalConfig;
import com.burgergoat.arsenal.feature.Macros;
import com.burgergoat.arsenal.feature.Viewmodel;
import com.burgergoat.arsenal.gui.ArsenalScreen;
import com.burgergoat.arsenal.skin.SkinPacks;
import com.burgergoat.arsenal.tracker.StructureTracker;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.ingame.InventoryScreen;
import net.minecraft.client.option.Perspective;
import net.minecraft.world.World;

/**
 * Automatischer Test (laeuft nur auf GitHub mit -Dfabric.client.gametest, nie beim normalen Spielen):
 * startet eine Welt, ruestet Skins aus, oeffnet alle Menue-Reiter und testet den Tracker. Macht Screenshots.
 */
@SuppressWarnings("UnstableApiUsage")
public class ArsenalGameTest implements FabricClientGameTest {
	@Override
	public void runTest(ClientGameTestContext ctx) {
		ctx.runOnClient(mc -> {
			ArsenalConfig c = ArsenalConfig.get();
			SkinPacks.apply(SkinPacks.all().get(0));
			c.skins.put("diamond_sword", "knife_butterfly_doppler");
			c.skins.put("golden_sword", "knife_shadow_daggers_sapphire");
			c.skins.put("shield", "shield_riot");
			c.chEnabled = true;
			c.hudInfo = true;
			ArsenalConfig.save();
		});
		try (TestSingleplayerContext sp = ctx.worldBuilder().setUseConsistentSettings(false).adjustSettings(w -> {
			w.setSeed("20261025");
			w.setGenerateStructures(true);
			w.setCheatsEnabled(true);
		}).create()) {
			sp.getClientWorld().waitForChunksRender();
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
			ctx.runOnClient(mc -> mc.inGameHud.getChatHud().clear(false));
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
				ArsenalConfig c = ArsenalConfig.get();
				c.vmX = -0.4f;
				c.vmY = 0.2f;
				c.vmRotZ = 35f;
				c.vmScale = 0.7f;
			});
			ctx.waitTicks(3);
			ctx.takeScreenshot("viewmodel_custom");
			ctx.runOnClient(mc -> {
				ArsenalConfig c = ArsenalConfig.get();
				c.vmX = 0;
				c.vmY = 0;
				c.vmRotZ = 0;
				c.vmScale = 1;
			});

			// Schild hochnehmen (Hand leer, Schild in der zweiten Hand)
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(8));
			ctx.waitTicks(5);
			ctx.getInput().holdKey(o -> o.useKey);
			ctx.waitTicks(12);
			ctx.takeScreenshot("shield_block");
			ctx.getInput().releaseKey(o -> o.useKey);
			ctx.waitTicks(5);

			// Schnell-Perle
			ctx.getInput().pressKey(ArsenalClient.pearlKey);
			ctx.waitTicks(3);
			ctx.takeScreenshot("quick_pearl");
			ctx.waitTicks(10);
			int pearlAfter = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
			ArsenalClient.LOG.info("TEST Schnell-Perle: danach={} (erwartet 0)", pearlAfter);

			// Attribut-Swap: mit der Axt (Slot 2) auf ein Ziel schlagen -> Streitkolben (Slot 3)
			ctx.runOnClient(mc -> {
				ArsenalConfig.get().maceSwap = true;
				ArsenalConfig.get().maceOnlyFalling = false;
				mc.player.getInventory().setSelectedSlot(2);
			});
			sp.getServer().runCommand("execute at @p run fill ~-3 ~30 ~-3 ~3 ~30 ~6 minecraft:glass");
			sp.getServer().runCommand("execute at @p run tp @p ~ ~31 ~ 0 0");
			ctx.waitTicks(20);
			sp.getServer().runCommand("execute at @p run summon minecraft:husk ~ ~ ~2.5 {NoAI:1b,PersistenceRequired:1b}");
			ctx.waitTicks(30);
			ctx.runOnClient(mc -> mc.inGameHud.getChatHud().clear(false));
			ctx.waitTicks(2);
			String target = ctx.computeOnClient(mc -> String.valueOf(mc.crosshairTarget == null ? null : mc.crosshairTarget.getType()));
			ctx.getInput().pressMouse(0);
			ctx.waitTicks(1);
			int maceDuring = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
			ctx.waitTicks(10);
			int maceAfter = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
			int swaps = ctx.computeOnClient(mc -> Macros.attributeSwaps);
			ArsenalClient.LOG.info("TEST Attribut-Swap: Ziel={} Swaps={} waehrend={} danach={} (erwartet Swaps=1, danach 2)", target, swaps, maceDuring, maceAfter);

			// Lunge-Swap mit echtem Sprungangriff: misst, ob der Spieler wirklich nach vorne springt
			sp.getServer().runCommand("kill @e[type=minecraft:husk]");
			sp.getServer().runCommand("item replace entity @p hotbar.4 with netherite_spear[enchantments={lunge:3}]");
			sp.getServer().runCommand("execute at @p run fill ~-10 ~-1 ~-10 ~10 ~-1 ~10 minecraft:glass");
			int[][] runs = {{0, 1, 1}, {1, 1, 1}, {1, 0, 1}, {1, 0, 0}, {1, 0, 0}};
			for (int[] run : runs) {
				int delay = run[1];
				sp.getServer().runCommand(run[0] == 1 ? "gamemode survival @a" : "gamemode creative @a");
				ctx.runOnClient(mc -> {
					ArsenalConfig.get().lungeDelay = delay;
					ArsenalConfig.get().lungeReturnDelay = run[2];
					mc.player.getInventory().setSelectedSlot(6);
				});
				sp.getServer().runCommand("execute at @p run tp @p ~ ~ ~ 180 0");
				ctx.waitTicks(40);
				double[] before = ctx.computeOnClient(mc -> new double[]{mc.player.getX(), mc.player.getZ()});
				ctx.getInput().pressKey(ArsenalClient.lungeKey);
				ctx.waitTicks(1);
				int slotDuring = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
				ctx.waitTicks(9);
				double[] after = ctx.computeOnClient(mc -> new double[]{mc.player.getX(), mc.player.getZ()});
				int slotAfter = ctx.computeOnClient(mc -> mc.player.getInventory().getSelectedSlot());
				double moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
				ArsenalClient.LOG.info("TEST Lunge-Stoss ({}, Stoss nach {} Ticks, zurueck nach {}): bewegt {} Bloecke, Slot nach 1 Tick={}, danach={}",
						run[0] == 1 ? "Ueberleben" : "Kreativ", delay, run[2], String.format(java.util.Locale.ROOT, "%.2f", moved), slotDuring, slotAfter);
			}
			sp.getServer().runCommand("gamemode creative @a");
			ctx.runOnClient(mc -> {
				ArsenalConfig.get().lungeDelay = 0;
				ArsenalConfig.get().lungeReturnDelay = 0;
			});
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(0));
			ctx.waitTicks(25);

			ctx.runOnClient(mc -> mc.options.setPerspective(Perspective.THIRD_PERSON_FRONT));
			ctx.waitTicks(10);
			ctx.takeScreenshot("third_person");
			ctx.runOnClient(mc -> mc.options.setPerspective(Perspective.FIRST_PERSON));

			ctx.setScreen(() -> new InventoryScreen(MinecraftClient.getInstance().player));
			ctx.waitTicks(5);
			ctx.takeScreenshot("inventory");
			ctx.setScreen(() -> null);

			for (int t = 0; t < ArsenalScreen.TABS.length; t++) {
				int tab = t;
				ctx.runOnClient(mc -> ArsenalScreen.setTab(tab));
				ctx.setScreen(ArsenalScreen::new);
				ctx.waitTicks(4);
				ctx.takeScreenshot("menu_" + t);
			}
			ctx.setScreen(() -> null);

			for (String f : new String[]{"clear", "vivid", "cinematic", "golden", "frost", "dream", "hdr", "noir", "comic", "nightvision"}) {
				ctx.runOnClient(mc -> ArsenalConfig.get().filter = f);
				ctx.waitTicks(5);
				ctx.takeScreenshot("filter_" + f);
			}
			ctx.runOnClient(mc -> ArsenalConfig.get().filter = "none");

			// Tracker im Nether
			sp.getServer().runCommand("execute in minecraft:the_nether run tp @p 0 100 0");
			ctx.waitFor(mc -> mc.world != null && mc.world.getRegistryKey() == World.NETHER, 2400);
			sp.getClientWorld().waitForChunksRender();
			ctx.runOnClient(StructureTracker::search);
			ctx.waitTicks(5);
			ctx.waitFor(mc -> !StructureTracker.searching(), 3000);
			ctx.runOnClient(mc -> ArsenalClient.LOG.info("TEST Tracker Nether: {} | {}", StructureTracker.status(), StructureTracker.results(mc)));
			ctx.takeScreenshot("tracker_nether");

			// Tracker im End
			sp.getServer().runCommand("execute in minecraft:the_end run tp @p 0 80 0");
			ctx.waitFor(mc -> mc.world != null && mc.world.getRegistryKey() == World.END, 2400);
			sp.getClientWorld().waitForChunksRender();
			ctx.runOnClient(StructureTracker::search);
			ctx.waitTicks(5);
			ctx.waitFor(mc -> !StructureTracker.searching(), 6000);
			ctx.runOnClient(mc -> ArsenalClient.LOG.info("TEST Tracker End: {} | {}", StructureTracker.status(), StructureTracker.results(mc)));
			ctx.takeScreenshot("tracker_end");
			ctx.runOnClient(mc -> ArsenalScreen.setTab(5));
			ctx.setScreen(ArsenalScreen::new);
			ctx.waitTicks(4);
			ctx.takeScreenshot("menu_tracker_end");
			ctx.setScreen(() -> null);
		}
	}
}
