package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.mixin.OverlayTextureAccessor;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;

/** Blockrahmen-Farbe und Treffer-Farbe (das rote Aufleuchten getroffener Mobs und Spieler). */
public final class Extras {
	/** Normale Treffer-Farbe des Spiels. */
	private static final int VANILLA_HIT = 0xB2FF0000;
	public static final int[] COLORS = {0xFF3FC3E8, 0xFFE8A33D, 0xFF4CD07D, 0xFFA97CFF, 0xFFFF74B8, 0xFFFF2020, 0xFFFFFFFF, 0xFF000000};
	private static int appliedHit = VANILLA_HIT;

	private Extras() {
	}

	public static int outlineColor(int color) {
		VantageConfig c = VantageConfig.get();
		return c.outlineCustom ? c.outlineColor : color;
	}

	public static float outlineWidth(float width) {
		VantageConfig c = VantageConfig.get();
		return c.outlineCustom ? Math.max(1f, Math.min(8f, c.outlineWidth)) : width;
	}

	/** Treffer-Farbe in die Overlay-Textur des Spiels schreiben (nur wenn sie sich geaendert hat). */
	public static void tick(MinecraftClient mc) {
		VantageConfig c = VantageConfig.get();
		int want = c.hitColorCustom ? c.hitColor : VANILLA_HIT;
		if (want == appliedHit || mc.gameRenderer == null) return;
		NativeImageBackedTexture tex = ((OverlayTextureAccessor) mc.gameRenderer.getOverlayTexture()).vantage$texture();
		NativeImage img = tex.getImage();
		if (img == null) return;
		for (int y = 0; y < 8; y++) {
			for (int x = 0; x < 16; x++) img.setColorArgb(x, y, want);
		}
		tex.upload();
		appliedHit = want;
	}
}
