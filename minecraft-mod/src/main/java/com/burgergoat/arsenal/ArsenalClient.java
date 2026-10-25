package com.burgergoat.arsenal;

import com.burgergoat.arsenal.config.ArsenalConfig;
import com.burgergoat.arsenal.feature.ArsenalHud;
import com.burgergoat.arsenal.feature.Crosshair;
import com.burgergoat.arsenal.feature.Filters;
import com.burgergoat.arsenal.feature.Macros;
import com.burgergoat.arsenal.feature.Viewmodel;
import com.burgergoat.arsenal.feature.Zoom;
import com.burgergoat.arsenal.gui.ArsenalScreen;
import com.burgergoat.arsenal.skin.SkinCatalog;
import com.burgergoat.arsenal.skin.SkinManager;
import com.burgergoat.arsenal.tracker.ServerSearch;
import com.burgergoat.arsenal.tracker.StructureTracker;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.item.v1.ItemTooltipCallback;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.item.Items;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ArsenalClient implements ClientModInitializer {
	public static final String MOD_ID = "arsenal";
	public static final Logger LOG = LoggerFactory.getLogger("Arsenal");

	public static KeyBinding menuKey;
	public static KeyBinding inspectKey;
	public static KeyBinding lungeKey;
	public static KeyBinding pearlKey;
	public static KeyBinding windKey;
	public static KeyBinding zoomKey;
	public static KeyBinding trackerKey;

	private static boolean greeted;

	@Override
	public void onInitializeClient() {
		ArsenalConfig.load();
		SkinCatalog.load();

		KeyBinding.Category cat = KeyBinding.Category.create(Identifier.of(MOD_ID, "main"));
		menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.menu", GLFW.GLFW_KEY_K, cat));
		inspectKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.inspect", GLFW.GLFW_KEY_G, cat));
		lungeKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.lunge", GLFW.GLFW_KEY_R, cat));
		pearlKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.pearl", GLFW.GLFW_KEY_V, cat));
		windKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.wind", GLFW.GLFW_KEY_B, cat));
		zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.zoom", GLFW.GLFW_KEY_C, cat));
		trackerKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.arsenal.tracker", GLFW.GLFW_KEY_UNKNOWN, cat));

		ClientTickEvents.END_CLIENT_TICK.register(ArsenalClient::tick);
		ServerTickEvents.END_SERVER_TICK.register(ServerSearch::serverTick);

		HudElementRegistry.replaceElement(VanillaHudElements.CROSSHAIR, Crosshair::wrap);
		HudElementRegistry.addLast(Identifier.of(MOD_ID, "hud"), ArsenalHud::render);

		ItemTooltipCallback.EVENT.register((stack, context, type, lines) -> SkinManager.appendTooltip(stack, lines));

		AttackEntityCallback.EVENT.register((player, world, hand, entity, hit) -> {
			if (world.isClient) SkinManager.onAttack(entity, player.getStackInHand(hand));
			return ActionResult.PASS;
		});
		UseItemCallback.EVENT.register((player, world, hand) -> {
			MinecraftClient mc = MinecraftClient.getInstance();
			if (world.isClient && player == mc.player) Macros.afterUse(mc, player.getStackInHand(hand));
			return ActionResult.PASS;
		});

		ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> client.execute(() -> {
			if (!greeted && client.player != null) {
				greeted = true;
				client.player.sendMessage(Text.literal("[Arsenal] ").withColor(0xFFE8A33D)
						.append(Text.literal("Drücke " + menuKey.getBoundKeyLocalizedText().getString() + " für das Menü.").withColor(0xFFFFFFFF)), false);
			}
		}));

		LOG.info("Arsenal geladen");
	}

	private static void tick(MinecraftClient client) {
		while (menuKey.wasPressed()) {
			if (client.currentScreen == null) client.setScreen(new ArsenalScreen());
		}
		while (inspectKey.wasPressed()) Viewmodel.startInspect(client);
		while (lungeKey.wasPressed()) Macros.lungeSwap(client);
		while (pearlKey.wasPressed()) Macros.quickUse(client, Items.ENDER_PEARL, "Enderperle");
		while (windKey.wasPressed()) Macros.quickUse(client, Items.WIND_CHARGE, "Windladung");
		while (trackerKey.wasPressed()) StructureTracker.search(client);

		Macros.tick(client);
		Viewmodel.tick(client);
		Zoom.tick(client);
		Filters.tick(client);
		StructureTracker.tick(client);
		SkinManager.tick(client);
	}
}
