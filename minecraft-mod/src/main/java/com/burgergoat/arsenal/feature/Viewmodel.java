package com.burgergoat.arsenal.feature;

import com.burgergoat.arsenal.config.ArsenalConfig;
import com.burgergoat.arsenal.skin.SkinCatalog;
import com.burgergoat.arsenal.skin.SkinManager;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.ItemStack;
import net.minecraft.util.Arm;
import net.minecraft.util.Hand;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;

/** Position/Groesse der Hand (wie viewmodel_offset in CS) und die Inspect-Animation. */
public final class Viewmodel {
	public static final int INSPECT_TICKS = 46;
	private static int inspect = -1;
	private static int style;
	private static int inspectSlot = -1;

	private Viewmodel() {
	}

	public static void startInspect(MinecraftClient client) {
		if (!ArsenalConfig.get().inspect || client.player == null) return;
		ItemStack held = client.player.getMainHandStack();
		if (held.isEmpty()) return;
		style = 0;
		SkinCatalog.Skin skin = SkinManager.skinFor(held);
		if (skin != null && skin.shape() != null) {
			String s = skin.shape().id();
			if (s.equals("butterfly")) style = 2;
			else if (s.equals("karambit") || s.equals("talon")) style = 1;
			else if (s.equals("shadow_daggers") || s.equals("navaja") || s.equals("stiletto")) style = 3;
		}
		inspect = 0;
		inspectSlot = client.player.getInventory().getSelectedSlot();
	}

	public static void tick(MinecraftClient client) {
		if (inspect < 0) return;
		inspect++;
		boolean stop = inspect > INSPECT_TICKS || client.player == null
				|| client.player.getInventory().getSelectedSlot() != inspectSlot
				|| client.options.attackKey.isPressed() || client.options.useKey.isPressed();
		if (stop) inspect = -1;
	}

	public static boolean inspecting() {
		return inspect >= 0;
	}

	private static int side(Hand hand) {
		MinecraftClient mc = MinecraftClient.getInstance();
		Arm arm = mc.player == null ? Arm.RIGHT : mc.player.getMainArm();
		if (hand == Hand.OFF_HAND) arm = arm.getOpposite();
		return arm == Arm.RIGHT ? 1 : -1;
	}

	public static void applyOffset(MatrixStack matrices, Hand hand) {
		ArsenalConfig c = ArsenalConfig.get();
		if (c.vmX == 0 && c.vmY == 0 && c.vmZ == 0) return;
		matrices.translate(side(hand) * c.vmX * 0.5f, c.vmY * 0.5f, c.vmZ * 0.5f);
	}

	private static float smooth(float t) {
		t = MathHelper.clamp(t, 0f, 1f);
		return t * t * (3f - 2f * t);
	}

	public static void applyItem(MatrixStack matrices, Hand hand, ItemStack item, float tickProgress) {
		ArsenalConfig c = ArsenalConfig.get();
		if (c.vmScale != 1f) {
			float s = MathHelper.clamp(c.vmScale, 0.2f, 2f);
			matrices.scale(s, s, s);
		}
		if (inspect < 0 || hand != Hand.MAIN_HAND) return;
		float t = MathHelper.clamp((inspect + tickProgress) / INSPECT_TICKS, 0f, 1f);
		float env = t < 0.2f ? smooth(t / 0.2f) : t > 0.82f ? smooth((1f - t) / 0.18f) : 1f;
		float mid = smooth((t - 0.18f) / 0.64f);
		int sd = side(hand);
		matrices.translate(-0.08f * sd * env, 0.12f * env, 0.06f * env);
		matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(sd * 28f * env));
		matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(sd * -25f * env));
		switch (style) {
			case 1 -> matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-720f * mid));
			case 2 -> {
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(sd * 720f * mid));
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(25f * (float) Math.sin(mid * Math.PI * 4)));
			}
			case 3 -> matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(sd * 360f * mid));
			default -> matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(sd * 180f * (float) Math.sin(mid * Math.PI)));
		}
	}
}
