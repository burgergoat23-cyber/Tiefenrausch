package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.gui.Draw;
import com.burgergoat.vantage.gui.VantageScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Tasten-Anzeige, Ruestung & Haltbarkeit und Trank-Timer (alles nur Anzeige, keine Hilfe beim Spielen). */
public final class HudModules {
	public static final String[] POSITIONS = {"Oben links", "Oben rechts", "Unten links", "Unten rechts", "Mitte links", "Mitte rechts"};
	private static final Map<String, Float> GLOW = new HashMap<>();
	private static long last;
	private static float dt;

	private HudModules() {
	}

	/** Linke obere Ecke fuer ein Element der Groesse w x h an der gewaehlten Stelle. */
	public static int[] place(int pos, int w, int h, int sw, int sh) {
		int m = 4;
		return switch (pos) {
			case 1 -> new int[]{sw - w - m, m + 60};
			case 2 -> new int[]{m, sh - h - 50};
			case 3 -> new int[]{sw - w - m, sh - h - m};
			case 4 -> new int[]{m, (sh - h) / 2};
			case 5 -> new int[]{sw - w - m, (sh - h) / 2};
			default -> new int[]{m, m + 50};
		};
	}

	public static void render(DrawContext ctx) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null) return;
		long now = System.nanoTime();
		dt = last == 0 ? 0f : Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		VantageConfig c = VantageConfig.get();
		int sw = ctx.getScaledWindowWidth();
		int sh = ctx.getScaledWindowHeight();
		if (c.keystrokes) keystrokes(ctx, mc, c, sw, sh);
		if (c.armorHud) armor(ctx, mc, c, sw, sh);
		if (c.potionHud) potions(ctx, mc, c, sw, sh);
	}

	// ------------------------------------------------------------------ Tasten-Anzeige

	private static float glow(String key, boolean down) {
		float v = GLOW.getOrDefault(key, 0f);
		v = down ? 1f : Math.max(0f, v - dt * 6f);
		GLOW.put(key, v);
		return v;
	}

	private static void key(DrawContext ctx, TextRenderer tr, int x, int y, int w, int h, String label, boolean down, String id) {
		float g = glow(id, down);
		int accent = VantageScreen.accent();
		Draw.roundRect(ctx, x, y, w, h, Draw.mix(0x90000000, Draw.alpha(accent, 0xD0), g));
		Draw.border(ctx, x, y, w, h, Draw.mix(0x40FFFFFF, accent, g));
		ctx.drawCenteredTextWithShadow(tr, label, x + w / 2, y + (h - 8) / 2, Draw.mix(0xFFFFFFFF, 0xFF101010, g * 0.8f));
	}

	/** Maustaste: oben der Name, darunter klein die Klicks pro Sekunde. */
	private static void mouseKey(DrawContext ctx, TextRenderer tr, int x, String label, int cps, boolean down, String id) {
		key(ctx, tr, x, 40, 28, 18, "", down, id);
		float g = GLOW.getOrDefault(id, 0f);
		int col = Draw.mix(0xFFFFFFFF, 0xFF101010, g * 0.8f);
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(x + 14, 42);
		ctx.getMatrices().scale(0.7f, 0.7f);
		ctx.drawCenteredTextWithShadow(tr, label, 0, 0, col);
		ctx.drawCenteredTextWithShadow(tr, cps + " CPS", 0, 11, col);
		ctx.getMatrices().popMatrix();
	}

	private static String name(KeyBinding k) {
		String s = k.getBoundKeyLocalizedText().getString();
		return s.length() > 3 ? s.substring(0, 3) : s;
	}

	private static void keystrokes(DrawContext ctx, MinecraftClient mc, VantageConfig c, int sw, int sh) {
		float scale = Math.max(0.5f, Math.min(2f, c.keystrokesScale));
		int w = 58;
		int h = 69;
		int[] p = place(c.keystrokesPos, Math.round(w * scale), Math.round(h * scale), sw, sh);
		TextRenderer tr = mc.textRenderer;
		var o = mc.options;
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(p[0], p[1]);
		ctx.getMatrices().scale(scale, scale);
		key(ctx, tr, 20, 0, 18, 18, name(o.forwardKey), o.forwardKey.isPressed(), "w");
		key(ctx, tr, 0, 20, 18, 18, name(o.leftKey), o.leftKey.isPressed(), "a");
		key(ctx, tr, 20, 20, 18, 18, name(o.backKey), o.backKey.isPressed(), "s");
		key(ctx, tr, 40, 20, 18, 18, name(o.rightKey), o.rightKey.isPressed(), "d");
		mouseKey(ctx, tr, 0, "LMB", VantageHud.leftCps(), o.attackKey.isPressed(), "lmb");
		mouseKey(ctx, tr, 30, "RMB", VantageHud.rightCps(), o.useKey.isPressed(), "rmb");
		float g = glow("space", o.jumpKey.isPressed());
		int accent = VantageScreen.accent();
		Draw.roundRect(ctx, 0, 60, 58, 9, Draw.mix(0x90000000, Draw.alpha(accent, 0xD0), g));
		Draw.border(ctx, 0, 60, 58, 9, Draw.mix(0x40FFFFFF, accent, g));
		ctx.fill(19, 64, 39, 65, Draw.mix(0xFFFFFFFF, 0xFF101010, g * 0.8f));
		ctx.getMatrices().popMatrix();
	}

	// ------------------------------------------------------------------ Ruestung & Haltbarkeit

	private static int count(PlayerInventory inv, Item item) {
		int n = 0;
		for (int i = 0; i < inv.size(); i++) {
			ItemStack s = inv.getStack(i);
			if (s.isOf(item)) n += s.getCount();
		}
		return n;
	}

	private static void armor(DrawContext ctx, MinecraftClient mc, VantageConfig c, int sw, int sh) {
		PlayerEntity p = mc.player;
		TextRenderer tr = mc.textRenderer;
		List<ItemStack> items = new ArrayList<>();
		for (EquipmentSlot slot : new EquipmentSlot[]{EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET}) {
			ItemStack s = p.getEquippedStack(slot);
			if (!s.isEmpty()) items.add(s);
		}
		if (!p.getMainHandStack().isEmpty()) items.add(p.getMainHandStack());
		if (!p.getOffHandStack().isEmpty()) items.add(p.getOffHandStack());
		List<ItemStack> counts = new ArrayList<>();
		if (c.armorCounts) {
			for (Item it : new Item[]{Items.ARROW, Items.ENDER_PEARL, Items.TOTEM_OF_UNDYING, Items.GOLDEN_APPLE}) {
				int n = count(p.getInventory(), it);
				if (n > 0) counts.add(new ItemStack(it, n));
			}
		}
		if (items.isEmpty() && counts.isEmpty()) return;
		int rows = items.size() + counts.size();
		int w = 62;
		int h = rows * 17 + 2;
		int[] pos = place(c.armorPos, w, h, sw, sh);
		int x = pos[0];
		int y = pos[1];
		Draw.roundRect(ctx, x, y, w, h, 0x70000000);
		boolean blink = (System.currentTimeMillis() / 300) % 2 == 0;
		for (ItemStack s : items) {
			ctx.drawItem(s, x + 2, y + 1);
			String text;
			int color = 0xFFFFFFFF;
			if (s.isDamageable() && s.getMaxDamage() > 0) {
				int left = s.getMaxDamage() - s.getDamage();
				float f = left / (float) s.getMaxDamage();
				text = String.valueOf(left);
				color = f > 0.5f ? 0xFF7CE38B : f > 0.25f ? 0xFFFFD84A : 0xFFFF5A4A;
				if (f < 0.1f && blink) color = 0xFFFFFFFF;
			} else {
				text = s.getCount() > 1 ? "×" + s.getCount() : "";
			}
			ctx.drawTextWithShadow(tr, text, x + 21, y + 5, color);
			y += 17;
		}
		for (ItemStack s : counts) {
			ctx.drawItem(s, x + 2, y + 1);
			ctx.drawTextWithShadow(tr, "×" + s.getCount(), x + 21, y + 5, 0xFFE3E7EC);
			y += 17;
		}
	}

	// ------------------------------------------------------------------ Trank-Timer

	private static String roman(int n) {
		return switch (n) {
			case 1 -> "";
			case 2 -> " II";
			case 3 -> " III";
			case 4 -> " IV";
			case 5 -> " V";
			default -> " " + n;
		};
	}

	private static String time(StatusEffectInstance e) {
		if (e.isInfinite()) return "∞";
		int s = e.getDuration() / 20;
		return (s / 60) + ":" + String.format("%02d", s % 60);
	}

	private static void potions(DrawContext ctx, MinecraftClient mc, VantageConfig c, int sw, int sh) {
		List<StatusEffectInstance> list = new ArrayList<>(mc.player.getStatusEffects());
		if (list.isEmpty()) return;
		list.sort((a, b) -> Integer.compare(b.getDuration(), a.getDuration()));
		TextRenderer tr = mc.textRenderer;
		int w = 0;
		for (StatusEffectInstance e : list) {
			w = Math.max(w, tr.getWidth(e.getEffectType().value().getName().getString() + roman(e.getAmplifier() + 1)));
		}
		w += 26;
		int h = list.size() * 22;
		int[] pos = place(c.potionPos, w, h, sw, sh);
		int x = pos[0];
		int y = pos[1];
		boolean blink = (System.currentTimeMillis() / 250) % 2 == 0;
		for (StatusEffectInstance e : list) {
			int color = 0xFF000000 | e.getEffectType().value().getColor();
			Draw.roundRect(ctx, x, y, w, 20, 0x80000000);
			ctx.fill(x + 1, y + 3, x + 3, y + 17, color);
			ctx.drawGuiTexture(RenderPipelines.GUI_TEXTURED, InGameHud.getEffectTexture(e.getEffectType()), x + 4, y + 1, 18, 18);
			boolean ending = !e.isInfinite() && e.getDuration() < 200;
			ctx.drawTextWithShadow(tr, e.getEffectType().value().getName().getString() + roman(e.getAmplifier() + 1), x + 24, y + 2, 0xFFFFFFFF);
			ctx.drawTextWithShadow(tr, time(e), x + 24, y + 11, ending && blink ? 0xFFFF5A4A : 0xFFB8C4D6);
			y += 22;
		}
	}
}
