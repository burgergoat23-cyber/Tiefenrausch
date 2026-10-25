package com.burgergoat.arsenal.skin;

import com.burgergoat.arsenal.ArsenalClient;
import com.burgergoat.arsenal.config.ArsenalConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.text.Text;
import net.minecraft.util.HeldItemContext;
import net.minecraft.util.Identifier;
import org.jetbrains.annotations.Nullable;

import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

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
	public static Identifier resolve(ItemStack stack, @Nullable HeldItemContext context, @Nullable Identifier current) {
		ArsenalConfig c = ArsenalConfig.get();
		if (!c.skinsEnabled || stack.isEmpty()) return null;
		if (current != null && ArsenalClient.MOD_ID.equals(current.getNamespace())) return null;
		if (NO_SKIN.contains(stack)) return null;
		if (c.skinsOnlyOwn && context != null) {
			LivingEntity owner = context.getEntity();
			if (owner != null && owner != MinecraftClient.getInstance().player) return null;
		}
		if (cacheVersion != ArsenalConfig.version()) rebuild();
		return MODEL_CACHE.get(stack.getItem());
	}

	private static void rebuild() {
		MODEL_CACHE.clear();
		for (Map.Entry<String, String> e : ArsenalConfig.get().skins.entrySet()) {
			Item item = item(e.getKey());
			SkinCatalog.Skin skin = SkinCatalog.skin(e.getValue());
			if (item != null && skin != null) {
				MODEL_CACHE.put(item, Identifier.of(ArsenalClient.MOD_ID, skin.id()));
			}
		}
		cacheVersion = ArsenalConfig.version();
	}

	@Nullable
	public static Item item(String path) {
		Optional<Item> item = Registries.ITEM.getOptionalValue(Identifier.ofVanilla(path));
		return item.orElse(null);
	}

	public static String key(Item item) {
		Identifier id = Registries.ITEM.getId(item);
		return id.getPath();
	}

	@Nullable
	public static SkinCatalog.Skin skinFor(ItemStack stack) {
		if (stack.isEmpty() || !ArsenalConfig.get().skinsEnabled) return null;
		return SkinCatalog.skin(ArsenalConfig.get().skins.get(key(stack.getItem())));
	}

	/** Gegenstand zum Anzeigen im Menue, der ein bestimmtes Skin-Modell traegt. */
	public static ItemStack preview(@Nullable SkinCatalog.Skin skin, String itemPath) {
		String k = (skin == null ? "-" : skin.id()) + "@" + itemPath;
		return PREVIEWS.computeIfAbsent(k, key -> {
			Item item = item(itemPath);
			if (item == null) return ItemStack.EMPTY;
			ItemStack stack = new ItemStack(item);
			if (skin != null) {
				stack.set(DataComponentTypes.ITEM_MODEL, Identifier.of(ArsenalClient.MOD_ID, skin.id()));
			} else {
				NO_SKIN.add(stack);
			}
			return stack;
		});
	}

	public static void equip(String itemPath, @Nullable SkinCatalog.Skin skin) {
		if (skin == null) {
			ArsenalConfig.get().skins.remove(itemPath);
		} else {
			ArsenalConfig.get().skins.put(itemPath, skin.id());
		}
		ArsenalConfig.save();
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

	public static void tick(MinecraftClient client) {
		ticks++;
		if (lastTarget == null) return;
		if (lastTarget.isDead()) {
			ArsenalConfig c = ArsenalConfig.get();
			if (c.statTrak) {
				int n = c.statTrakKills.merge(lastSkin, 1, Integer::sum);
				ArsenalConfig.save();
				if (client.player != null) {
					client.player.sendMessage(Text.literal("StatTrak™ " + n).withColor(0xFFCF6A32), true);
				}
			}
			lastTarget = null;
		} else if (ticks - lastHitTick > 100 || !lastTarget.isAlive()) {
			lastTarget = null;
		}
	}

	public static void appendTooltip(ItemStack stack, List<Text> lines) {
		SkinCatalog.Skin skin = skinFor(stack);
		if (skin == null || lines.isEmpty()) return;
		int at = 1;
		lines.add(at++, Text.literal(skin.displayName()).withColor(SkinCatalog.rarityColor(skin.rarity())));
		if (ArsenalConfig.get().statTrak && skin.category().hasShapes()) {
			int kills = ArsenalConfig.get().statTrakKills.getOrDefault(skin.id(), 0);
			lines.add(at, Text.literal("StatTrak™ Kills: " + kills).withColor(0xFFCF6A32));
		}
	}
}
