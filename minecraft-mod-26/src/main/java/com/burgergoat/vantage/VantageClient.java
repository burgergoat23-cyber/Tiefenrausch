package com.burgergoat.vantage;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.feature.VantageHud;
import com.burgergoat.vantage.feature.BrewGuide;
import com.burgergoat.vantage.feature.GuiThemes;
import com.burgergoat.vantage.feature.Hotbar;
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
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.item.Items;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class VantageClient implements ClientModInitializer {
	public static final String MOD_ID = "vantage";
	public static final Logger LOG = LoggerFactory.getLogger("Vantage");

	public static KeyMapping menuKey;
	public static KeyMapping inspectKey;
	public static KeyMapping lungeKey;
	public static KeyMapping pearlKey;
	public static KeyMapping windKey;
	public static KeyMapping zoomKey;
	public static KeyMapping trackerKey;
	public static KeyMapping trackerCycleKey;
	public static KeyMapping maceToggleKey;
	public static KeyMapping shieldToggleKey;
	public static KeyMapping freelookKey;
	public static KeyMapping freecamKey;
	public static KeyMapping waypointKey;

	private static boolean greeted;

	@Override
	public void onInitializeClient() {
		VantageConfig.load();
		SkinCatalog.load();

		KeyMapping.Category cat = KeyMapping.Category.register(Identifier.fromNamespaceAndPath(MOD_ID, "main"));
		menuKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.menu", GLFW.GLFW_KEY_K, cat));
		inspectKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.inspect", GLFW.GLFW_KEY_G, cat));
		lungeKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.lunge", GLFW.GLFW_KEY_R, cat));
		pearlKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.pearl", GLFW.GLFW_KEY_V, cat));
		windKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.wind", GLFW.GLFW_KEY_B, cat));
		zoomKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.zoom", GLFW.GLFW_KEY_C, cat));
		trackerKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.tracker", GLFW.GLFW_KEY_UNKNOWN, cat));
		trackerCycleKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.vantage.tracker_cycle", GLFW.GLFW_KEY_UNKNOWN, cat));
		maceToggleKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.mace_toggle", GLFW.GLFW_KEY_UNKNOWN, cat));
		shieldToggleKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.arsenal.shield_toggle", GLFW.GLFW_KEY_UNKNOWN, cat));
		freelookKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.vantage.freelook", GLFW.GLFW_KEY_LEFT_ALT, cat));
		freecamKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.vantage.freecam", GLFW.GLFW_KEY_F4, cat));
		waypointKey = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.vantage.waypoint", GLFW.GLFW_KEY_J, cat));

		ClientTickEvents.END_CLIENT_TICK.register(VantageClient::tick);
		ServerTickEvents.END_SERVER_TICK.register(ServerSearch::serverTick);
		ServerTickEvents.END_SERVER_TICK.register(ServerLoot::serverTick);

		HudElementRegistry.replaceElement(VanillaHudElements.CROSSHAIR, Crosshair::wrap);
		HudElementRegistry.replaceElement(VanillaHudElements.HOTBAR, Hotbar::wrap);
		// Trank-Timer an: die Symbole oben rechts vom Spiel auf Wunsch ausblenden
		HudElementRegistry.replaceElement(VanillaHudElements.MOB_EFFECTS, vanilla -> (ctx, tickCounter) -> {
			VantageConfig c = VantageConfig.get();
			if (!(c.potionHud && c.potionHideVanilla)) vanilla.extractRenderState(ctx, tickCounter);
		});
		// GUI-Designs: vor jedem Kisten-/Ofen-/Inventar-Fenster die Bilder im gewaehlten Design bereitlegen
		ScreenEvents.BEFORE_INIT.register((client, screen, w, h) -> {
			if (screen instanceof AbstractContainerScreen<?>) GuiThemes.ensure(client);
		});
		BrewGuide.register();
		HudElementRegistry.addLast(Identifier.fromNamespaceAndPath(MOD_ID, "hud"), VantageHud::render);

		ItemTooltipCallback.EVENT.register((stack, context, type, lines) -> SkinManager.appendTooltip(stack, lines));

		AttackEntityCallback.EVENT.register((player, world, hand, entity, hit) -> {
			if (world.isClientSide()) {
				SkinManager.onAttack(entity, player.getItemInHand(hand));
				ComboCounter.onAttack(entity);
				KillEffects.onAttack(entity);
			}
			return InteractionResult.PASS;
		});
		UseItemCallback.EVENT.register((player, world, hand) -> {
			Minecraft mc = Minecraft.getInstance();
			if (world.isClientSide() && player == mc.player) Macros.afterUse(mc, player.getItemInHand(hand));
			return InteractionResult.PASS;
		});

		ClientReceiveMessageEvents.GAME.register((message, overlay) -> {
			if (!overlay) SeedStore.onGameMessage(message);
		});

		ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> client.execute(() -> {
			if (!greeted && client.player != null) {
				greeted = true;
				client.player.sendSystemMessage(Component.literal("[Vantage] ").withColor(0xFFE8A33D)
						.append(Component.literal("Drücke " + menuKey.getTranslatedKeyMessage().getString() + " für das Menü.").withColor(0xFFFFFFFF)));
			}
		}));

		LOG.info("Vantage Client geladen");
	}

	private static void status(Minecraft client, String name, boolean on) {
		if (client.player != null) {
			client.player.sendOverlayMessage(Component.literal(name + ": ").withColor(0xFFE8A33D)
					.append(Component.literal(on ? "AN" : "AUS").withColor(on ? 0xFF55FF55 : 0xFFFF5555)));
		}
	}

	private static void tick(Minecraft client) {
		while (menuKey.consumeClick()) {
			if (client.gui.screen() == null) client.gui.setScreen(VantageScreen.home());
		}
		while (inspectKey.consumeClick()) Viewmodel.startInspect(client);
		while (lungeKey.consumeClick()) Macros.lungeSwap(client);
		while (pearlKey.consumeClick()) Macros.quickUse(client, Items.ENDER_PEARL, "Enderperle");
		while (windKey.consumeClick()) Macros.quickUse(client, Items.WIND_CHARGE, "Windladung");
		while (trackerKey.consumeClick()) StructureTracker.search(client);
		while (trackerCycleKey.consumeClick()) {
			TrackType t = StructureTracker.cycleTarget(client);
			if (t != null && client.player != null) {
				client.player.sendOverlayMessage(Component.literal("Tracker-Ziel: ").withColor(0xFFE8A33D).append(Component.literal(t.label).withColor(t.color)));
			}
		}
		while (maceToggleKey.consumeClick()) {
			VantageConfig.get().maceSwap = !VantageConfig.get().maceSwap;
			VantageConfig.save();
			status(client, "Attribut-Swap", VantageConfig.get().maceSwap);
		}
		while (shieldToggleKey.consumeClick()) {
			VantageConfig.get().shieldBreaker = !VantageConfig.get().shieldBreaker;
			VantageConfig.save();
			status(client, "Schild-Brecher", VantageConfig.get().shieldBreaker);
		}

		Macros.tick(client);
		CameraControl.tick(client);
		ComboCounter.tick(client);
		Waypoints.tick(client);
		KillEffects.tick(client);
		Extras.tick(client);
		while (waypointKey.consumeClick()) Waypoints.addHere(client);
		Viewmodel.tick(client);
		Zoom.tick(client);
		Filters.tick(client);
		StructureTracker.tick(client);
		SkinManager.tick(client);
	}
}
