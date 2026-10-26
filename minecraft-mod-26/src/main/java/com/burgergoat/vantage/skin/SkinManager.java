package com.burgergoat.vantage.skin;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import org.jetbrains.annotations.Nullable;

import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import net.minecraft.client.Minecraft;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.ItemOwner;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

/** Entscheidet, welches Modell ein Gegenstand bekommt, und zaehlt StatTrak-Kills. */
public final class SkinManager {
	private static final Map<Item, Identifier> MODEL_CACHE = new IdentityHashMap<>();
	private static final Map<String, ItemStack> PREVIEWS = new HashMap<>();
	private static final Set<ItemStack> NO_SKIN = Collections.newSetFromMap(new IdentityHashMap<>());
	private static int cacheVersion = -1;

	private static LivingEntity lastTarget;
	private static String lastSkin;
	private static int lastHitTick;
	private static int ticks;

	private SkinManager() {
	}

	/** Wird aus dem Mixin in ItemModelManager aufgerufen. null = Original behalten. */
	@Nullable
	public static Identifier resolve(ItemStack stack, @Nullable ItemOwner context, @Nullable Identifier current) {
		VantageConfig c = VantageConfig.get();
		if (!c.skinsEnabled || stack.isEmpty()) return null;
		if (current != null && VantageClient.MOD_ID.equals(current.getNamespace())) return null;
		if (NO_SKIN.contains(stack)) return null;
		if (c.skinsOnlyOwn && context != null) {
			LivingEntity owner = context.asLivingEntity();
			if (owner != null && owner != Minecraft.getInstance().player) return null;
		}
		if (cacheVersion != VantageConfig.version()) rebuild();
		return MODEL_CACHE.get(stack.getItem());
	}

	private static void rebuild() {
		MODEL_CACHE.clear();
		for (Map.Entry<String, String> e : VantageConfig.get().skins.entrySet()) {
			Item item = item(e.getKey());
			SkinCatalog.Skin skin = SkinCatalog.skin(e.getValue());
			if (item != null && skin != null) {
				MODEL_CACHE.put(item, Identifier.fromNamespaceAndPath(VantageClient.MOD_ID, skin.id()));
			}
		}
		cacheVersion = VantageConfig.version();
	}

	@Nullable
	public static Item item(String path) {
		Optional<Item> item = BuiltInRegistries.ITEM.getOptional(Identifier.withDefaultNamespace(path));
		return item.orElse(null);
	}

	public static String key(Item item) {
		Identifier id = BuiltInRegistries.ITEM.getKey(item);
		return id.getPath();
	}

	@Nullable
	public static SkinCatalog.Skin skinFor(ItemStack stack) {
		if (stack.isEmpty() || !VantageConfig.get().skinsEnabled) return null;
		return SkinCatalog.skin(VantageConfig.get().skins.get(key(stack.getItem())));
	}

	/** Gegenstand zum Anzeigen im Menue, der ein bestimmtes Skin-Modell traegt. */
	public static ItemStack preview(@Nullable SkinCatalog.Skin skin, String itemPath) {
		String k = (skin == null ? "-" : skin.id()) + "@" + itemPath;
		return PREVIEWS.computeIfAbsent(k, key -> {
			Item item = item(itemPath);
			if (item == null) return ItemStack.EMPTY;
			ItemStack stack = new ItemStack(item);
			if (skin != null) {
				stack.set(DataComponents.ITEM_MODEL, Identifier.fromNamespaceAndPath(VantageClient.MOD_ID, skin.id()));
			} else {
				NO_SKIN.add(stack);
			}
			return stack;
		});
	}

	public static void equip(String itemPath, @Nullable SkinCatalog.Skin skin) {
		if (skin == null) {
			VantageConfig.get().skins.remove(itemPath);
		} else {
			VantageConfig.get().skins.put(itemPath, skin.id());
		}
		VantageConfig.save();
	}

	// ------------------------------------------------------------ StatTrak

	public static void onAttack(Entity target, ItemStack held) {
		SkinCatalog.Skin skin = skinFor(held);
		if (skin != null && target instanceof LivingEntity living) {
			lastTarget = living;
			lastSkin = skin.id();
			lastHitTick = ticks;
		}
	}

	public static void tick(Minecraft client) {
		ticks++;
		if (lastTarget == null) return;
		if (lastTarget.isDeadOrDying()) {
			VantageConfig c = VantageConfig.get();
			if (c.statTrak) {
				int n = c.statTrakKills.merge(lastSkin, 1, Integer::sum);
				VantageConfig.save();
				if (client.player != null) {
					client.player.displayClientMessage(Component.literal("StatTrak™ " + n).withColor(0xFFCF6A32), true);
				}
			}
			lastTarget = null;
		} else if (ticks - lastHitTick > 100 || !lastTarget.isAlive()) {
			lastTarget = null;
		}
	}

	public static void appendTooltip(ItemStack stack, List<Component> lines) {
		SkinCatalog.Skin skin = skinFor(stack);
		if (skin == null || lines.isEmpty()) return;
		int at = 1;
		lines.add(at++, Component.literal(skin.displayName()).withColor(SkinCatalog.rarityColor(skin.rarity())));
		if (VantageConfig.get().statTrak && skin.category().hasShapes()) {
			int kills = VantageConfig.get().statTrakKills.getOrDefault(skin.id(), 0);
			lines.add(at, Component.literal("StatTrak™ Kills: " + kills).withColor(0xFFCF6A32));
		}
	}
}
