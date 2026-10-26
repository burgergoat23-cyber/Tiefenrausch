package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.util.math.MathHelper;

public final class Zoom {
	private static float last = 1f;
	private static float current = 1f;

	private Zoom() {
	}

	public static void tick(MinecraftClient client) {
		last = current;
		float target = VantageClient.zoomKey.isPressed() && client.currentScreen == null ? Math.max(1.1f, VantageConfig.get().zoom) : 1f;
		current += (target - current) * 0.5f;
		if (Math.abs(current - target) < 0.01f) current = target;
	}

	public static float factor(float tickProgress) {
		return MathHelper.lerp(tickProgress, last, current);
	}
}
