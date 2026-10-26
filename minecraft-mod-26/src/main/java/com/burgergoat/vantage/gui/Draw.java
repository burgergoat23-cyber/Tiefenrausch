package com.burgergoat.vantage.gui;

import net.minecraft.client.gui.GuiGraphicsExtractor;

/** Zeichen-Bausteine mit runden Ecken und Farbmischung (Menue, Hotbar, Brau-Rezepte). */
public final class Draw {
	private Draw() {
	}

	public static int mix(int a, int b, float t) {
		t = Math.max(0f, Math.min(1f, t));
		int aa = a >>> 24, ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
		int ba = b >>> 24, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
		return (Math.round(aa + (ba - aa) * t) << 24) | (Math.round(ar + (br - ar) * t) << 16)
				| (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
	}

	public static int alpha(int color, int a) {
		return (Math.max(0, Math.min(255, a)) << 24) | (color & 0xFFFFFF);
	}

	/** Abgerundeter Rahmen (passend zu roundRect). */
	public static void border(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int color) {
		if (w < 6 || h < 6) {
			ctx.fill(x + 1, y, x + w - 1, y + 1, color);
			ctx.fill(x + 1, y + h - 1, x + w - 1, y + h, color);
			ctx.fill(x, y + 1, x + 1, y + h - 1, color);
			ctx.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
			return;
		}
		ctx.fill(x + 2, y, x + w - 2, y + 1, color);
		ctx.fill(x + 2, y + h - 1, x + w - 2, y + h, color);
		ctx.fill(x, y + 2, x + 1, y + h - 2, color);
		ctx.fill(x + w - 1, y + 2, x + w, y + h - 2, color);
		ctx.fill(x + 1, y + 1, x + 2, y + 2, color);
		ctx.fill(x + w - 2, y + 1, x + w - 1, y + 2, color);
		ctx.fill(x + 1, y + h - 2, x + 2, y + h - 1, color);
		ctx.fill(x + w - 2, y + h - 2, x + w - 1, y + h - 1, color);
	}

	/** Flaeche mit abgerundeten Ecken. */
	public static void roundRect(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int color) {
		roundGradient(ctx, x, y, w, h, color, color);
	}

	public static void roundGradient(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int top, int bottom) {
		if (w <= 0 || h <= 0) return;
		if (w < 3 || h < 3) {
			ctx.fill(x, y, x + w, y + h, top);
			return;
		}
		if (w < 6 || h < 6) {
			ctx.fill(x + 1, y, x + w - 1, y + 1, top);
			ctx.fillGradient(x, y + 1, x + w, y + h - 1, top, bottom);
			ctx.fill(x + 1, y + h - 1, x + w - 1, y + h, bottom);
			return;
		}
		ctx.fill(x + 2, y, x + w - 2, y + 1, top);
		ctx.fill(x + 1, y + 1, x + w - 1, y + 2, top);
		ctx.fillGradient(x, y + 2, x + w, y + h - 2, top, bottom);
		ctx.fill(x + 1, y + h - 2, x + w - 1, y + h - 1, bottom);
		ctx.fill(x + 2, y + h - 1, x + w - 2, y + h, bottom);
	}

	/** Weicher Schein um ein Rechteck (mehrere blasse Rahmen). */
	public static void glow(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int color, int strength, int rings) {
		for (int i = rings; i >= 1; i--) border(ctx, x - i, y - i, w + 2 * i, h + 2 * i, alpha(color, strength >> (i - 1)));
	}
}
