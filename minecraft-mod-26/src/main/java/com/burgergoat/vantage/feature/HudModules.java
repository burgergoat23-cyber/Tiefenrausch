package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.gui.Draw;
import com.burgergoat.vantage.gui.VantageScreen;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.Hud;
import net.minecraft.client.KeyMapping;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

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

	public static void render(GuiGraphicsExtractor ctx) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.player == null) return;
		long now = System.nanoTime();
		dt = last == 0 ? 0f : Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		VantageConfig c = VantageConfig.get();
		int sw = ctx.guiWidth();
		int sh = ctx.guiHeight();
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

	private static void key(GuiGraphicsExtractor ctx, Font tr, int x, int y, int w, int h, String label, boolean down, String id) {
		float g = glow(id, down);
		int accent = VantageScreen.accent();
		Draw.roundRect(ctx, x, y, w, h, Draw.mix(0x90000000, Draw.alpha(accent, 0xD0), g));
		Draw.border(ctx, x, y, w, h, Draw.mix(0x40FFFFFF, accent, g));
		ctx.centeredText(tr, label, x + w / 2, y + (h - 8) / 2, Draw.mix(0xFFFFFFFF, 0xFF101010, g * 0.8f));
	}

	/** Maustaste: oben der Name, darunter klein die Klicks pro Sekunde. */
	private static void mouseKey(GuiGraphicsExtractor ctx, Font tr, int x, String label, int cps, boolean down, String id) {
		key(ctx, tr, x, 40, 28, 18, "", down, id);
		float g = GLOW.getOrDefault(id, 0f);
		int col = Draw.mix(0xFFFFFFFF, 0xFF101010, g * 0.8f);
		ctx.pose().pushMatrix();
		ctx.pose().translate(x + 14, 42);
		ctx.pose().scale(0.7f, 0.7f);
		ctx.centeredText(tr, label, 0, 0, col);
		ctx.centeredText(tr, cps + " CPS", 0, 11, col);
		ctx.pose().popMatrix();
	}

	private static String name(KeyMapping k) {
		String s = k.getTranslatedKeyMessage().getString();
		return s.length() > 3 ? s.substring(0, 3) : s;
	}

	private static void keystrokes(GuiGraphicsExtractor ctx, Minecraft mc, VantageConfig c, int sw, int sh) {
		float scale = Math.max(0.5f, Math.min(2f, c.keystrokesScale));
		int w = 58;
		int h = 69;
		int[] p = place(c.keystrokesPos, Math.round(w * scale), Math.round(h * scale), sw, sh);
		Font tr = mc.font;
		var o = mc.options;
		ctx.pose().pushMatrix();
		ctx.pose().translate(p[0], p[1]);
		ctx.pose().scale(scale, scale);
		key(ctx, tr, 20, 0, 18, 18, name(o.keyUp), o.keyUp.isDown(), "w");
		key(ctx, tr, 0, 20, 18, 18, name(o.keyLeft), o.keyLeft.isDown(), "a");
		key(ctx, tr, 20, 20, 18, 18, name(o.keyDown), o.keyDown.isDown(), "s");
		key(ctx, tr, 40, 20, 18, 18, name(o.keyRight), o.keyRight.isDown(), "d");
		mouseKey(ctx, tr, 0, "LMB", VantageHud.leftCps(), o.keyAttack.isDown(), "lmb");
		mouseKey(ctx, tr, 30, "RMB", VantageHud.rightCps(), o.keyUse.isDown(), "rmb");
		float g = glow("space", o.keyJump.isDown());
		int accent = VantageScreen.accent();
		Draw.roundRect(ctx, 0, 60, 58, 9, Draw.mix(0x90000000, Draw.alpha(accent, 0xD0), g));
		Draw.border(ctx, 0, 60, 58, 9, Draw.mix(0x40FFFFFF, accent, g));
		ctx.fill(19, 64, 39, 65, Draw.mix(0xFFFFFFFF, 0xFF101010, g * 0.8f));
		ctx.pose().popMatrix();
	}

	// ------------------------------------------------------------------ Ruestung & Haltbarkeit

	private static int count(Inventory inv, Item item) {
		int n = 0;
		for (int i = 0; i < inv.getContainerSize(); i++) {
			ItemStack s = inv.getItem(i);
			if (s.is(item)) n += s.getCount();
		}
		return n;
	}

	private static void armor(GuiGraphicsExtractor ctx, Minecraft mc, VantageConfig c, int sw, int sh) {
		Player p = mc.player;
		Font tr = mc.font;
		List<ItemStack> items = new ArrayList<>();
		for (EquipmentSlot slot : new EquipmentSlot[]{EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET}) {
			ItemStack s = p.getItemBySlot(slot);
			if (!s.isEmpty()) items.add(s);
		}
		if (!p.getMainHandItem().isEmpty()) items.add(p.getMainHandItem());
		if (!p.getOffhandItem().isEmpty()) items.add(p.getOffhandItem());
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
			ctx.item(s, x + 2, y + 1);
			String text;
			int color = 0xFFFFFFFF;
			if (s.isDamageableItem() && s.getMaxDamage() > 0) {
				int left = s.getMaxDamage() - s.getDamageValue();
				float f = left / (float) s.getMaxDamage();
				text = String.valueOf(left);
				color = f > 0.5f ? 0xFF7CE38B : f > 0.25f ? 0xFFFFD84A : 0xFFFF5A4A;
				if (f < 0.1f && blink) color = 0xFFFFFFFF;
			} else {
				text = s.getCount() > 1 ? "×" + s.getCount() : "";
			}
			ctx.text(tr, text, x + 21, y + 5, color);
			y += 17;
		}
		for (ItemStack s : counts) {
			ctx.item(s, x + 2, y + 1);
			ctx.text(tr, "×" + s.getCount(), x + 21, y + 5, 0xFFE3E7EC);
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

	private static String time(MobEffectInstance e) {
		if (e.isInfiniteDuration()) return "∞";
		int s = e.getDuration() / 20;
		return (s / 60) + ":" + String.format("%02d", s % 60);
	}

	private static void potions(GuiGraphicsExtractor ctx, Minecraft mc, VantageConfig c, int sw, int sh) {
		List<MobEffectInstance> list = new ArrayList<>(mc.player.getActiveEffects());
		if (list.isEmpty()) return;
		list.sort((a, b) -> Integer.compare(b.getDuration(), a.getDuration()));
		Font tr = mc.font;
		int w = 0;
		for (MobEffectInstance e : list) {
			w = Math.max(w, tr.width(e.getEffect().value().getDisplayName().getString() + roman(e.getAmplifier() + 1)));
		}
		w += 26;
		int h = list.size() * 22;
		int[] pos = place(c.potionPos, w, h, sw, sh);
		int x = pos[0];
		int y = pos[1];
		boolean blink = (System.currentTimeMillis() / 250) % 2 == 0;
		for (MobEffectInstance e : list) {
			int color = 0xFF000000 | e.getEffect().value().getColor();
			Draw.roundRect(ctx, x, y, w, 20, 0x80000000);
			ctx.fill(x + 1, y + 3, x + 3, y + 17, color);
			ctx.blitSprite(RenderPipelines.GUI_TEXTURED, Hud.getMobEffectSprite(e.getEffect()), x + 4, y + 1, 18, 18);
			boolean ending = !e.isInfiniteDuration() && e.getDuration() < 200;
			ctx.text(tr, e.getEffect().value().getDisplayName().getString() + roman(e.getAmplifier() + 1), x + 24, y + 2, 0xFFFFFFFF);
			ctx.text(tr, time(e), x + 24, y + 11, ending && blink ? 0xFFFF5A4A : 0xFFB8C4D6);
			y += 22;
		}
	}
}
