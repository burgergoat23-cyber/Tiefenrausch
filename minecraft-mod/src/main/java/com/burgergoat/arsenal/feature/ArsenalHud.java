package com.burgergoat.arsenal.feature;

import com.burgergoat.arsenal.config.ArsenalConfig;
import com.burgergoat.arsenal.tracker.StructureTracker;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.util.math.Direction;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** Info-Anzeige (FPS, CPS, Koordinaten …) oben links und Tracker-Liste oben rechts. */
public final class ArsenalHud {
	private static final ArrayDeque<Long> LEFT = new ArrayDeque<>();
	private static final ArrayDeque<Long> RIGHT = new ArrayDeque<>();
	private static boolean leftWas;
	private static boolean rightWas;

	private ArsenalHud() {
	}

	private static int cps(ArrayDeque<Long> q, long now) {
		while (!q.isEmpty() && now - q.peekFirst() > 1000) q.pollFirst();
		return q.size();
	}

	private static void countClicks(MinecraftClient mc) {
		long now = System.currentTimeMillis();
		boolean l = mc.options.attackKey.isPressed();
		boolean r = mc.options.useKey.isPressed();
		if (l && !leftWas && mc.currentScreen == null) LEFT.addLast(now);
		if (r && !rightWas && mc.currentScreen == null) RIGHT.addLast(now);
		leftWas = l;
		rightWas = r;
	}

	public static void render(DrawContext ctx, RenderTickCounter tickCounter) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || mc.options.hudHidden) return;
		countClicks(mc);
		ArsenalConfig c = ArsenalConfig.get();
		TextRenderer tr = mc.textRenderer;
		if (c.hudInfo) {
			List<String> lines = new ArrayList<>();
			if (c.hudFps) lines.add("§6FPS §f" + mc.getCurrentFps());
			if (c.hudCps) {
				long now = System.currentTimeMillis();
				lines.add("§6CPS §f" + cps(LEFT, now) + " §7| §f" + cps(RIGHT, now));
			}
			if (c.hudCoords) {
				lines.add(String.format("§6XYZ §f%d %d %d", mc.player.getBlockX(), mc.player.getBlockY(), mc.player.getBlockZ()));
			}
			if (c.hudDirection) {
				Direction d = mc.player.getHorizontalFacing();
				String name = switch (d) {
					case NORTH -> "Norden (-Z)";
					case SOUTH -> "Süden (+Z)";
					case EAST -> "Osten (+X)";
					case WEST -> "Westen (-X)";
					default -> d.asString();
				};
				lines.add("§6Richtung §f" + name);
			}
			if (c.hudPing && mc.getNetworkHandler() != null) {
				PlayerListEntry e = mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid());
				if (e != null) lines.add("§6Ping §f" + e.getLatency() + " ms");
			}
			if (!lines.isEmpty()) {
				int w = 0;
				for (String s : lines) w = Math.max(w, tr.getWidth(s));
				int y = 4;
				ctx.fill(2, 2, 8 + w, 4 + lines.size() * 10, 0x70000000);
				for (String s : lines) {
					ctx.drawTextWithShadow(tr, s, 5, y, 0xFFFFFFFF);
					y += 10;
				}
			}
		}
		if (c.trackerHud) {
			List<StructureTracker.Found> found = StructureTracker.results(mc);
			if (!found.isEmpty() || StructureTracker.searching()) {
				List<String> lines = new ArrayList<>();
				List<Integer> colors = new ArrayList<>();
				int shown = 0;
				for (StructureTracker.Found f : found) {
					if (shown++ >= 6) break;
					lines.add(StructureTracker.arrow(mc, f.pos()) + " " + f.type().label + "  " + StructureTracker.distance(mc, f.pos()));
					colors.add(f.type().color);
				}
				if (StructureTracker.searching()) {
					lines.add(StructureTracker.status());
					colors.add(0xFFAAAAAA);
				}
				int w = tr.getWidth("Tracker");
				for (String s : lines) w = Math.max(w, tr.getWidth(s));
				int x = ctx.getScaledWindowWidth() - w - 8;
				ctx.fill(x - 3, 2, ctx.getScaledWindowWidth() - 2, 16 + lines.size() * 10, 0x70000000);
				ctx.drawTextWithShadow(tr, "Tracker", x, 4, 0xFFE8A33D);
				int y = 15;
				for (int i = 0; i < lines.size(); i++) {
					ctx.drawTextWithShadow(tr, lines.get(i), x, y, colors.get(i));
					y += 10;
				}
			}
		}
	}
}
