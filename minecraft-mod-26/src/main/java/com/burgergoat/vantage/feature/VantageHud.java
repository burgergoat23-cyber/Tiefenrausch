package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.core.Direction;

/** Info-Anzeige (FPS, CPS, Koordinaten …) oben links und Tracker-Karte oben rechts. */
public final class VantageHud {
	private static final ArrayDeque<Long> LEFT = new ArrayDeque<>();
	private static final ArrayDeque<Long> RIGHT = new ArrayDeque<>();
	private static boolean leftWas;
	private static boolean rightWas;

	private VantageHud() {
	}

	private static int cps(ArrayDeque<Long> q, long now) {
		while (!q.isEmpty() && now - q.peekFirst() > 1000) q.pollFirst();
		return q.size();
	}

	private static void countClicks(Minecraft mc) {
		long now = System.currentTimeMillis();
		boolean l = mc.options.keyAttack.isDown();
		boolean r = mc.options.keyUse.isDown();
		if (l && !leftWas && mc.screen == null) LEFT.addLast(now);
		if (r && !rightWas && mc.screen == null) RIGHT.addLast(now);
		leftWas = l;
		rightWas = r;
	}

	public static void render(GuiGraphicsExtractor ctx, DeltaTracker tickCounter) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.player == null || mc.options.hideGui) return;
		countClicks(mc);
		VantageConfig c = VantageConfig.get();
		Font tr = mc.font;
		if (c.hudInfo) {
			List<String> lines = new ArrayList<>();
			if (c.hudFps) lines.add("§6FPS §f" + mc.getFps());
			if (c.hudCps) {
				long now = System.currentTimeMillis();
				lines.add("§6CPS §f" + cps(LEFT, now) + " §7| §f" + cps(RIGHT, now));
			}
			if (c.hudCoords) {
				lines.add(String.format("§6XYZ §f%d %d %d", mc.player.getBlockX(), mc.player.getBlockY(), mc.player.getBlockZ()));
			}
			if (c.hudDirection) {
				Direction d = mc.player.getDirection();
				String name = switch (d) {
					case NORTH -> "Norden (-Z)";
					case SOUTH -> "Süden (+Z)";
					case EAST -> "Osten (+X)";
					case WEST -> "Westen (-X)";
					default -> d.getSerializedName();
				};
				lines.add("§6Richtung §f" + name);
			}
			if (c.hudPing && mc.getConnection() != null) {
				PlayerInfo e = mc.getConnection().getPlayerInfo(mc.player.getUUID());
				if (e != null) lines.add("§6Ping §f" + e.getLatency() + " ms");
			}
			if (!lines.isEmpty()) {
				int w = 0;
				for (String s : lines) w = Math.max(w, tr.width(s));
				int y = 4;
				ctx.fill(2, 2, 8 + w, 4 + lines.size() * 10, 0x70000000);
				for (String s : lines) {
					ctx.drawString(tr, s, 5, y, 0xFFFFFFFF);
					y += 10;
				}
			}
		}
		if (c.trackerHud) TrackerCard.renderHud(ctx);
	}
}
