package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.gui.Draw;
import com.burgergoat.vantage.gui.VantageScreen;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.ScreenMouseEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.inventory.BrewingStandScreen;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.alchemy.PotionContents;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.alchemy.Potions;
import net.minecraft.world.item.alchemy.PotionBrewing;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Brau-Rezepte neben dem Braustand: alle Traenke mit ihren Zutaten. Die Rezepte werden aus den Brau-Regeln
 * des Spiels selbst berechnet (darum stimmen sie auch auf Servern und in neuen Versionen).
 */
public final class BrewGuide {
	private static final int ROW = 18;
	private static final String[] GROUPS = {"Grundlage", "Seltsamer Trank +", "Umkehren: + Fermentiertes Spinnenauge", "Verbessern"};

	/** Eine Zeile: from + ingredient = to. extra = Hinweis rechts (z. B. "länger"). */
	private record Recipe(int group, ItemStack from, ItemStack ingredient, ItemStack to, boolean longer, boolean stronger,
						  @Nullable String extra) {
	}

	private static List<Recipe> recipes;
	@Nullable
	private static PotionBrewing builtFor;
	private static int scroll;
	private static int maxScroll;
	private static int panelX, panelY, panelW, panelH;

	private BrewGuide() {
	}

	public static void register() {
		ScreenEvents.AFTER_INIT.register((client, screen, w, h) -> {
			if (!(screen instanceof BrewingStandScreen)) return;
			scroll = 0;
			ScreenEvents.afterExtract(screen).register((s, ctx, mouseX, mouseY, delta) -> render(client, ctx, s.width, s.height, mouseX, mouseY));
			ScreenMouseEvents.allowMouseScroll(screen).register((s, mouseX, mouseY, horizontal, vertical) -> {
				if (!VantageConfig.get().brewHelper || mouseX < panelX || mouseX >= panelX + panelW || mouseY < panelY || mouseY >= panelY + panelH) {
					return true;
				}
				scroll = Mth.clamp(scroll - (int) Math.round(vertical * ROW), 0, maxScroll);
				return false;
			});
		});
	}

	// ------------------------------------------------------------------ Rezepte berechnen

	private static String key(ItemStack stack) {
		return BuiltInRegistries.ITEM.getKey(stack.getItem()) + "|" + stack.getHoverName().getString();
	}

	private static boolean hasEffects(ItemStack stack) {
		return stack.getOrDefault(DataComponents.POTION_CONTENTS, PotionContents.EMPTY).hasEffects();
	}

