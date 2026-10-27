package com.burgergoat.vantage;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.feature.VantageHud;
import com.burgergoat.vantage.feature.BrewGuide;
import com.burgergoat.vantage.feature.GuiThemes;
import com.burgergoat.vantage.feature.Hotbar;
import com.burgergoat.vantage.feature.Snipers;
import com.burgergoat.vantage.feature.Extras;
import com.burgergoat.vantage.feature.KillEffects;
import com.burgergoat.vantage.feature.Waypoints;
import com.burgergoat.vantage.feature.CameraControl;
import com.burgergoat.vantage.feature.ComboCounter;
import com.burgergoat.vantage.feature.Crosshair;
import com.burgergoat.vantage.feature.Filters;
import com.burgergoat.vantage.feature.Macros;
import com.burgergoat.vantage.feature.Viewmodel;
import com.burgergoat.vantage.feature.Zoom;
import com.burgergoat.vantage.gui.VantageScreen;
import com.burgergoat.vantage.skin.SkinCatalog;
import com.burgergoat.vantage.skin.SkinManager;
import com.burgergoat.vantage.tracker.SeedStore;
import com.burgergoat.vantage.tracker.ServerLoot;
import com.burgergoat.vantage.tracker.ServerSearch;
import com.burgergoat.vantage.tracker.StructureTracker;
import com.burgergoat.vantage.tracker.TrackType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.item.v1.ItemTooltipCallback;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.item.Items;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Identifier;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class VantageClient implements ClientModInitializer {
	public static final String MOD_ID = "vantage";
	public static final Logger LOG = LoggerFactory.getLogger("Vantage");

	public static KeyBinding menuKey;
	public static KeyBinding inspectKey;
	public static KeyBinding lungeKey;
	public static KeyBinding pearlKey;
	public static KeyBinding windKey;
	public static KeyBinding zoomKey;
	public static KeyBinding trackerKey;
	public static KeyBinding trackerCycleKey;
	public static KeyBinding maceToggleKey;
	public static KeyBinding shieldToggleKey;
	public static KeyBinding freelookKey;
	public static KeyBinding freecamKey;
	public static KeyBinding waypointKey;

	private static boolean greeted;

	@Override
	public void onInitializeClient() {
		VantageConfig.load();
		SkinCatalog.load();

		KeyBinding.Category cat = KeyBinding.Category.create(Identifier.of(MOD_ID, "main"));
		menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.menu", GLFW.GLFW_KEY_K, cat));
		inspectKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.inspect", GLFW.GLFW_KEY_G, cat));
		lungeKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.lunge", GLFW.GLFW_KEY_R, cat));
		pearlKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.pearl", GLFW.GLFW_KEY_V, cat));
		windKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.wind", GLFW.GLFW_KEY_B, cat));
		zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.zoom", GLFW.GLFW_KEY_C, cat));
		trackerKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.tracker", GLFW.GLFW_KEY_UNKNOWN, cat));
		trackerCycleKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.vantage.tracker_cycle", GLFW.GLFW_KEY_UNKNOWN, cat));
		maceToggleKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.mace_toggle", GLFW.GLFW_KEY_UNKNOWN, cat));
		shieldToggleKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.shield_toggle", GLFW.GLFW_KEY_UNKNOWN, cat));
		freelookKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.vantage.freelook", GLFW.GLFW_KEY_LEFT_ALT, cat));
		freecamKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.vantage.freecam", GLFW.GLFW_KEY_F4, cat));
		waypointKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.vantage.waypoint", GLFW.GLFW_KEY_J, cat));

		ClientTickEvents.END_CLIENT_TICK.register(VantageClient::tick);
		ServerTickEvents.END_SERVER_TICK.register(ServerSearch::serverTick);
		ServerTickEvents.END_SERVER_TICK.register(ServerLoot::serverTick);

		HudElementRegistry.replaceElement(VanillaHudElements.CROSSHAIR, Crosshair::wrap);
		HudElementRegistry.replaceElement(VanillaHudElements.HOTBAR, Hotbar::wrap);
		HudElementRegistry.attachElementBefore(VanillaHudElements.CROSSHAIR, Identifier.of(MOD_ID, "scope"), Snipers::renderScope);
		// Trank-Timer an: die Symbole oben rechts vom Spiel auf Wunsch ausblenden
		HudElementRegistry.replaceElement(VanillaHudElements.STATUS_EFFECTS, vanilla -> (ctx, tickCounter) -> {
			VantageConfig c = VantageConfig.get();
			if (!(c.potionHud && c.potionHideVanilla)) vanilla.render(ctx, tickCounter);
		});
		// GUI-Designs: vor jedem Kisten-/Ofen-/Inventar-Fenster die Bilder im gewaehlten Design bereitlegen
		ScreenEvents.BEFORE_INIT.register((client, screen, w, h) -> {
			if (screen instanceof HandledScreen<?>) GuiThemes.ensure(client);
		});
		BrewGuide.register();
		HudElementRegistry.addLast(Identifier.of(MOD_ID, "hud"), VantageHud::render);

		ItemTooltipCallback.EVENT.register((stack, context, type, lines) -> SkinManager.appendTooltip(stack, lines));

		AttackEntityCallback.EVENT.register((player, world, hand, entity, hit) -> {
			if (world.isClient()) {
				SkinManager.onAttack(entity, player.getStackInHand(hand));
				ComboCounter.onAttack(entity);
				KillEffects.onAttack(entity);
			}
			return ActionResult.PASS;
		});
		UseItemCallback.EVENT.register((player, world, hand) -> {
			MinecraftClient mc = MinecraftClient.getInstance();
			if (world.isClient() && player == mc.player) Macros.afterUse(mc, player.getStackInHand(hand));
			return ActionResult.PASS;
		});

		ClientReceiveMessageEvents.GAME.register((message, overlay) -> {
			if (!overlay) SeedStore.onGameMessage(message);
		});

		ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> client.execute(() -> {
			if (!greeted && client.player != null) {
				greeted = true;
				client.player.sendMessage(Text.literal("[Vantage] ").withColor(0xFFE8A33D)
						.append(Text.literal("Drücke " + menuKey.getBoundKeyLocalizedText().getString() + " für das Menü.").withColor(0xFFFFFFFF)), false);
			}
		}));

		LOG.info("Vantage Client geladen");
	}

	private static void status(MinecraftClient client, String name, boolean on) {
		if (client.player != null) {
			client.player.sendMessage(Text.literal(name + ": ").withColor(0xFFE8A33D)
					.append(Text.literal(on ? "AN" : "AUS").withColor(on ? 0xFF55FF55 : 0xFFFF5555)), true);
		}
	}

	private static void tick(MinecraftClient client) {
		while (menuKey.wasPressed()) {
			if (client.currentScreen == null) client.setScreen(VantageScreen.home());
		}
		while (inspectKey.wasPressed()) Viewmodel.startInspect(client);
		while (lungeKey.wasPressed()) Macros.lungeSwap(client);
		while (pearlKey.wasPressed()) Macros.quickUse(client, Items.ENDER_PEARL, "Enderperle");
		while (windKey.wasPressed()) Macros.quickUse(client, Items.WIND_CHARGE, "Windladung");
		while (trackerKey.wasPressed()) StructureTracker.search(client);
		while (trackerCycleKey.wasPressed()) {
			TrackType t = StructureTracker.cycleTarget(client);
			if (t != null && client.player != null) {
				client.player.sendMessage(Text.literal("Tracker-Ziel: ").withColor(0xFFE8A33D).append(Text.literal(t.label).withColor(t.color)), true);
			}
		}
		while (maceToggleKey.wasPressed()) {
			VantageConfig.get().maceSwap = !VantageConfig.get().maceSwap;
			VantageConfig.save();
			status(client, "Attribut-Swap", VantageConfig.get().maceSwap);
		}
		while (shieldToggleKey.wasPressed()) {
			VantageConfig.get().shieldBreaker = !VantageConfig.get().shieldBreaker;
			VantageConfig.save();
			status(client, "Schild-Brecher", VantageConfig.get().shieldBreaker);
		}

		Macros.tick(client);
		CameraControl.tick(client);
		ComboCounter.tick(client);
		Snipers.tick(client);
		Waypoints.tick(client);
		KillEffects.tick(client);
		Extras.tick(client);
		while (waypointKey.wasPressed()) Waypoints.addHere(client);
		Viewmodel.tick(client);
		Zoom.tick(client);
		Filters.tick(client);
		StructureTracker.tick(client);
		SkinManager.tick(client);
	}
}
