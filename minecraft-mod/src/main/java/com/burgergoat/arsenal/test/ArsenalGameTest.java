package com.burgergoat.arsenal.test;

import com.burgergoat.arsenal.ArsenalClient;
import com.burgergoat.arsenal.config.ArsenalConfig;
import com.burgergoat.arsenal.feature.Viewmodel;
import com.burgergoat.arsenal.gui.ArsenalScreen;
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
			c.skins.put("netherite_sword", "knife_karambit_fade");
			c.skins.put("diamond_sword", "knife_butterfly_doppler");
			c.skins.put("netherite_axe", "axe_dz_axe_tiger_tooth");
			c.skins.put("mace", "mace_mjolnir_ruby");
			c.skins.put("netherite_spear", "spear_naginata_fade");
			c.skins.put("shield", "shield_riot");
			c.skins.put("ender_pearl", "grenade_he");
			c.skins.put("wind_charge", "wind_vortex");
			c.skins.put("totem_of_undying", "totem_medishot");
			c.chEnabled = true;
			c.hudInfo = true;
			ArsenalConfig.save();
		});
		try (TestSingleplayerContext sp = ctx.worldBuilder().create()) {
			sp.getClientWorld().waitForChunksRender();
			sp.getServer().runCommand("time set noon");
			sp.getServer().runCommand("gamerule doDaylightCycle false");
			sp.getServer().runCommand("item replace entity @p hotbar.0 with netherite_sword");
			sp.getServer().runCommand("item replace entity @p hotbar.1 with diamond_sword");
			sp.getServer().runCommand("item replace entity @p hotbar.2 with netherite_axe");
			sp.getServer().runCommand("item replace entity @p hotbar.3 with mace");
			sp.getServer().runCommand("item replace entity @p hotbar.4 with netherite_spear");
			sp.getServer().runCommand("item replace entity @p hotbar.5 with ender_pearl 16");
			sp.getServer().runCommand("item replace entity @p hotbar.6 with wind_charge 16");
			sp.getServer().runCommand("item replace entity @p hotbar.7 with totem_of_undying");
			sp.getServer().runCommand("item replace entity @p weapon.offhand with shield");
			ctx.waitTicks(20);
			for (int slot : new int[]{0, 1, 2, 3, 4, 5}) {
				ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(slot));
				ctx.waitTicks(12);
				ctx.takeScreenshot("hand_" + slot);
			}
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(0));
			ctx.waitTicks(12);
			ctx.runOnClient(Viewmodel::startInspect);
			ctx.waitTicks(12);
			ctx.takeScreenshot("inspect_a");
			ctx.waitTicks(10);
			ctx.takeScreenshot("inspect_b");
			ctx.waitTicks(30);

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

			for (String f : new String[]{"vibrance", "noir", "nightvision"}) {
				ctx.runOnClient(mc -> ArsenalConfig.get().filter = f);
				ctx.waitTicks(5);
				ctx.takeScreenshot("filter_" + f);
			}
			ctx.runOnClient(mc -> ArsenalConfig.get().filter = "none");

			// Tracker im Nether
			sp.getServer().runCommand("execute in minecraft:the_nether run tp @p 0 100 0");
			ctx.waitFor(mc -> mc.world != null && mc.world.getRegistryKey() == World.NETHER, 600);
			sp.getClientWorld().waitForChunksRender();
			ctx.runOnClient(StructureTracker::search);
			ctx.waitTicks(5);
			ctx.waitFor(mc -> !StructureTracker.searching(), 3000);
			ctx.runOnClient(mc -> ArsenalClient.LOG.info("TEST Tracker Nether: {} | {}", StructureTracker.status(), StructureTracker.results(mc)));
			ctx.takeScreenshot("tracker_nether");

			// Tracker im End
			sp.getServer().runCommand("execute in minecraft:the_end run tp @p 0 80 0");
			ctx.waitFor(mc -> mc.world != null && mc.world.getRegistryKey() == World.END, 600);
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
