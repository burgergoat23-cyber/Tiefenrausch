package com.burgergoat.vantage.test;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.anim.KnifeAnimations;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.feature.CameraControl;
import com.burgergoat.vantage.feature.ComboCounter;
import com.burgergoat.vantage.feature.Crosshair;
import com.burgergoat.vantage.feature.KillEffects;
import com.burgergoat.vantage.feature.Snipers;
import com.burgergoat.vantage.feature.Waypoints;
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
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.ingame.InventoryScreen;
import net.minecraft.client.gui.screen.ingame.BrewingStandScreen;
import net.minecraft.client.gui.screen.ingame.CrafterScreen;
import net.minecraft.client.gui.screen.ingame.FurnaceScreen;
import net.minecraft.client.gui.screen.ingame.GenericContainerScreen;
import net.minecraft.screen.BrewingStandScreenHandler;
import net.minecraft.screen.CrafterScreenHandler;
import net.minecraft.screen.FurnaceScreenHandler;
import net.minecraft.screen.GenericContainerScreenHandler;
import net.minecraft.text.Text;
import net.minecraft.client.option.Perspective;
import net.minecraft.block.Blocks;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.block.entity.ChestBlockEntity;
import net.minecraft.entity.decoration.ItemFrameEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockBox;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.world.World;

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
			c.skins.put("ender_pearl", "grenade_he");
			c.skins.put("wind_charge", "wind_vortex");
			c.skins.put("totem_of_undying", "totem_c4");
			c.chEnabled = true;
			c.hudInfo = true;
			VantageConfig.save();
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
			// Videos der Animationen: Bild fuer Bild an festen Zeitpunkten, der Bau macht daraus kleine Filme
			sp.getServer().runCommand("item replace entity @p hotbar.8 with totem_of_undying");
			ctx.runOnClient(mc -> mc.inGameHud.getChatHud().clear(false));
			String[][] vids = {{"0", "karambit"}, {"1", "butterfly"}, {"7", "schattendolche"}, {"2", "axt"}, {"3", "keule"},
					{"4", "speer"}, {"5", "enderperle"}, {"6", "windkugel"}, {"8", "totem"}};
			for (String[] v : vids) {
				final int vslot = Integer.parseInt(v[0]);
				ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(vslot));
				ctx.waitTicks(30);
				for (int pass = 0; pass < 2; pass++) {
					final boolean drawPass = pass == 0;
					final KnifeAnimations.Anim anim = ctx.computeOnClient(mc -> {
						String key = Viewmodel.animKey(mc.player.getMainHandStack());
						if (key == null) key = "default";
						return drawPass ? KnifeAnimations.draw(key) : KnifeAnimations.inspect(key);
					});
					int frames = Math.max(8, anim.ticks() / 2);
					for (int i = 0; i < frames; i++) {
						final float t = i / (float) (frames - 1);
						ctx.runOnClient(mc -> Viewmodel.freeze(mc, anim, t));
						ctx.waitTicks(1);
						ctx.takeScreenshot("vid_" + v[1] + "_" + (drawPass ? "a" : "b") + String.format("%03d", i));
					}
					ctx.runOnClient(mc -> Viewmodel.stop());
					ctx.waitTicks(2);
				}
			}
			sp.getServer().runCommand("item replace entity @p hotbar.8 with air");
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
			ctx.getInput().holdKey(o -> o.useKey);
			ctx.waitTicks(12);
			ctx.takeScreenshot("shield_block");
			ctx.getInput().releaseKey(o -> o.useKey);
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
			ctx.runOnClient(mc -> mc.inGameHud.getChatHud().clear(false));
			ctx.waitTicks(2);
			String target = ctx.computeOnClient(mc -> String.valueOf(mc.crosshairTarget == null ? null : mc.crosshairTarget.getType()));
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

			// Combo-Zaehler: dreimal mit der Faust auf einen Husk (Pause > Unverwundbarkeit)
			sp.getServer().runCommand(tpCenter.replace(" 180 0", " 0 0"));
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(8));
			ctx.waitTicks(5);
			sp.getServer().runCommand("execute at @p run summon minecraft:husk ~ ~ ~2.5 {NoAI:1b,PersistenceRequired:1b}");
			ctx.waitTicks(20);
			StringBuilder combos = new StringBuilder();
			for (int hit = 0; hit < 3; hit++) {
				ctx.getInput().pressMouse(0);
				ctx.waitTicks(14);
				int n = ctx.computeOnClient(mc -> ComboCounter.combo());
				combos.append(n).append(' ');
			}
			VantageClient.LOG.info("TEST Combo: {}(erwartet 1 2 3)", combos);
			ctx.takeScreenshot("combo");
			sp.getServer().runCommand("kill @e[type=minecraft:husk]");

			// Freelook: Taste halten und Maus bewegen -> Kamera dreht sich, der Spieler nicht
			float yawBefore = ctx.computeOnClient(mc -> mc.player.getYaw());
			ctx.getInput().holdKey(VantageClient.freelookKey);
			ctx.waitTicks(3);
			ctx.getInput().moveCursor(600, 0);
			ctx.waitTicks(5);
			float yawDuring = ctx.computeOnClient(mc -> mc.player.getYaw());
			// Direkt wie eine Mausbewegung drehen (falls die Test-Maus nicht greift)
			ctx.runOnClient(mc -> mc.player.changeLookDirection(400, 0));
			ctx.waitTicks(2);
			float yawAfterTurn = ctx.computeOnClient(mc -> mc.player.getYaw());
			boolean lookOn = ctx.computeOnClient(mc -> CameraControl.freeLook());
			float camYaw = ctx.computeOnClient(mc -> CameraControl.yaw());
			ctx.takeScreenshot("freelook");
			ctx.getInput().releaseKey(VantageClient.freelookKey);
			ctx.waitTicks(3);
			String persp = ctx.computeOnClient(mc -> mc.options.getPerspective().name());
			VantageClient.LOG.info("TEST Freelook: aktiv={} Spieler-Blick vorher={} waehrend={} nach Drehen={} Kamera={} Perspektive danach={}",
					lookOn, yawBefore, yawDuring, yawAfterTurn, camYaw, persp);

			// Freecam: einschalten, 20 Ticks vorwaerts fliegen -> Kamera bewegt sich, Spieler bleibt
			double[] start = ctx.computeOnClient(mc -> new double[]{mc.player.getX(), mc.player.getZ()});
			ctx.getInput().pressKey(VantageClient.freecamKey);
			ctx.waitTicks(3);
			ctx.getInput().holdKeyFor(o -> o.forwardKey, 20);
			ctx.getInput().holdKeyFor(o -> o.jumpKey, 8);
			ctx.waitTicks(3);
			double[] end = ctx.computeOnClient(mc -> new double[]{mc.player.getX(), mc.player.getZ()});
			double camDist = ctx.computeOnClient(mc -> CameraControl.position(1f).distanceTo(mc.player.getEyePos()));
			boolean camOn = ctx.computeOnClient(mc -> CameraControl.freeCam());
			ctx.takeScreenshot("freecam");
			ctx.getInput().pressKey(VantageClient.freecamKey);
			ctx.waitTicks(3);
			boolean camOff = !ctx.computeOnClient(mc -> CameraControl.freeCam());
			VantageClient.LOG.info("TEST Freecam: aktiv={} Kamera-Abstand={} Spieler bewegt={} wieder aus={}", camOn,
					String.format(java.util.Locale.ROOT, "%.1f", camDist),
					String.format(java.util.Locale.ROOT, "%.2f", Math.hypot(end[0] - start[0], end[1] - start[1])), camOff);

			// Freecam im Einzelspieler durch den Boden: schnell 25 Ticks nach unten (50 Bloecke) -> Kamera unter der Erde
			ctx.runOnClient(mc -> VantageConfig.get().freecamSpeed = 2f);
			ctx.getInput().pressKey(VantageClient.freecamKey);
			ctx.waitTicks(3);
			ctx.getInput().holdKeyFor(o -> o.sneakKey, 25);
			ctx.waitTicks(2);
			double camBelow = ctx.computeOnClient(mc -> mc.player.getEyePos().y - CameraControl.position(1f).y);
			boolean cullOff = ctx.computeOnClient(mc -> !mc.chunkCullingEnabled);
			ctx.takeScreenshot("freecam_underground");
			ctx.runOnClient(mc -> VantageConfig.get().freecamSpeed = 0.6f);
			ctx.getInput().pressKey(VantageClient.freecamKey);
			ctx.waitTicks(3);
			boolean cullBack = ctx.computeOnClient(mc -> mc.chunkCullingEnabled);
			VantageClient.LOG.info("TEST Freecam Boden: Kamera {} Bloecke unter den Augen, Verdeckung aus={} danach wieder an={}",
					String.format(java.util.Locale.ROOT, "%.1f", camBelow), cullOff, cullBack);

			// Fadenkreuz: ist von Anfang an an, Vorlage "Groß" im Spiel
			boolean chDefault = new VantageConfig().chEnabled;
			ctx.runOnClient(mc -> Crosshair.apply(Crosshair.preset(3), VantageConfig.get()));
			ctx.waitTicks(3);
			ctx.takeScreenshot("crosshair_preset");
			ctx.runOnClient(mc -> Crosshair.apply(Crosshair.preset(0), VantageConfig.get()));
			VantageClient.LOG.info("TEST Fadenkreuz: von Anfang an an={}", chDefault);

			ctx.runOnClient(mc -> mc.options.setPerspective(Perspective.THIRD_PERSON_FRONT));
			ctx.waitTicks(10);
			ctx.takeScreenshot("third_person");
			ctx.runOnClient(mc -> mc.options.setPerspective(Perspective.FIRST_PERSON));

			ctx.setScreen(() -> new InventoryScreen(MinecraftClient.getInstance().player));
			ctx.waitTicks(5);
			ctx.takeScreenshot("inventory");
			ctx.setScreen(() -> null);

			// Neues Menue: Startseite mit Kacheln, dann jede Einstellungs-Seite
			ctx.runOnClient(mc -> VantageScreen.setPage(VantageScreen.HOME));
			ctx.setScreen(VantageScreen::new);
			ctx.waitTicks(10);
			ctx.takeScreenshot("menu_home");
			for (int t = 0; t < VantageScreen.PAGES.length; t++) {
				int pg = t;
				ctx.runOnClient(mc -> VantageScreen.setPage(pg));
				ctx.setScreen(VantageScreen::new);
				ctx.waitTicks(5);
				ctx.takeScreenshot("menu_" + t);
			}
			// Andere Menue-Farbe (Lila) auf der Startseite
			ctx.runOnClient(mc -> {
				VantageConfig.get().menuTheme = 2;
				VantageScreen.setPage(VantageScreen.HOME);
			});
			ctx.setScreen(VantageScreen::new);
			ctx.waitTicks(10);
			ctx.takeScreenshot("menu_theme");
			ctx.runOnClient(mc -> VantageConfig.get().menuTheme = 0);
			ctx.setScreen(() -> null);

			// GUI-Designs: Kiste, Ofen, Crafter, Braustand (mit Rezepten) und Inventar
			String[] themeNames = {"normal", "dunkel", "mitternacht", "glas", "menuefarbe"};
			ctx.setScreen(() -> new BrewingStandScreen(new BrewingStandScreenHandler(1, inv()), inv(), Text.literal("Braustand")));
			ctx.waitTicks(5);
			ctx.takeScreenshot("gui_brewing_normal");
			for (int theme : new int[]{1, 2, 3, 4}) {
				ctx.runOnClient(mc -> VantageConfig.get().guiTheme = theme);
				ctx.setScreen(() -> new GenericContainerScreen(GenericContainerScreenHandler.createGeneric9x3(1, inv()), inv(), Text.literal("Kiste")));
				ctx.waitTicks(4);
				ctx.takeScreenshot("gui_chest_" + themeNames[theme]);
				if (theme == 1 || theme == 3) {
					ctx.setScreen(() -> new FurnaceScreen(new FurnaceScreenHandler(1, inv()), inv(), Text.literal("Ofen")));
					ctx.waitTicks(4);
					ctx.takeScreenshot("gui_furnace_" + themeNames[theme]);
					ctx.setScreen(() -> new CrafterScreen(new CrafterScreenHandler(1, inv()), inv(), Text.literal("Crafter")));
					ctx.waitTicks(4);
					ctx.takeScreenshot("gui_crafter_" + themeNames[theme]);
					ctx.setScreen(() -> new BrewingStandScreen(new BrewingStandScreenHandler(1, inv()), inv(), Text.literal("Braustand")));
					ctx.waitTicks(4);
					ctx.takeScreenshot("gui_brewing_" + themeNames[theme]);
					ctx.setScreen(() -> new InventoryScreen(MinecraftClient.getInstance().player));
					ctx.waitTicks(4);
					ctx.takeScreenshot("gui_inventory_" + themeNames[theme]);
				}
			}
			ctx.runOnClient(mc -> VantageConfig.get().guiTheme = 0);
			ctx.setScreen(() -> new GenericContainerScreen(GenericContainerScreenHandler.createGeneric9x3(1, inv()), inv(), Text.literal("Kiste")));
			ctx.waitTicks(4);
			ctx.takeScreenshot("gui_chest_zurueck_normal");
			ctx.setScreen(() -> null);

			// Hotbar-Stile im Spiel
			for (int style = 1; style < 5; style++) {
				int st = style;
				ctx.runOnClient(mc -> {
					VantageConfig.get().hotbarStyle = st;
					VantageConfig.get().hotbarNumbers = st == 3;
					mc.player.getInventory().setSelectedSlot(st);
				});
				ctx.waitTicks(8);
				ctx.takeScreenshot("hotbar_" + st);
			}
			ctx.runOnClient(mc -> {
				VantageConfig.get().hotbarStyle = 0;
				VantageConfig.get().hotbarNumbers = false;
				mc.player.getInventory().setSelectedSlot(0);
			});

			// Neue HUD-Module: Tasten-Anzeige, Ruestung, Trank-Timer, Wegpunkt, Blockrahmen
			sp.getServer().runCommand("item replace entity @p armor.head with diamond_helmet");
			sp.getServer().runCommand("item replace entity @p armor.chest with netherite_chestplate");
			sp.getServer().runCommand("item replace entity @p armor.feet with iron_boots");
			sp.getServer().runCommand("item replace entity @p hotbar.8 with arrow 32");
			sp.getServer().runCommand("effect give @p minecraft:speed 120 1");
			sp.getServer().runCommand("effect give @p minecraft:strength 8 0");
			sp.getServer().runCommand("effect give @p minecraft:night_vision 300 0");
			sp.getServer().runCommand("execute at @p run setblock ~ ~1 ~2 minecraft:gold_block");
			ctx.runOnClient(mc -> {
				VantageConfig c = VantageConfig.get();
				c.keystrokes = true;
				c.armorHud = true;
				c.potionHud = true;
				c.outlineCustom = true;
				c.outlineColor = 0xFFFF74B8;
				c.outlineWidth = 4f;
				mc.player.setYaw(0f);
				mc.player.setPitch(0f);
				Waypoints.addHere(mc);
			});
			ctx.waitTicks(10);
			ctx.takeScreenshot("hud_modules");

			// Chat: Uhrzeit und gleiche Nachrichten zusammenfassen
			ctx.runOnClient(mc -> {
				VantageConfig.get().chatTimestamps = true;
				VantageConfig.get().chatStack = true;
			});
			for (int i = 0; i < 3; i++) {
				sp.getServer().runCommand("say Hallo vom Server");
				ctx.waitTicks(2);
			}
			sp.getServer().runCommand("say Andere Nachricht");
			ctx.waitTicks(5);
			ctx.takeScreenshot("chat_tweaks");

			// Treffer-Farbe und Kill-Effekt
			ctx.runOnClient(mc -> {
				VantageConfig.get().hitColorCustom = true;
				VantageConfig.get().hitColor = 0x993FC3E8;
			});
			sp.getServer().runCommand("execute at @p run summon minecraft:husk ~ ~ ~3 {NoAI:1b}");
			ctx.waitTicks(5);
			sp.getServer().runCommand("damage @e[type=minecraft:husk,limit=1] 1");
			ctx.waitTicks(2);
			ctx.takeScreenshot("hit_color");
			sp.getServer().runCommand("kill @e[type=minecraft:husk]");
			ctx.runOnClient(mc -> KillEffects.play(mc, mc.player.getEyePos().add(0, 0, 4), 2));
			ctx.waitTicks(3);
			ctx.takeScreenshot("kill_effect");
			ctx.runOnClient(mc -> {
				VantageConfig c = VantageConfig.get();
				c.keystrokes = false;
				c.armorHud = false;
				c.potionHud = false;
				c.outlineCustom = false;
				c.hitColorCustom = false;
				c.chatTimestamps = false;
				Waypoints.setActive(mc, null);
			});
			sp.getServer().runCommand("effect clear @p");

			// Scharfschuetzengewehre: AWP (Bogen) und SSG 08 (Armbrust)
			ctx.runOnClient(mc -> {
				VantageConfig c = VantageConfig.get();
				c.skins.put("bow", "awp_dragon_lore");
				c.skins.put("crossbow", "ssg_dragonfire");
				VantageConfig.save();
			});
			sp.getServer().runCommand("item replace entity @p hotbar.0 with bow");
			sp.getServer().runCommand("item replace entity @p hotbar.1 with crossbow");
			sp.getServer().runCommand("item replace entity @p inventory.5 with arrow 64");
			ctx.runOnClient(mc -> {
				mc.player.getInventory().setSelectedSlot(0);
				mc.options.setPerspective(Perspective.FIRST_PERSON);
			});
			ctx.waitTicks(15);
			ctx.takeScreenshot("awp_idle");
			ctx.getInput().holdKey(o -> o.useKey);
			ctx.waitTicks(3);
			ctx.takeScreenshot("awp_aim");
			ctx.waitTicks(12);
			boolean scoped = ctx.computeOnClient(mc -> Snipers.scoped());
			ctx.takeScreenshot("awp_scope");
			ctx.getInput().releaseKey(o -> o.useKey);
			ctx.waitTicks(2);
			ctx.takeScreenshot("awp_shot");
			ctx.waitTicks(11);
			String bolt = ctx.computeOnClient(mc -> Snipers.boltSuffix());
			ctx.takeScreenshot("awp_bolt");
			ctx.waitTicks(25);
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(1));
			ctx.waitTicks(12);
			ctx.takeScreenshot("ssg_idle");
			ctx.getInput().holdKey(o -> o.useKey);
			ctx.waitTicks(11);
			String reload = ctx.computeOnClient(mc -> Snipers.boltSuffix());
			ctx.takeScreenshot("ssg_reload");
			ctx.waitTicks(22);
			ctx.getInput().releaseKey(o -> o.useKey);
			ctx.waitTicks(5);
			ctx.takeScreenshot("ssg_loaded");
			ctx.runOnClient(mc -> mc.options.setPerspective(Perspective.THIRD_PERSON_FRONT));
			ctx.waitTicks(5);
			ctx.takeScreenshot("ssg_third_person");
			ctx.runOnClient(mc -> mc.options.setPerspective(Perspective.FIRST_PERSON));
			VantageClient.LOG.info("TEST Gewehre: Zielfernrohr={} Verschluss nach Schuss={} beim Laden={}", scoped, bolt, reload);
			sp.getServer().runCommand("item replace entity @p hotbar.0 with netherite_sword");
			sp.getServer().runCommand("item replace entity @p hotbar.1 with diamond_sword");
			ctx.runOnClient(mc -> mc.player.getInventory().setSelectedSlot(0));
			sp.getServer().runCommand("execute at @p run setblock ~ ~1 ~2 minecraft:air");

			for (String f : new String[]{"clear", "vivid", "cinematic", "golden", "frost", "dream", "hdr", "noir", "comic", "nightvision"}) {
				ctx.runOnClient(mc -> VantageConfig.get().filter = f);
				ctx.waitTicks(5);
				ctx.takeScreenshot("filter_" + f);
			}
			ctx.runOnClient(mc -> VantageConfig.get().filter = "none");

			// Tracker im Nether
			sp.getServer().runCommand("execute in minecraft:the_nether run tp @p 0 100 0");
			ctx.waitFor(mc -> mc.world != null && mc.world.getRegistryKey() == World.NETHER, 2400);
			sp.getClientWorld().waitForChunksRender();
			ctx.runOnClient(StructureTracker::search);
			ctx.waitTicks(5);
			ctx.waitFor(mc -> !StructureTracker.searching(), 3000);
			ctx.runOnClient(mc -> VantageClient.LOG.info("TEST Tracker Nether: {} | {}", StructureTracker.status(), StructureTracker.results(mc)));
			ctx.takeScreenshot("tracker_nether");

			// Tracker im End
			sp.getServer().runCommand("execute in minecraft:the_end run tp @p 0 80 0");
			ctx.waitFor(mc -> mc.world != null && mc.world.getRegistryKey() == World.END, 2400);
			sp.getClientWorld().waitForChunksRender();
			ctx.runOnClient(StructureTracker::search);
			ctx.waitTicks(5);
			ctx.waitFor(mc -> !StructureTracker.searching(), 6000);
			ctx.runOnClient(mc -> VantageClient.LOG.info("TEST Tracker End: {} | {}", StructureTracker.status(), StructureTracker.results(mc)));
			// Seed-Suche (fuer eigene Server): muss dieselben Schiffe finden wie die echte Welt
			long worldSeed = sp.getServer().computeOnServer(server -> server.getOverworld().getSeed());
			long t0 = System.currentTimeMillis();
			Map<TrackType, List<Site>> bySeed = ctx.computeOnClient(mc -> {
				try {
					return SeedSearch.find(worldSeed, mc.world.getRegistryManager(), new BlockPos(0, 80, 0), 3000, 0, null);
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
			ctx.runOnClient(mc -> VantageScreen.setPage(VantageScreen.P_TRACKER));
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
			BlockBox box = ship.box();
			int sx = box.getCenter().getX();
			int sy = box.getMaxY() + 6;
			int sz = box.getMinZ() - 10;
			// Kleine Glasplatte, damit man nicht ins Leere faellt
			sp.getServer().runCommand(String.format(java.util.Locale.ROOT, "execute in minecraft:the_end run fill %d %d %d %d %d %d minecraft:glass", sx - 1, sy - 1, sz - 1, sx + 1, sy - 1, sz + 1));
			sp.getServer().runCommand(String.format(java.util.Locale.ROOT, "execute in minecraft:the_end run tp @p %d %d %d 0 35", sx, sy, sz));
			ctx.waitTicks(40);
			sp.getClientWorld().waitForChunksRender();
			ctx.waitTicks(60);
			waitLoot(ctx);
			logLoot(ctx, "angekommen");
			ctx.takeScreenshot("ship_arrived");

			// Elytra aus dem Rahmen nehmen, eine Kiste oeffnen, Drachenkopf abbauen
			String did = sp.getServer().computeOnServer(server -> {
				ServerWorld world = server.getWorld(World.END);
				StringBuilder sb = new StringBuilder();
				for (ItemFrameEntity f : world.getEntitiesByClass(ItemFrameEntity.class, Box.from(box).expand(2), e -> true)) {
					sb.append("Rahmen=").append(f.getHeldItemStack().getItem()).append(' ');
					f.setHeldItemStack(ItemStack.EMPTY);
				}
				int chests = 0;
				for (BlockPos p : BlockPos.iterate(box.getMinX(), box.getMinY(), box.getMinZ(), box.getMaxX(), box.getMaxY(), box.getMaxZ())) {
					BlockEntity be = world.getBlockEntity(p);
					if (be instanceof ChestBlockEntity chest) {
						chests++;
						if (chests == 1) chest.generateLoot(null);
					}
					if (world.getBlockState(p).isOf(Blocks.DRAGON_HEAD) || world.getBlockState(p).isOf(Blocks.DRAGON_WALL_HEAD)) {
						world.removeBlock(p.toImmutable(), false);
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
				ServerWorld world = server.getWorld(World.END);
				for (BlockPos p : BlockPos.iterate(box.getMinX(), box.getMinY(), box.getMinZ(), box.getMaxX(), box.getMaxY(), box.getMaxZ())) {
					BlockEntity be = world.getBlockEntity(p);
					if (be instanceof ChestBlockEntity chest) {
						chest.setLootTable(null);
						chest.clear();
					}
					if (world.getBlockState(p).isOf(Blocks.BREWING_STAND)) world.removeBlock(p.toImmutable(), false);
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

	private static net.minecraft.entity.player.PlayerInventory inv() {
		return MinecraftClient.getInstance().player.getInventory();
	}
}
