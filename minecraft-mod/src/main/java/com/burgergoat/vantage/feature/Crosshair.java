package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElement;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;

/** CS-Fadenkreuz (Laenge, Dicke, Luecke, Farbe, Punkt, Umrandung, T-Form, Kreis). */
public final class Crosshair {
	public static final String[] STYLES = {"Klassisch", "Nur Punkt", "T-Form", "Kreis"};
	public static final int[] COLORS = {0x00FF40, 0xFFFF00, 0x00FFFF, 0xFFFFFF, 0xFF2020, 0xFF40FF, 0xFF9900, 0x4080FF};
	public static final String[] PRESETS = {"CS Standard", "Klein", "Punkt", "Groß", "T-Form", "Kreis"};

	private Crosshair() {
	}

	/** Fertige Vorlage Nummer i (nur die Fadenkreuz-Werte sind gesetzt). */
	public static VantageConfig preset(int i) {
		VantageConfig p = new VantageConfig();
		switch (i) {
			case 1 -> {
				p.chColor = 0x00FFFF;
				p.chLength = 2.5f;
				p.chThickness = 0.5f;
				p.chGap = 0.5f;
				p.chDynamic = false;
			}
			case 2 -> {
				p.chStyle = 1;
				p.chColor = 0xFF2020;
				p.chThickness = 1.5f;
				p.chDynamic = false;
			}
			case 3 -> {
				p.chColor = 0xFFFF00;
				p.chLength = 7f;
				p.chThickness = 1.5f;
				p.chGap = 3f;
			}
			case 4 -> {
				p.chStyle = 2;
				p.chColor = 0xFFFFFF;
				p.chLength = 4.5f;
				p.chGap = 1.5f;
				p.chDot = true;
			}
			case 5 -> {
				p.chStyle = 3;
				p.chColor = 0xFF40FF;
				p.chLength = 2f;
				p.chGap = 3f;
				p.chDot = true;
			}
			default -> {
			}
		}
		return p;
	}

	/** Uebernimmt alle Fadenkreuz-Werte von {@code from} und schaltet das eigene Fadenkreuz ein. */
	public static void apply(VantageConfig from, VantageConfig to) {
		to.chEnabled = true;
		to.chStyle = from.chStyle;
		to.chColor = from.chColor;
		to.chAlpha = from.chAlpha;
		to.chLength = from.chLength;
		to.chThickness = from.chThickness;
		to.chGap = from.chGap;
		to.chDot = from.chDot;
		to.chOutline = from.chOutline;
		to.chDynamic = from.chDynamic;
	}

	/** Gleiche Werte wie die Vorlage? (zum Hervorheben im Menue) */
	public static boolean matches(VantageConfig a, VantageConfig b) {
		return a.chStyle == b.chStyle && (a.chColor & 0xFFFFFF) == (b.chColor & 0xFFFFFF) && a.chLength == b.chLength
				&& a.chThickness == b.chThickness && a.chGap == b.chGap && a.chDot == b.chDot && a.chOutline == b.chOutline
				&& a.chDynamic == b.chDynamic && a.chAlpha == b.chAlpha;
	}

	public static HudElement wrap(HudElement vanilla) {
		return (ctx, tickCounter) -> {
			if (!VantageConfig.get().chEnabled) {
				vanilla.render(ctx, tickCounter);
				return;
			}
			render(ctx, tickCounter);
		};
	}

