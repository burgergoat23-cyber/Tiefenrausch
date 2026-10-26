package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.gui.Draw;
import com.burgergoat.vantage.tracker.SeedStore;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;

/**
 * Wegpunkte: Orte merken (pro Welt bzw. Server) und den Weg dorthin zeigen. Der Todespunkt wird beim Sterben
 * automatisch gespeichert. Oben in der Mitte stehen Name, Entfernung und ein Pfeil in die richtige Richtung.
 */
public final class Waypoints {
	public static final int[] COLORS = {0xFF3FC3E8, 0xFFE8A33D, 0xFF4CD07D, 0xFFA97CFF, 0xFFFF74B8, 0xFFFFFFFF};
	public static final String DEATH = "Todespunkt";
	private static final String[] ARROWS = {"↑", "↗", "→", "↘", "↓", "↙", "←", "↖"};
	private static boolean wasDead;
	private static int ticks;

	public record Point(String name, int x, int y, int z, String dim, int color) {
		String save() {
			return name.replace("|", "/") + "|" + x + "|" + y + "|" + z + "|" + dim + "|" + color;
		}

		@Nullable
		static Point load(String s) {
			String[] p = s.split("\\|");
			if (p.length < 6) return null;
			try {
				return new Point(p[0], Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), p[4], Integer.parseInt(p[5]));
			} catch (NumberFormatException e) {
				return null;
			}
		}
	}

	private Waypoints() {
	}

	/** Schluessel fuer die aktuelle Welt bzw. den Server. */
	@Nullable
	public static String worldKey(Minecraft mc) {
		if (mc.getSingleplayerServer() != null) return "welt:" + mc.getSingleplayerServer().getWorldData().getLevelName();
		return SeedStore.serverKey(mc);
	}

	private static String dim(Minecraft mc) {
		return mc.level.dimension().identifier().getPath();
	}

	public static List<Point> list(Minecraft mc) {
		List<Point> out = new ArrayList<>();
		String key = worldKey(mc);
		if (key == null) return out;
		for (String s : VantageConfig.get().waypointList.getOrDefault(key, List.of())) {
			Point p = Point.load(s);
			if (p != null) out.add(p);
		}
		return out;
	}

	private static void store(Minecraft mc, List<Point> points) {
		String key = worldKey(mc);
		if (key == null) return;
		List<String> raw = new ArrayList<>();
		for (Point p : points) raw.add(p.save());
		VantageConfig.get().waypointList.put(key, raw);
		VantageConfig.save();
	}

	@Nullable
	public static Point active(Minecraft mc) {
		String key = worldKey(mc);
		if (key == null) return null;
		String name = VantageConfig.get().activeWaypoint.get(key);
		if (name == null) return null;
		for (Point p : list(mc)) if (p.name.equals(name)) return p;
		return null;
	}

	public static void setActive(Minecraft mc, @Nullable Point p) {
		String key = worldKey(mc);
		if (key == null) return;
		if (p == null) VantageConfig.get().activeWaypoint.remove(key);
		else VantageConfig.get().activeWaypoint.put(key, p.name);
		VantageConfig.save();
	}

	/** Neuer Wegpunkt an der eigenen Position ("Punkt 1", "Punkt 2" ...). */
	public static void addHere(Minecraft mc) {
		if (mc.player == null || mc.level == null) return;
		List<Point> points = list(mc);
		int n = 1;
		while (true) {
			String name = "Punkt " + n;
			if (points.stream().noneMatch(p -> p.name.equals(name))) break;
			n++;
		}
		Point p = new Point("Punkt " + n, mc.player.getBlockX(), mc.player.getBlockY(), mc.player.getBlockZ(), dim(mc), COLORS[(n - 1) % COLORS.length]);
		points.add(p);
		store(mc, points);
		setActive(mc, p);
		mc.player.sendOverlayMessage(Component.literal("Wegpunkt „" + p.name + "“ gesetzt: " + p.x + " " + p.y + " " + p.z).withColor(p.color));
	}

	public static void remove(Minecraft mc, Point p) {
		List<Point> points = list(mc);
		points.removeIf(q -> q.name.equals(p.name));
		store(mc, points);
	}

	public static void tick(Minecraft mc) {
		if (mc.player == null || mc.level == null) {
			wasDead = false;
			return;
		}
		VantageConfig c = VantageConfig.get();
		boolean dead = mc.player.getHealth() <= 0f;
		if (dead && !wasDead && c.deathPoint && worldKey(mc) != null) {
			List<Point> points = list(mc);
			points.removeIf(q -> q.name.equals(DEATH));
			Point p = new Point(DEATH, mc.player.getBlockX(), mc.player.getBlockY(), mc.player.getBlockZ(), dim(mc), 0xFFFF5A4A);
			points.add(p);
			store(mc, points);
			setActive(mc, p);
			mc.player.sendSystemMessage(Component.literal("[Vantage] ").withColor(0xFFE8A33D)
					.append(Component.literal("Todespunkt gespeichert: " + p.x + " " + p.y + " " + p.z).withColor(0xFFFF8A7A)));
		}
		wasDead = dead;

		// Lichtsaeule ueber dem aktiven Wegpunkt (in der Naehe)
		if (c.waypoints && c.waypointBeam && ++ticks % 3 == 0) {
			Point p = active(mc);
			if (p != null && p.dim.equals(dim(mc))) {
				double dx = p.x + 0.5 - mc.player.getX();
				double dz = p.z + 0.5 - mc.player.getZ();
				if (dx * dx + dz * dz < 200 * 200) {
					double y = mc.player.getY() - 8 + mc.level.getRandom().nextDouble() * 50;
					mc.level.addParticle(ParticleTypes.END_ROD, true, true, p.x + 0.5, y, p.z + 0.5, 0, 0.06, 0);
				}
			}
		}
	}

	/** Oben in der Mitte: Pfeil, Name und Entfernung zum aktiven Wegpunkt. */
	public static void render(GuiGraphicsExtractor ctx) {
		Minecraft mc = Minecraft.getInstance();
		VantageConfig c = VantageConfig.get();
		if (!c.waypoints || mc.player == null || mc.level == null) return;
		Point p = active(mc);
		if (p == null) return;
		Font tr = mc.font;
		String text;
		String arrow = "";
		if (p.dim.equals(dim(mc))) {
			double dx = p.x + 0.5 - mc.player.getX();
			double dz = p.z + 0.5 - mc.player.getZ();
			double dist = Math.sqrt(dx * dx + dz * dz + Math.pow(p.y - mc.player.getY(), 2));
			// Richtung zum Ziel relativ zur Blickrichtung (0 = geradeaus)
			double target = Math.toDegrees(Math.atan2(-dx, dz));
			double rel = ((target - mc.player.getYRot()) % 360 + 540) % 360 - 180;
			arrow = ARROWS[(int) Math.floorMod(Math.round(rel / 45.0), 8)];
			text = p.name + "  " + (dist < 1000 ? Math.round(dist) + " m" : String.format("%.1f km", dist / 1000).replace('.', ','));
		} else {
			text = p.name + "  (in " + dimName(p.dim) + ")";
		}
		int w = tr.width(text) + (arrow.isEmpty() ? 12 : 26);
		int x = (ctx.guiWidth() - w) / 2;
		int y = 22;
		Draw.roundRect(ctx, x, y, w, 15, 0x90000000);
		Draw.border(ctx, x, y, w, 15, Draw.alpha(p.color, 0xC0));
		int tx = x + 6;
		if (!arrow.isEmpty()) {
			ctx.text(tr, arrow, tx, y + 4, p.color);
			tx += 14;
		}
		ctx.text(tr, text, tx, y + 4, 0xFFFFFFFF);
	}

	public static String dimName(String dim) {
		return switch (dim) {
			case "the_nether" -> "Nether";
			case "the_end" -> "Ende";
			case "overworld" -> "Oberwelt";
			default -> dim;
		};
	}
}
