package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

/**
 * Combo-Zaehler: zaehlt Treffer am Stueck, bis man selbst getroffen wird oder 3 Sekunden nichts trifft.
 * Zeigt dazu die Reichweite des letzten Treffers. Ein Treffer zaehlt erst, wenn das Ziel wirklich Schaden nimmt.
 */
public final class ComboCounter {
	private static final long TIMEOUT = 3000;
	private static int combo;
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
		Minecraft mc = Minecraft.getInstance();
		if (mc.player == null || !(target instanceof LivingEntity)) return;
		pendingId = target.getId();
		pendingTicks = 4;
		pendingReach = reachTo(mc.player.getEyePosition(), target.getBoundingBox());
	}

	private static double reachTo(Vec3 eye, AABB b) {
		double dx = Math.max(Math.max(b.minX - eye.x, 0), eye.x - b.maxX);
		double dy = Math.max(Math.max(b.minY - eye.y, 0), eye.y - b.maxY);
		double dz = Math.max(Math.max(b.minZ - eye.z, 0), eye.z - b.maxZ);
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	public static void tick(Minecraft mc) {
		if (mc.player == null || mc.level == null) {
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
			Entity e = mc.level.getEntity(pendingId);
			if (e instanceof LivingEntity le && le.hurtTime > 0 && le.hurtTime >= le.hurtDuration - 3) {
				combo++;
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
	public static void render(GuiGraphicsExtractor ctx) {
		VantageConfig c = VantageConfig.get();
		Minecraft mc = Minecraft.getInstance();
		if (mc.player == null || (!c.comboCounter && !c.reachDisplay)) return;
		long now = System.currentTimeMillis();
		if (now - lastHit >= TIMEOUT) return;
		Font tr = mc.font;
		int cx = ctx.guiWidth() / 2;
		int y = ctx.guiHeight() / 2 + 14;
		float fade = Mth.clamp(1f - (now - lastHit - 2000) / 1000f, 0f, 1f);
		int alpha = Math.max(24, Math.round(255 * fade)) << 24;
		if (c.comboCounter && combo > 0) {
			String s = combo + " Combo";
			int color = combo >= 10 ? 0xFF4A4A : combo >= 5 ? 0xFFB347 : combo >= 3 ? 0xFFE066 : 0xFFFFFF;
			float pop = 1f + 0.35f * Mth.clamp(1f - (now - popAt) / 180f, 0f, 1f);
			float scale = 1.25f * pop;
			ctx.pose().pushMatrix();
			ctx.pose().translate(cx, y);
			ctx.pose().scale(scale, scale);
			ctx.text(tr, s, -tr.width(s) / 2, 0, alpha | color);
			ctx.pose().popMatrix();
			y += Math.round(11 * scale);
		}
		if (c.reachDisplay && reach > 0) {
			String r = String.format("%.2f Blöcke", reach).replace('.', ',');
			ctx.text(tr, r, cx - tr.width(r) / 2, y, alpha | 0xB8C4D6);
		}
	}
}