	private static void render(DrawContext ctx, RenderTickCounter tickCounter) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || !mc.options.getPerspective().isFirstPerson() || mc.player.isSpectator()) return;
		VantageConfig c = VantageConfig.get();
		float cooldown = mc.player.getAttackCooldownProgress(tickCounter.getTickProgress(true));
		float extra = 0f;
		if (c.chDynamic) {
			double speed = mc.player.getVelocity().horizontalLength();
			extra = (1f - cooldown) * 4f + (float) Math.min(speed * 18.0, 5.0);
		}
		int cx = ctx.getScaledWindowWidth() / 2;
		int cy = ctx.getScaledWindowHeight() / 2;
		draw(ctx, cx, cy, extra);
		if (c.chCooldown && cooldown < 1f) {
			int w = 16;
			int x = cx - w / 2;
			int y = cy + 10;
			ctx.fill(x, y, x + w, y + 2, 0x90000000);
			ctx.fill(x, y, x + Math.round(w * cooldown), y + 2, 0xFFFFFFFF);
		}
	}

	/** Zeichnet das Fadenkreuz mit Mittelpunkt (cx, cy) in echten Bildschirm-Pixeln. */
	public static void draw(DrawContext ctx, int cx, int cy, float extraGap) {
		draw(ctx, VantageConfig.get(), cx, cy, extraGap);
	}

	/** Wie oben, aber mit beliebigen Einstellungen (fuer die Vorschau der Vorlagen im Menue). */
	public static void draw(DrawContext ctx, VantageConfig c, int cx, int cy, float extraGap) {
		MinecraftClient mc = MinecraftClient.getInstance();
		int scale = Math.max(1, mc.getWindow().getScaleFactor());
		int color = (Math.max(20, Math.min(255, c.chAlpha)) << 24) | (c.chColor & 0xFFFFFF);
		int outline = (Math.max(20, Math.min(255, c.chAlpha)) << 24);
		int t = Math.max(1, Math.round(c.chThickness * 2));
		int len = Math.max(0, Math.round(c.chLength * 2));
		int gap = Math.round((c.chGap + extraGap) * 2);

		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(cx, cy);
		ctx.getMatrices().scale(1f / scale, 1f / scale);
		int h0 = -t / 2;
		int h1 = h0 + t;
		boolean o = c.chOutline;
		if (c.chStyle == 3) {
			int r = Math.max(2, gap + len / 2);
			int steps = Math.max(24, r * 6);
			for (int i = 0; i < steps; i++) {
				double a = i * Math.PI * 2 / steps;
				int x = (int) Math.round(Math.cos(a) * r);
				int y = (int) Math.round(Math.sin(a) * r);
				if (o) rect(ctx, x + h0 - 1, y + h0 - 1, x + h1 + 1, y + h1 + 1, outline);
			}
			for (int i = 0; i < steps; i++) {
				double a = i * Math.PI * 2 / steps;
				int x = (int) Math.round(Math.cos(a) * r);
				int y = (int) Math.round(Math.sin(a) * r);
				rect(ctx, x + h0, y + h0, x + h1, y + h1, color);
			}
		} else if (c.chStyle != 1 && len > 0) {
			int g = Math.max(-len, gap);
			int[][] lines = {
					{g, h0, g + len, h1},
					{-g - len, h0, -g, h1},
					{h0, g, h1, g + len},
					{h0, -g - len, h1, -g},
			};
			for (int i = 0; i < 4; i++) {
				if (c.chStyle == 2 && i == 3) continue;
				int[] l = lines[i];
				if (o) rect(ctx, l[0] - 1, l[1] - 1, l[2] + 1, l[3] + 1, outline);
			}
			for (int i = 0; i < 4; i++) {
				if (c.chStyle == 2 && i == 3) continue;
				int[] l = lines[i];
				rect(ctx, l[0], l[1], l[2], l[3], color);
			}
		}
		if (c.chDot || c.chStyle == 1) {
			if (o) rect(ctx, h0 - 1, h0 - 1, h1 + 1, h1 + 1, outline);
			rect(ctx, h0, h0, h1, h1, color);
		}
		ctx.getMatrices().popMatrix();
	}

	private static void rect(DrawContext ctx, int x0, int y0, int x1, int y1, int color) {
		if (x1 > x0 && y1 > y0) ctx.fill(x0, y0, x1, y1, color);
	}
}
