package com.burgergoat.arsenal.feature;

import com.burgergoat.arsenal.config.ArsenalConfig;
import com.burgergoat.arsenal.mixin.ClientPlayerInteractionManagerAccessor;
import com.burgergoat.arsenal.mixin.MinecraftClientAccessor;
import com.burgergoat.arsenal.skin.SkinManager;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.enchantment.Enchantment;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.registry.tag.ItemTags;
import net.minecraft.text.Text;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.EntityHitResult;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.function.Predicate;

/**
 * Tasten-Makros: Lunge-Swap (Speer), Attribut-Swap (Streitkolben), Schild-Brecher (Axt),
 * Schnell-Perle und Schnell-Windladung. Jede Aktion wird nur durch eine eigene Eingabe ausgeloest.
 */
public final class Macros {
	private record Task(int at, Runnable run) {
	}

	private static final List<Task> TASKS = new ArrayList<>();
	private static int tick;
	private static boolean busy;
	private static boolean internalAttack;
	/** Zaehler fuer den automatischen Test. */
	public static int attributeSwaps;

	private Macros() {
	}

	/** Laeuft gerade ein Makro (dann keine Zieh-Animation beim schnellen Wechseln). */
	public static boolean isBusy() {
		return busy;
	}

	public static void tick(MinecraftClient client) {
		tick++;
		if (client.player == null || client.interactionManager == null) {
			TASKS.clear();
			busy = false;
			return;
		}
		List<Task> due = new ArrayList<>();
		for (Iterator<Task> it = TASKS.iterator(); it.hasNext(); ) {
			Task t = it.next();
			if (t.at() <= tick) {
				due.add(t);
				it.remove();
			}
		}
		for (Task t : due) t.run().run();
	}

	private static void later(int delay, Runnable r) {
		if (delay <= 0) r.run();
		else TASKS.add(new Task(tick + delay, r));
	}

	// ------------------------------------------------------------ Hilfen

	private static void select(MinecraftClient client, int slot) {
		if (client.player == null || client.interactionManager == null) return;
		client.player.getInventory().setSelectedSlot(slot);
		((ClientPlayerInteractionManagerAccessor) client.interactionManager).arsenal$syncSelectedSlot();
	}

	private static int find(PlayerEntity player, Predicate<ItemStack> test) {
		for (int i = 0; i < 9; i++) {
			if (test.test(player.getInventory().getStack(i))) return i;
		}
		return -1;
	}

	private static void msg(MinecraftClient client, String text) {
		if (client.player != null) client.player.sendMessage(Text.literal(text).withColor(0xFFFFB347), true);
	}

	public static boolean isSpear(ItemStack s) {
		return !s.isEmpty() && SkinManager.key(s.getItem()).endsWith("_spear");
	}

	public static boolean isSword(ItemStack s) {
		return s.isIn(ItemTags.SWORDS);
	}

	public static boolean isAxe(ItemStack s) {
		return s.isIn(ItemTags.AXES);
	}

	public static boolean hasLunge(ItemStack s) {
		for (RegistryEntry<Enchantment> e : s.getEnchantments().getEnchantments()) {
			if (e.getKey().map(k -> k.getValue().getPath().equals("lunge")).orElse(false)) return true;
		}
		return false;
	}

	private static void attack(MinecraftClient client) {
		if (client.player == null) return;
		internalAttack = true;
		try {
			((MinecraftClientAccessor) client).arsenal$doAttack();
		} finally {
			internalAttack = false;
		}
	}

	private static void swapBackLater(MinecraftClient client, int usedSlot, int back, int delay) {
		later(Math.max(0, delay), () -> {
			if (client.player != null && client.player.getInventory().getSelectedSlot() == usedSlot) {
				select(client, back);
			}
			busy = false;
		});
	}

	// ------------------------------------------------------------ Lunge-Swap