	private static List<Recipe> recipes(Minecraft mc) {
		PotionBrewing reg = mc.level.potionBrewing();
		if (recipes != null && builtFor == reg) return recipes;
		List<Item> ingredients = new ArrayList<>();
		for (Item item : BuiltInRegistries.ITEM) {
			if (item != Items.AIR && reg.isIngredient(new ItemStack(item))) ingredients.add(item);
		}
		ItemStack water = PotionContents.createItemStack(Items.POTION, Potions.WATER);
		ItemStack awkward = PotionContents.createItemStack(Items.POTION, Potions.AWKWARD);
		String waterKey = key(water);
		String awkwardKey = key(awkward);
		// Breitensuche ab der Wasserflasche: welche Zutat macht aus welchem Trank welchen?
		Map<String, Boolean> longer = new HashMap<>();
		Map<String, Boolean> stronger = new HashMap<>();
		List<ItemStack[]> found = new ArrayList<>();
		Set<String> seen = new HashSet<>();
		ArrayDeque<ItemStack> queue = new ArrayDeque<>();
		queue.add(water);
		seen.add(waterKey);
		while (!queue.isEmpty()) {
			ItemStack from = queue.poll();
			String fromKey = key(from);
			for (Item ing : ingredients) {
				ItemStack ingStack = new ItemStack(ing);
				ItemStack to = reg.mix(ingStack, from.copy());
				if (to.isEmpty() || to.getItem() != Items.POTION || key(to).equals(fromKey)) continue;
				if (ing == Items.REDSTONE) {
					longer.put(fromKey, true);
					continue;
				}
				if (ing == Items.GLOWSTONE_DUST) {
					stronger.put(fromKey, true);
					continue;
				}
				found.add(new ItemStack[]{from, ingStack, to});
				if (seen.add(key(to))) queue.add(to);
			}
		}
		List<Recipe> out = new ArrayList<>();
		Set<String> listed = new HashSet<>();
		for (ItemStack[] f : found) {
			String fromKey = key(f[0]);
			String toKey = key(f[2]);
			int group;
			if (f[1].is(Items.FERMENTED_SPIDER_EYE)) group = 2;
			else if (fromKey.equals(waterKey) && toKey.equals(awkwardKey)) group = 0;
			else if (fromKey.equals(awkwardKey)) group = 1;
			else continue;
			if (group != 0 && !hasEffects(f[2])) continue;
			if (!listed.add(group + fromKey + toKey)) continue;
			out.add(new Recipe(group, f[0], f[1], f[2], longer.getOrDefault(toKey, false), stronger.getOrDefault(toKey, false), null));
		}
		out.add(new Recipe(3, ItemStack.EMPTY, new ItemStack(Items.REDSTONE), ItemStack.EMPTY, false, false, "hält länger"));
		out.add(new Recipe(3, ItemStack.EMPTY, new ItemStack(Items.GLOWSTONE_DUST), ItemStack.EMPTY, false, false, "stärker (Stufe II)"));
		out.add(new Recipe(3, ItemStack.EMPTY, new ItemStack(Items.GUNPOWDER), PotionContents.createItemStack(Items.SPLASH_POTION, Potions.HEALING),
				false, false, "Wurftrank"));
		out.add(new Recipe(3, ItemStack.EMPTY, new ItemStack(Items.DRAGON_BREATH), PotionContents.createItemStack(Items.LINGERING_POTION, Potions.HEALING),
				false, false, "Verweiltrank"));
		out.sort((a, b) -> Integer.compare(a.group, b.group));
		recipes = out;
		builtFor = reg;
		return out;
	}

	// ------------------------------------------------------------------ Zeichnen

	private static boolean has(Inventory inv, ItemStack stack) {
		for (int i = 0; i < inv.getContainerSize(); i++) {
			if (inv.getItem(i).is(stack.getItem())) return true;
		}
		return false;
	}

