package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.gui.VantageScreen;
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

	private static void countClicks(Minecraft mc) {
		long now = System.currentTimeMillis();
		boolean l = mc.options.keyAttack.isDown();
		boolean r = mc.options.keyUse.isDown();
		if (l && !leftWas && mc.gui.screen() == null) LEFT.addLast(now);
		if (r && !rightWas && mc.gui.screen() == null) RIGHT.addLast(now);
		leftWas = l;
		rightWas = r;
	}

	public static void render(GuiGraphicsExtractor ctx, DeltaTracker tickCounter) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.player == null || mc.gui.hud.isHidden()) return;
		countClicks(mc);
		VantageConfig c = VantageConfig.get();
		Font tr = mc.font;
		if (c.hudInfo) {
			// Bezeichnung (orange) und Wert (weiss) getrennt – Farbcodes mit § gibt es in 26.2 nicht mehr
			List<String[]> lines = new ArrayList<>();
			if (c.hudFps) lines.add(new String[]{"FPS", String.valueOf(mc.getFps())});
			if (c.hudCps) {
				long now = System.currentTimeMillis();
				lines.add(new String[]{"CPS", cps(LEFT, now) + " | " + cps(RIGHT, now)});
			}
			if (c.hudCoords) {
				lines.add(new String[]{"XYZ", mc.player.getBlockX() + " " + mc.player.getBlockY() + " " + mc.player.getBlockZ()});
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
				lines.add(new String[]{"Richtung", name});
			}
			if (c.hudPing && mc.getConnection() != null) {
				PlayerInfo e = mc.getConnection().getPlayerInfo(mc.player.getUUID());
				if (e != null) lines.add(new String[]{"Ping", e.getLatency() + " ms"});
			}
			if (!lines.isEmpty()) {
				int w = 0;
				for (String[] s : lines) w = Math.max(w, tr.width(s[0] + " " + s[1]));
				int y = 4;
				ctx.fill(2, 2, 8 + w, 4 + lines.size() * 10, 0x70000000);
				ctx.fill(2, 2, 3, 4 + lines.size() * 10, VantageScreen.accent());
				for (String[] s : lines) {
					ctx.text(tr, s[0], 5, y, 0xFFFFAA00);
					ctx.text(tr, s[1], 5 + tr.width(s[0] + " "), y, 0xFFFFFFFF);
					y += 10;
				}
			}
		}
		HudModules.render(ctx);
		Waypoints.render(ctx);
		if (c.trackerHud) TrackerCard.renderHud(ctx);
		ComboCounter.render(ctx);
		if (CameraControl.freeCam()) {
			String s = "Freecam – " + VantageClient.freecamKey.getTranslatedKeyMessage().getString() + " zum Beenden";
			int x = (ctx.guiWidth() - tr.width(s)) / 2;
			ctx.fill(x - 4, 3, x + tr.width(s) + 4, 15, 0x90000000);
			ctx.text(tr, s, x, 5, VantageScreen.accent());
		}
	}
}
