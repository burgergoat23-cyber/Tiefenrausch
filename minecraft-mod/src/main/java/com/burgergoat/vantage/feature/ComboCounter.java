package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * Combo-Zaehler: zaehlt Treffer am Stueck, bis man selbst getroffen wird oder 3 Sekunden nichts trifft.
 * Zeigt dazu die Reichweite des letzten Treffers. Ein Treffer zaehlt erst, wenn das Ziel wirklich Schaden nimmt.
 */
public final class ComboCounter {
	private static final long TIMEOUT = 3000;
	private static int combo;
	private static int best;
	private static long lastHit;
	private static long popAt;
	private static double reach;
	private static int pendingId = -1;
	private static int pendingTicks;
	private static double pendingReach;
	private static int lastOwnHurt;

	private ComboCounter() {
	}

	public static int combo() {
		return combo;
	}

	/** Linksklick auf ein Ziel (AttackEntityCallback). */
	public static void onAttack(Entity target) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || !(target instanceof LivingEntity)) return;
		pendingId = target.getId();
		pendingTicks = 4;
		pendingReach = reachTo(mc.player.getEyePos(), target.getBoundingBox());
	}

	private static double reachTo(Vec3d eye, Box b) {
		double dx = Math.max(Math.max(b.minX - eye.x, 0), eye.x - b.maxX);
		double dy = Math.max(Math.max(b.minY - eye.y, 0), eye.y - b.maxY);
		double dz = Math.max(Math.max(b.minZ - eye.z, 0), eye.z - b.maxZ);
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	public static void tick(MinecraftClient mc) {
		if (mc.player == null || mc.world == null) {
			combo = 0;
			pendingId = -1;
			return;
		}
		long now = System.currentTimeMillis();
		// Selbst getroffen -> Combo vorbei
		int hurt = mc.player.hurtTime;
		if (hurt > lastOwnHurt) combo = 0;
		lastOwnHurt = hurt;
		// Hat der Schlag wirklich getroffen? (Ziel zeigt die rote Treffer-Animation)
		if (pendingId >= 0) {
			Entity e = mc.world.getEntityById(pendingId);
			if (e instanceof LivingEntity le && le.hurtTime > 0 && le.hurtTime >= le.maxHurtTime - 3) {
				combo++;
				best = Math.max(best, combo);
				lastHit = now;
				popAt = now;
				reach = pendingReach;
				pendingId = -1;
			} else if (--pendingTicks <= 0) {
				pendingId = -1;
			}
		}
		if (combo > 0 && now - lastHit > TIMEOUT) combo = 0;
	}

	/** Unter dem Fadenkreuz: "5 Combo" mit kleinem Aufploppen, darunter die Reichweite. */
	public static void render(DrawContext ctx) {
		VantageConfig c = VantageConfig.get();
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || (!c.comboCounter && !c.reachDisplay)) return;
		long now = System.currentTimeMillis();
		boolean recent = now - lastHit < TIMEOUT;
		if (!recent) return;
		TextRenderer tr = mc.textRenderer;
		int cx = ctx.getScaledWindowWidth() / 2;
		int y = ctx.getScaledWindowHeight() / 2 + 14;
		float fade = MathHelper.clamp(1f - (now - lastHit - 2000) / 1000f, 0f, 1f);
		int alpha = Math.max(24, Math.round(255 * fade)) << 24;
		if (c.comboCounter && combo > 0) {
			String s = combo + " Combo";
			int color = combo >= 10 ? 0xFF4A4A : combo >= 5 ? 0xFFB347 : combo >= 3 ? 0xFFE066 : 0xFFFFFF;
			float pop = 1f + 0.35f * MathHelper.clamp(1f - (now - popAt) / 180f, 0f, 1f);
			float scale = 1.25f * pop;
			ctx.getMatrices().pushMatrix();
			ctx.getMatrices().translate(cx, y);
			ctx.getMatrices().scale(scale, scale);
			ctx.drawTextWithShadow(tr, s, -tr.getWidth(s) / 2, 0, alpha | color);
			ctx.getMatrices().popMatrix();
			y += Math.round(11 * scale);
		}
		if (c.reachDisplay && reach > 0) {
			String r = String.format("%.2f Blöcke", reach).replace('.', ',');
			ctx.drawTextWithShadow(tr, r, cx - tr.getWidth(r) / 2, y, alpha | 0xB8C4D6);
		}
	}
}