	private static void render(Minecraft mc, GuiGraphicsExtractor ctx, int width, int height, int mouseX, int mouseY) {
		if (!VantageConfig.get().brewHelper || mc.player == null || mc.level == null) return;
		int guiX = (width - 176) / 2;
		int guiY = (height - 166) / 2;
		panelW = Math.min(150, guiX - 8);
		if (panelW < 96) return;
		panelX = guiX - 4 - panelW;
		panelY = Math.max(4, guiY - 30);
		panelH = Math.min(height - panelY - 4, 270);
		Font tr = mc.font;
		int accent = VantageScreen.accent();
		List<Recipe> list = recipes(mc);

		Draw.roundGradient(ctx, panelX, panelY, panelW, panelH, 0xF01A2029, 0xF0101419);
		Draw.border(ctx, panelX, panelY, panelW, panelH, Draw.alpha(accent, 0xA0));
		Draw.roundRect(ctx, panelX + 4, panelY + 5, 3, 10, accent);
		ctx.text(tr, "Brau-Rezepte", panelX + 11, panelY + 6, 0xFFFFFFFF);
		int top = panelY + 20;
		int bottom = panelY + panelH - 4;
		ctx.fill(panelX + 4, top - 2, panelX + panelW - 4, top - 1, Draw.alpha(accent, 0x60));

		ctx.enableScissor(panelX + 1, top, panelX + panelW - 1, bottom);
		int y = top + 2 - scroll;
		int group = -1;
		Recipe hover = null;
		for (Recipe r : list) {
			if (r.group != group) {
				group = r.group;
				ctx.text(tr, tr.plainSubstrByWidth(GROUPS[group], panelW - 10), panelX + 6, y + 2, Draw.mix(accent, 0xFFFFFFFF, 0.3f));
				y += 13;
			}
			boolean hov = mouseX >= panelX + 2 && mouseX < panelX + panelW - 2 && mouseY >= Math.max(y, top) && mouseY < Math.min(y + ROW, bottom);
			if (hov) {
				Draw.roundRect(ctx, panelX + 3, y, panelW - 6, ROW, 0x20FFFFFF);
				hover = r;
			}
			int x = panelX + 5;
			if (r.group == 0 || r.group == 2) {
				ctx.item(r.from, x, y + 1);
				x += 16;
				ctx.text(tr, "+", x + 1, y + 5, 0xFF98A2AE);
				x += 8;
			}
			// Zutat; gruener Punkt = hast du dabei
			ctx.item(r.ingredient, x, y + 1);
			if (has(mc.player.getInventory(), r.ingredient)) Draw.roundRect(ctx, x + 12, y + 1, 4, 4, 0xFF4CD07D);
			x += 17;
			if (r.extra != null) {
				if (!r.to.isEmpty()) {
					ctx.item(r.to, x, y + 1);
					x += 18;
				} else {
					ctx.text(tr, "→", x + 1, y + 5, 0xFF98A2AE);
					x += 10;
				}
				ctx.text(tr, tr.plainSubstrByWidth(r.extra, panelX + panelW - 6 - x), x, y + 5, 0xFFE3E7EC);
			} else {
				ctx.text(tr, "→", x, y + 5, 0xFF98A2AE);
				x += 8;
				ctx.item(r.to, x, y + 1);
				x += 18;
				int right = panelX + panelW - 6 - (r.longer ? 5 : 0) - (r.stronger ? 5 : 0);
				ctx.text(tr, tr.plainSubstrByWidth(shortName(r.to), right - x), x, y + 5, 0xFFE3E7EC);
				// Kleine Punkte: rot = mit Redstone laenger, gelb = mit Glowstone staerker
				int dx = panelX + panelW - 8;
				if (r.stronger) {
					Draw.roundRect(ctx, dx, y + 7, 4, 4, 0xFFFFD84A);
					dx -= 5;
				}
				if (r.longer) Draw.roundRect(ctx, dx, y + 7, 4, 4, 0xFFE0402A);
			}
			y += ROW;
		}
		ctx.disableScissor();
		int content = y + scroll - top;
		maxScroll = Math.max(0, content - (bottom - top));
		scroll = Math.min(scroll, maxScroll);
		if (maxScroll > 0) {
			int barH = Math.max(12, (bottom - top) * (bottom - top) / content);
			int barY = top + Math.round((bottom - top - barH) * (scroll / (float) maxScroll));
			Draw.roundRect(ctx, panelX + panelW - 4, barY, 2, barH, accent);
		}
		if (hover != null && mouseY >= top && mouseY < bottom) ctx.setComponentTooltipForNextFrame(tr, tooltip(hover), mouseX, mouseY);
	}

	/** "Trank der Stärke" -> "Stärke" (spart Platz in der Liste). */
	private static String shortName(ItemStack stack) {
		String n = stack.getHoverName().getString();
		for (String p : new String[]{"Trank der ", "Trank des ", "Trank vom ", "Trank von ", "Potion of "}) {
			if (n.startsWith(p)) return n.substring(p.length());
		}
		return n;
	}

	private static List<Component> tooltip(Recipe r) {
		List<Component> lines = new ArrayList<>();
		if (r.extra != null) {
			lines.add(Component.literal(r.ingredient.getHoverName().getString() + ": " + r.extra).withColor(0xFFFFFFFF));
			lines.add(Component.literal("Kommt zu einem fertigen Trank dazu.").withColor(0xFF98A2AE));
			return lines;
		}
		lines.add(r.to.getHoverName().copy());
		lines.add(Component.literal(r.from.getHoverName().getString() + " + " + r.ingredient.getHoverName().getString()).withColor(0xFFB8C4D6));
		if (r.group == 1) lines.add(Component.literal("Seltsamer Trank = Wasserflasche + Netherwarze").withColor(0xFF98A2AE));
		if (r.longer) lines.add(Component.literal("+ Redstone: hält länger").withColor(0xFFE0705A));
		if (r.stronger) lines.add(Component.literal("+ Glowstonestaub: stärker").withColor(0xFFFFD84A));
		lines.add(Component.literal("+ Schießpulver: Wurftrank · + Drachenatem: Verweiltrank").withColor(0xFF98A2AE));
		return lines;
	}
}