	/** Wechselt auf den Speer, macht den Stoss (mit Lunge) und wechselt zurueck. */
	public static void lungeSwap(MinecraftClient client) {
		ArsenalConfig c = ArsenalConfig.get();
		ClientPlayerEntity p = client.player;
		if (!c.lungeEnabled || busy || p == null || client.currentScreen != null) return;
		int slot = find(p, s -> isSpear(s) && hasLunge(s));
		if (slot < 0 && !c.lungeOnlyEnchanted) slot = find(p, Macros::isSpear);
		if (slot < 0) {
			msg(client, c.lungeOnlyEnchanted ? "Kein Speer mit Sprungangriff (Lunge) in der Hotbar" : "Kein Speer in der Hotbar");
			return;
		}
		int prev = p.getInventory().getSelectedSlot();
		int spear = slot;
		busy = true;
		select(client, spear);
		later(c.lungeDelay, () -> {
			attack(client);
			if (c.lungeReturn && prev != spear) swapBackLater(client, spear, prev, c.lungeReturnDelay);
			else busy = false;
		});
	}

	/** Nach dem Werfen einer Windladung automatisch Lunge-Swap (falls eingeschaltet). */
	public static void afterUse(MinecraftClient client, ItemStack used) {
		ArsenalConfig c = ArsenalConfig.get();
		if (c.lungeAfterWind && used.isOf(Items.WIND_CHARGE)) {
			TASKS.add(new Task(tick + Math.max(1, c.lungeAfterWindDelay), () -> lungeSwap(client)));
		}
	}

	// ------------------------------------------------------------ Attribut-Swap / Schild-Brecher

	/** Wird direkt vor jedem normalen Linksklick-Angriff aufgerufen. */
	public static void beforeAttack(MinecraftClient client) {
		if (internalAttack || busy || client.player == null || client.interactionManager == null) return;
		if (!(client.crosshairTarget instanceof EntityHitResult hit)) return;
		ArsenalConfig c = ArsenalConfig.get();
		ClientPlayerEntity p = client.player;
		Entity target = hit.getEntity();
		ItemStack held = p.getMainHandStack();
		int current = p.getInventory().getSelectedSlot();

		if (c.maceSwap && !held.isOf(Items.MACE)
				&& ((c.maceFromSword && isSword(held)) || (c.maceFromAxe && isAxe(held)))
				&& (!c.maceOnlyFalling || p.fallDistance >= c.maceMinFall)) {
			int mace = find(p, s -> s.isOf(Items.MACE));
			if (mace >= 0) {
				busy = true;
				attributeSwaps++;
				select(client, mace);
				swapBackLater(client, mace, current, Math.max(1, c.maceReturnDelay));
				return;
			}
		}
		if (c.shieldBreaker && target instanceof PlayerEntity enemy && enemy.isBlocking() && !isAxe(held)) {
			int axe = find(p, Macros::isAxe);
			if (axe >= 0) {
				busy = true;
				select(client, axe);
				swapBackLater(client, axe, current, Math.max(1, c.maceReturnDelay));
			}
		}
	}

	// ------------------------------------------------------------ Schnell-Benutzen

	public static void quickUse(MinecraftClient client, Item item, String name) {
		ClientPlayerEntity p = client.player;
		if (busy || p == null || client.interactionManager == null || client.currentScreen != null) return;
		int slot = find(p, s -> s.isOf(item));
		if (slot < 0) {
			msg(client, "Keine " + name + " in der Hotbar");
			return;
		}
		if (p.getItemCooldownManager().isCoolingDown(p.getInventory().getStack(slot))) {
			msg(client, name + " lädt noch …");
			return;
		}
		int prev = p.getInventory().getSelectedSlot();
		busy = true;
		select(client, slot);
		client.interactionManager.interactItem(p, Hand.MAIN_HAND);
		p.swingHand(Hand.MAIN_HAND);
		if (ArsenalConfig.get().quickReturn && prev != slot) swapBackLater(client, slot, prev, 2);
		else busy = false;
	}
}
