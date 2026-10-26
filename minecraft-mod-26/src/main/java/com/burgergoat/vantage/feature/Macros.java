package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.mixin.ClientPlayerInteractionManagerAccessor;
import com.burgergoat.vantage.mixin.MinecraftClientAccessor;
import com.burgergoat.vantage.skin.SkinManager;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.function.Predicate;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.Holder;
import net.minecraft.network.chat.Component;
import net.minecraft.tags.ItemTags;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.phys.EntityHitResult;

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
	/** Ergebnis des letzten Speer-Stosses (fuer den Test). */
	public static boolean lastJab;

	private Macros() {
	}

	/** Tick, in dem zuletzt ein Makro zurueckgewechselt hat. */
	private static int swappedBackAt = -100;

	/** Laeuft gerade ein Makro (dann keine Zieh-Animation beim schnellen Wechseln). */
	public static boolean isBusy() {
		return busy;
	}

	/** Makro laeuft oder hat in diesem Tick gerade zurueckgewechselt. */
	public static boolean isBusyOrJustDone() {
		return busy || tick - swappedBackAt <= 0;
	}

	public static void tick(Minecraft client) {
		tick++;
		if (client.player == null || client.gameMode == null) {
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

	private static void select(Minecraft client, int slot) {
		if (client.player == null || client.gameMode == null) return;
		client.player.getInventory().setSelectedSlot(slot);
		((ClientPlayerInteractionManagerAccessor) client.gameMode).vantage$syncSelectedSlot();
	}

	private static int find(Player player, Predicate<ItemStack> test) {
		for (int i = 0; i < 9; i++) {
			if (test.test(player.getInventory().getItem(i))) return i;
		}
		return -1;
	}

	private static void msg(Minecraft client, String text) {
		if (client.player != null) client.player.sendOverlayMessage(Component.literal(text).withColor(0xFFFFB347));
	}

	public static boolean isSpear(ItemStack s) {
		return !s.isEmpty() && SkinManager.key(s.getItem()).endsWith("_spear");
	}

	public static boolean isSword(ItemStack s) {
		return s.is(ItemTags.SWORDS);
	}

	public static boolean isAxe(ItemStack s) {
		return s.is(ItemTags.AXES);
	}

	public static boolean hasLunge(ItemStack s) {
		for (Holder<Enchantment> e : s.getEnchantments().keySet()) {
			if (e.unwrapKey().map(k -> k.identifier().getPath().equals("lunge")).orElse(false)) return true;
		}
		return false;
	}

	private static void attack(Minecraft client) {
		if (client.player == null) return;
		internalAttack = true;
		try {
			lastJab = ((MinecraftClientAccessor) client).vantage$doAttack();
		} finally {
			internalAttack = false;
		}
	}

	private static void swapBackLater(Minecraft client, int usedSlot, int back, int delay) {
		later(Math.max(0, delay), () -> {
			if (client.player != null && client.player.getInventory().getSelectedSlot() == usedSlot) {
				select(client, back);
				swappedBackAt = tick;
			}
			busy = false;
		});
	}

	// ------------------------------------------------------------ Lunge-Swap

	/**
	 * Wechselt auf den Speer, macht den Stoss (mit Lunge) und wechselt zurueck.
	 * Speere brauchen volle Angriffs-Aufladung (minimum_attack_charge = 1). Minecraft setzt die Aufladung erst im
	 * naechsten Spieler-Tick nach einem Item-Wechsel zurueck – deshalb muss der Stoss im selben Tick wie der Wechsel
	 * passieren (lungeDelay = 0), dann zaehlt noch die Aufladung des vorherigen Items.
	 */
	public static void lungeSwap(Minecraft client) {
		VantageConfig c = VantageConfig.get();
		LocalPlayer p = client.player;
		if (!c.lungeEnabled || busy || p == null || client.gui.screen() != null) return;
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

	/**
	 * Nach dem Werfen einer Windladung automatisch Lunge-Swap (falls eingeschaltet).
	 * Wartezeit 0 = noch im selben Tick (am Ende des Ticks, nachdem der Wurf abgeschickt ist).
	 */
	public static void afterUse(Minecraft client, ItemStack used) {
		VantageConfig c = VantageConfig.get();
		if (c.lungeAfterWind && used.is(Items.WIND_CHARGE)) {
			TASKS.add(new Task(tick + Math.max(0, c.lungeAfterWindDelay), () -> lungeSwap(client)));
		}
	}

	// ------------------------------------------------------------ Attribut-Swap / Schild-Brecher

	/** Wird direkt vor jedem normalen Linksklick-Angriff aufgerufen. */
	public static void beforeAttack(Minecraft client) {
		if (internalAttack || busy || client.player == null || client.gameMode == null) return;
		if (!(client.hitResult instanceof EntityHitResult hit)) return;
		VantageConfig c = VantageConfig.get();
		LocalPlayer p = client.player;
		Entity target = hit.getEntity();
		ItemStack held = p.getMainHandItem();
		int current = p.getInventory().getSelectedSlot();

		if (c.maceSwap && !held.is(Items.MACE)
				&& ((c.maceFromSword && isSword(held)) || (c.maceFromAxe && isAxe(held)))
				&& (!c.maceOnlyFalling || p.fallDistance >= c.maceMinFall)) {
			int mace = find(p, s -> s.is(Items.MACE));
			if (mace >= 0) {
				busy = true;
				attributeSwaps++;
				select(client, mace);
				swapBackLater(client, mace, current, Math.max(1, c.maceReturnDelay));
				return;
			}
		}
		if (c.shieldBreaker && target instanceof Player enemy && enemy.isBlocking() && !isAxe(held)) {
			int axe = find(p, Macros::isAxe);
			if (axe >= 0) {
				busy = true;
				select(client, axe);
				swapBackLater(client, axe, current, Math.max(1, c.maceReturnDelay));
			}
		}
	}

	// ------------------------------------------------------------ Schnell-Benutzen

	public static void quickUse(Minecraft client, Item item, String name) {
		LocalPlayer p = client.player;
		if (busy || p == null || client.gameMode == null || client.gui.screen() != null) return;
		int slot = find(p, s -> s.is(item));
		if (slot < 0) {
			msg(client, "Keine " + name + " in der Hotbar");
			return;
		}
		if (p.getCooldowns().isOnCooldown(p.getInventory().getItem(slot))) {
			msg(client, name + " lädt noch …");
			return;
		}
		int prev = p.getInventory().getSelectedSlot();
		busy = true;
		select(client, slot);
		client.gameMode.useItem(p, InteractionHand.MAIN_HAND);
		p.swing(InteractionHand.MAIN_HAND);
		if (VantageConfig.get().quickReturn && prev != slot) swapBackLater(client, slot, prev, 2);
		else busy = false;
	}
}
