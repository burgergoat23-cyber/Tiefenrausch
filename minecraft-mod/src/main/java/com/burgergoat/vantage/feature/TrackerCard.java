package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.tracker.LootStatus;
import com.burgergoat.vantage.tracker.Site;
import com.burgergoat.vantage.tracker.StructureTracker;
import com.burgergoat.vantage.tracker.TrackType;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.item.ItemStack;
import net.minecraft.util.math.BlockPos;
import org.jetbrains.annotations.Nullable;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Die Tracker-Karte: immer nur das naechste Ziel, mit Entfernung, Pfeil und darunter was noch da ist.
 * Wird im HUD (rechts oben) und als Vorschau im Menue gezeichnet.
 */
public final class TrackerCard {
	private static final int BG = 0xD80E1117;
	private static final int BG_HEAD = 0xE0151A23;
	private static final int EDGE = 0x50FFFFFF;
	private static final int TEXT = 0xFFE3E7EC;
	private static final int GRAY = 0xFF98A2AE;
	private static final int DIM = 0xFF6C7682;
	private static final Pattern PERCENT = Pattern.compile("(\\d+) %");

	private TrackerCard() {
	}

	/** Im HUD rechts oben (unter den Effekt-Symbolen). */
	public static void renderHud(DrawContext ctx) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || mc.world == null) return;
		TrackType type = StructureTracker.targetType(mc.world.getRegistryKey());
		if (type == null) return;
		Site site = StructureTracker.target(mc);
		if (site == null && !StructureTracker.searching()) {
			VantageConfig c = VantageConfig.get();
			boolean possible = mc.getServer() != null || c.trackerServers;
			if (!possible) return;
		}
		int y = 4;
		boolean good = false;
		boolean bad = false;
		for (StatusEffectInstance e : mc.player.getStatusEffects()) {
			if (!e.shouldShowIcon()) continue;
			if (e.getEffectType().value().isBeneficial()) good = true;
			else bad = true;
		}
		if (bad) y = 53;
		else if (good) y = 28;
		int w = width(mc, type, site);
		render(ctx, mc, ctx.getScaledWindowWidth() - w - 4, y, w, type, site);
	}

	/** Breite passend zum Inhalt. */
	public static int width(MinecraftClient mc, TrackType type, @Nullable Site site) {
		TextRenderer tr = mc.textRenderer;
		int w = Math.max(150, tr.getWidth(type.label) + 60);
		if (site != null) {
			LootStatus st = StructureTracker.loot(site);
			for (LootStatus.Row r : st.rows) w = Math.max(w, 20 + tr.getWidth(r.label()) + 14 + tr.getWidth(r.state().symbol + " " + r.value()) + 8);
			w = Math.max(w, tr.getWidth("◆ " + st.verdict.label + " ◆") + 16);
		}
		return Math.min(w, 260);
	}

	/** @return Hoehe der Karte */
	public static int render(DrawContext ctx, MinecraftClient mc, int x, int y, int w, TrackType type, @Nullable Site site) {
		TextRenderer tr = mc.textRenderer;
		int color = type.color | 0xFF000000;

		if (site == null) {
			int h = 34;
			panel(ctx, x, y, w, h, color);
			ctx.drawItem(type.icon(), x + 7, y + 9);
			ctx.drawTextWithShadow(tr, tr.trimToWidth(type.label, w - 34), x + 28, y + 6, color);
			if (StructureTracker.searching()) {
				small(ctx, tr, "Suche läuft …", x + 28, y + 18, GRAY);
				float p = progress();
				int bx = x + 28;
				int bw = w - 36;
				ctx.fill(bx, y + 27, bx + bw, y + 29, 0x40FFFFFF);
				if (p >= 0) {
					ctx.fill(bx, y + 27, bx + Math.round(bw * p), y + 29, color);
				} else {
					int t = (int) (System.currentTimeMillis() / 8 % (bw + 30)) - 30;
					ctx.fill(bx + Math.max(0, t), y + 27, bx + Math.min(bw, t + 30), y + 29, color);
				}
			} else {
				small(ctx, tr, tr.trimToWidth(StructureTracker.status(), (int) ((w - 34) / 0.75f)), x + 28, y + 19, GRAY);
			}
			return h;
		}

		LootStatus st = StructureTracker.loot(site);
		int rowsH = st.rows.size() * 13;
		boolean note = !st.note.isEmpty();
		int h = 50 + (rowsH > 0 ? rowsH + 5 : 0) + 18 + (note ? 9 : 0);
		panel(ctx, x, y, w, h, color);
		ctx.fill(x + 2, y + 1, x + w - 1, y + 45, BG_HEAD);

		// Kopf: Symbol, Name, "1 von 4"
		ctx.drawItem(type.icon(), x + 7, y + 6);
		ctx.drawTextWithShadow(tr, tr.trimToWidth(type.label, w - 60), x + 28, y + 5, color);
		int count = StructureTracker.count(mc);
		String sub = count > 1 ? "Nächstes Ziel · " + count + " gefunden" : "Nächstes Ziel";
		if (VantageConfig.get().trackerSkipLooted) sub = count > 1 ? "Nächstes ungeplündertes · " + count : "Nächstes Ziel";
		small(ctx, tr, sub, x + 28, y + 16, DIM);

		// Entfernung gross + Hoehe + Koordinaten
		BlockPos p = site.pos();
		double dist = StructureTracker.distanceTo(mc, p);
		String d = StructureTracker.distance(mc, p);
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(x + 8, y + 26);
		ctx.getMatrices().scale(1.5f, 1.5f);
		ctx.drawTextWithShadow(tr, d, 0, 0, 0xFFFFFFFF);
		ctx.getMatrices().popMatrix();
		int dx = x + 8 + Math.round(tr.getWidth(d) * 1.5f) + 5;
		int dy = p.getY() - mc.player.getBlockY();
		if (Math.abs(dy) > 4) small(ctx, tr, (dy > 0 ? "▲ " : "▼ ") + Math.abs(dy), dx, y + 27, dy > 0 ? 0xFF8FD3FF : 0xFFFFB27A);
		small(ctx, tr, "X " + p.getX() + "  Y " + p.getY() + "  Z " + p.getZ(), dx, y + 36, GRAY);

		// Pfeil im Kreis rechts oben
		int cx = x + w - 20;
		int cy = y + 22;
		disc(ctx, cx, cy, 13, 0x40000000);
		ring(ctx, cx, cy, 13, (color & 0xFFFFFF) | 0x90000000);
		if (dist < 24) {
			disc(ctx, cx, cy, 4, color);
		} else {
			arrow(ctx, cx, cy, StructureTracker.relativeYaw(mc, p), color);
		}

		// Status-Zeilen
		int ry = y + 50;
		if (rowsH > 0) {
			for (LootStatus.Row r : st.rows) {
				icon(ctx, r.icon(), x + 7, ry - 1);
				ctx.drawTextWithShadow(tr, r.label(), x + 21, ry + 1, TEXT);
				String v = r.state().symbol + " " + r.value();
				ctx.drawTextWithShadow(tr, v, x + w - 7 - tr.getWidth(v), ry + 1, r.state().color);
				ry += 13;
			}
			ry += 3;
			ctx.fill(x + 6, ry - 2, x + w - 6, ry - 1, 0x30FFFFFF);
			ry += 2;
		}

		// Urteil als Plakette
		LootStatus.Verdict v = st.verdict;
		int vc = v.color;
		ctx.fill(x + 6, ry, x + w - 6, ry + 13, (vc & 0xFFFFFF) | 0x30000000);
		outline(ctx, x + 6, ry, w - 12, 13, (vc & 0xFFFFFF) | 0xA0000000);
		String label = "◆ " + v.label + " ◆";
		if (v == LootStatus.Verdict.CHECKING) {
			int dots = (int) (System.currentTimeMillis() / 300 % 4);
			label = "WIRD GEPRÜFT" + ".".repeat(dots);
		}
		ctx.drawTextWithShadow(tr, label, x + (w - tr.getWidth(label)) / 2, ry + 3, vc);
		ry += 16;
		if (note) small(ctx, tr, st.note, x + 7, ry, DIM);
		return h;
	}

	// ------------------------------------------------------------------ Zeichen-Helfer

	private static float progress() {
		Matcher m = PERCENT.matcher(StructureTracker.status());
		if (m.find()) return Math.min(1f, Integer.parseInt(m.group(1)) / 100f);
		return -1f;
	}

	private static void panel(DrawContext ctx, int x, int y, int w, int h, int color) {
		ctx.fill(x, y, x + w, y + h, BG);
		outline(ctx, x, y, w, h, EDGE);
		ctx.fill(x, y, x + 2, y + h, color);
	}

	private static void outline(DrawContext ctx, int x, int y, int w, int h, int color) {
		ctx.fill(x, y, x + w, y + 1, color);
		ctx.fill(x, y + h - 1, x + w, y + h, color);
		ctx.fill(x, y + 1, x + 1, y + h - 1, color);
		ctx.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
	}

	private static void small(DrawContext ctx, TextRenderer tr, String s, int x, int y, int color) {
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(x, y);
		ctx.getMatrices().scale(0.75f, 0.75f);
		ctx.drawTextWithShadow(tr, s, 0, 0, color);
		ctx.getMatrices().popMatrix();
	}

	private static void icon(DrawContext ctx, ItemStack stack, int x, int y) {
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(x, y);
		ctx.getMatrices().scale(0.65f, 0.65f);
		ctx.drawItem(stack, 0, 0);
		ctx.getMatrices().popMatrix();
	}

	private static void disc(DrawContext ctx, int cx, int cy, int r, int color) {
		for (int dy = -r; dy <= r; dy++) {
			int half = (int) Math.round(Math.sqrt(r * r - dy * dy));
			ctx.fill(cx - half, cy + dy, cx + half + 1, cy + dy + 1, color);
		}
	}

	private static void ring(DrawContext ctx, int cx, int cy, int r, int color) {
		int steps = r * 8;
		for (int i = 0; i < steps; i++) {
			double a = i * Math.PI * 2 / steps;
			int px = cx + (int) Math.round(Math.cos(a) * r);
			int py = cy + (int) Math.round(Math.sin(a) * r);
			ctx.fill(px, py, px + 1, py + 1, color);
		}
	}

	/** Pfeil, der zum Ziel zeigt (0 Grad = geradeaus = nach oben). */
	private static void arrow(DrawContext ctx, int cx, int cy, float yaw, int color) {
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(cx + 0.5f, cy + 0.5f);
		ctx.getMatrices().rotate((float) Math.toRadians(yaw));
		// Schatten
		drawArrowShape(ctx, 1, 1, 0x90000000);
		drawArrowShape(ctx, 0, 0, color);
		ctx.getMatrices().popMatrix();
	}

	private static void drawArrowShape(DrawContext ctx, int ox, int oy, int color) {
		// Spitze (Dreieck)
		for (int r = 0; r < 6; r++) {
			ctx.fill(ox - r - 1, oy - 9 + r, ox + r + 1, oy - 8 + r, color);
		}
		// Schaft
		ctx.fill(ox - 2, oy - 3, ox + 2, oy + 7, color);
	}
}
