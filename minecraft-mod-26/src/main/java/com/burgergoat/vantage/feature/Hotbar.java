package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.gui.Draw;
import com.burgergoat.vantage.gui.VantageScreen;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElement;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.AttackIndicatorStatus;
import net.minecraft.client.DeltaTracker;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.entity.HumanoidArm;

/**
 * Eigene Hotbar in mehreren Stilen. Gleiche Groesse und Lage wie die normale, damit Herzen, Hunger und
 * Erfahrungsleiste genau passen. Die Auswahl gleitet auf Wunsch weich zum neuen Platz.
 */
public final class Hotbar {
	public static final String[] STYLES = {"Normal", "Dunkel", "Glas", "Neon", "Minimal"};
	private static float selX = -1;
	private static long last;

	private Hotbar() {
	}

	public static HudElement wrap(HudElement vanilla) {
		return (ctx, tickCounter) -> {
			Minecraft mc = Minecraft.getInstance();
			int style = VantageConfig.get().hotbarStyle;
			if (style <= 0 || style >= STYLES.length || mc.player == null || mc.player.isSpectator()) {
				vanilla.extractRenderState(ctx, tickCounter);
				return;
			}
			render(ctx, tickCounter, mc, style);
		};
	}

	private static void render(GuiGraphicsExtractor ctx, DeltaTracker tick, Minecraft mc, int style) {
		Player p = mc.player;
		VantageConfig c = VantageConfig.get();
		int h = ctx.guiHeight();
		int left = ctx.guiWidth() / 2 - 91;
		int top = h - 22;
		int sel = p.getInventory().getSelectedSlot();
		long now = System.nanoTime();
		float dt = last == 0 ? 0f : Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		if (selX < 0 || !c.hotbarSmooth) selX = sel;
		else selX += (sel - selX) * (1f - (float) Math.exp(-dt * 22f));

		ItemStack off = p.getOffhandItem();
		boolean offLeft = p.getMainArm().getOpposite() == HumanoidArm.LEFT;
		int offBox = off.isEmpty() ? Integer.MIN_VALUE : offLeft ? left - 29 : left + 189;
		drawFrame(ctx, left, top, style, selX, c.hotbarNumbers, offBox);
		int seed = 1;
		for (int m = 0; m < 9; m++) item(ctx, mc, tick, p, p.getInventory().getItem(m), left + 3 + m * 20, h - 19, seed++);
		if (!off.isEmpty()) item(ctx, mc, tick, p, off, offLeft ? left - 26 : left + 192, h - 19, seed);

		// Angriffs-Abklingzeit neben der Hotbar (wenn in den Einstellungen so gewaehlt)
		if (mc.options.attackIndicator().get() == AttackIndicatorStatus.HOTBAR) {
			float f = p.getAttackStrengthScale(0f);
			if (f < 1f) {
				// Wie im Spiel: auf der Seite gegenueber der zweiten Hand
				int x = offLeft ? left + 192 : left - 18;
				Draw.roundRect(ctx, x, top + 2, 8, 18, 0xA0000000);
				int fh = Math.round(16 * f);
				Draw.roundRect(ctx, x + 1, top + 19 - fh, 6, fh, VantageScreen.accent());
			}
		}
	}

