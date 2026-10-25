package com.burgergoat.arsenal.feature;

import com.burgergoat.arsenal.ArsenalClient;
import com.burgergoat.arsenal.config.ArsenalConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.util.math.MathHelper;

public final class Zoom {
	private static float last = 1f;
	private static float current = 1f;

	private Zoom() {
	}

	public static void tick(MinecraftClient client) {
		last = current;
		float target = ArsenalClient.zoomKey.isPressed() && client.currentScreen == null ? Math.max(1.1f, ArsenalConfig.get().zoom) : 1f;
		current += (target - current) * 0.5f;
		if (Math.abs(current - target) < 0.01f) current = target;
	}

	public static float factor(float tickProgress) {
		return MathHelper.lerp(tickProgress, last, current);
	}
}
