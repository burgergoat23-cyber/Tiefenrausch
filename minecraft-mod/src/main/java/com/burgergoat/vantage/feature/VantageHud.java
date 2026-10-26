package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.gui.VantageScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.util.math.Direction;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** Info-Anzeige (FPS, CPS, Koordinaten …) oben links und Tracker-Karte oben rechts. */
public final class VantageHud {
	private static final ArrayDeque<Long> LEFT = new ArrayDeque<>();
	private static final ArrayDeque<Long> RIGHT = new ArrayDeque<>();
	private static boolean leftWas;
	private static boolean rightWas;

	private VantageHud() {
	}

	/** Klicks pro Sekunde (links / rechts) fuer die Tasten-Anzeige. */
	public static int leftCps() {
		return cps(LEFT, System.currentTimeMillis());
	}

	public static int rightCps() {
		return cps(RIGHT, System.currentTimeMillis());
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
		VantageConfig c = VantageConfig.get();
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
				ctx.fill(2, 2, 3, 4 + lines.size() * 10, VantageScreen.accent());
				for (String s : lines) {
					ctx.drawTextWithShadow(tr, s, 5, y, 0xFFFFFFFF);
					y += 10;
				}
			}
		}
		HudModules.render(ctx);
		Waypoints.render(ctx);
		if (c.trackerHud) TrackerCard.renderHud(ctx);
		ComboCounter.render(ctx);
		if (CameraControl.freeCam()) {
			String s = "Freecam – " + VantageClient.freecamKey.getBoundKeyLocalizedText().getString() + " zum Beenden";
			int x = (ctx.getScaledWindowWidth() - tr.getWidth(s)) / 2;
			ctx.fill(x - 4, 3, x + tr.getWidth(s) + 4, 15, 0x90000000);
			ctx.drawTextWithShadow(tr, s, x, 5, VantageScreen.accent());
		}
	}
}