	/** Hintergrund, Plaetze und Auswahl (auch fuer die Vorschau im Menue). selX = Platz der Auswahl (darf zwischen zwei liegen). */
	public static void drawFrame(GuiGraphicsExtractor ctx, int left, int top, int style, float selX, boolean numbers, int offBox) {
		int accent = VantageScreen.accent();
		int sx = left + 1 + Math.round(selX * 20);
		switch (style) {
			case 1 -> {
				Draw.roundRect(ctx, left, top, 182, 22, 0xC8101419);
				Draw.border(ctx, left, top, 182, 22, 0x38FFFFFF);
				for (int m = 0; m < 9; m++) Draw.roundRect(ctx, left + 2 + m * 20, top + 2, 18, 18, 0x50000000);
				if (offBox != Integer.MIN_VALUE) {
					Draw.roundRect(ctx, offBox, top, 22, 22, 0xC8101419);
					Draw.border(ctx, offBox, top, 22, 22, 0x38FFFFFF);
				}
				Draw.roundRect(ctx, sx, top + 1, 20, 20, Draw.alpha(accent, 0x48));
				Draw.border(ctx, sx, top + 1, 20, 20, accent);
			}
			case 2 -> {
				Draw.roundRect(ctx, left, top, 182, 22, 0x40000000);
				Draw.border(ctx, left, top, 182, 22, 0x60FFFFFF);
				for (int m = 0; m < 9; m++) Draw.border(ctx, left + 2 + m * 20, top + 2, 18, 18, 0x28FFFFFF);
				if (offBox != Integer.MIN_VALUE) {
					Draw.roundRect(ctx, offBox, top, 22, 22, 0x40000000);
					Draw.border(ctx, offBox, top, 22, 22, 0x60FFFFFF);
				}
				Draw.roundRect(ctx, sx, top + 1, 20, 20, 0x38FFFFFF);
				Draw.border(ctx, sx, top + 1, 20, 20, 0xD0FFFFFF);
			}
			case 3 -> {
				Draw.roundRect(ctx, left, top, 182, 22, 0xD8080A10);
				Draw.border(ctx, left, top, 182, 22, Draw.alpha(accent, 0x70));
				for (int m = 0; m < 9; m++) Draw.border(ctx, left + 2 + m * 20, top + 2, 18, 18, Draw.alpha(accent, 0x30));
				if (offBox != Integer.MIN_VALUE) {
					Draw.roundRect(ctx, offBox, top, 22, 22, 0xD8080A10);
					Draw.border(ctx, offBox, top, 22, 22, Draw.alpha(accent, 0x70));
				}
				Draw.glow(ctx, sx, top + 1, 20, 20, accent, 0x70, 3);
				Draw.roundRect(ctx, sx, top + 1, 20, 20, Draw.alpha(accent, 0x40));
				Draw.border(ctx, sx, top + 1, 20, 20, Draw.mix(accent, 0xFFFFFFFF, 0.35f));
			}
			case 4 -> {
				for (int m = 0; m < 9; m++) Draw.roundRect(ctx, left + 3 + m * 20, top + 3, 16, 16, 0x30000000);
				if (offBox != Integer.MIN_VALUE) Draw.roundRect(ctx, offBox + 3, top + 3, 16, 16, 0x30000000);
				Draw.roundRect(ctx, sx + 1, top + 2, 18, 18, 0x30FFFFFF);
				Draw.roundRect(ctx, sx + 4, top + 21, 12, 2, accent);
			}
			default -> {
				// Normal (nur fuer die Vorschau im Menue): grau wie im Spiel
				Draw.roundRect(ctx, left, top, 182, 22, 0xFF555555);
				Draw.border(ctx, left, top, 182, 22, 0xFF1A1A1A);
				for (int m = 0; m < 9; m++) Draw.roundRect(ctx, left + 2 + m * 20, top + 2, 18, 18, 0xFF8B8B8B);
				Draw.border(ctx, sx - 1, top, 22, 22, 0xFFFFFFFF);
			}
		}
		if (numbers) {
			for (int m = 0; m < 9; m++) {
				ctx.pose().pushMatrix();
				ctx.pose().translate(left + 3 + m * 20, top + 3);
				ctx.pose().scale(0.5f, 0.5f);
				ctx.text(Minecraft.getInstance().font, String.valueOf(m + 1), 0, 0, 0xB0FFFFFF);
				ctx.pose().popMatrix();
			}
		}
	}

	private static void item(GuiGraphicsExtractor ctx, Minecraft mc, DeltaTracker tick, Player p, ItemStack stack, int x, int y, int seed) {
		if (stack.isEmpty()) return;
		// Kleines Huepfen beim Aufheben, wie im Spiel
		float f = stack.getPopTime() - tick.getGameTimeDeltaPartialTick(false);
		if (f > 0f) {
			float g = 1f + f / 5f;
			ctx.pose().pushMatrix();
			ctx.pose().translate(x + 8, y + 12);
			ctx.pose().scale(1f / g, (g + 1f) / 2f);
			ctx.pose().translate(-(x + 8), -(y + 12));
		}
		ctx.item(p, stack, x, y, seed);
		if (f > 0f) ctx.pose().popMatrix();
		ctx.itemDecorations(mc.font, stack, x, y);
	}
}
