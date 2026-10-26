package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.Perspective;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import org.jetbrains.annotations.Nullable;

/**
 * Freelook (Taste halten: frei umschauen, der Spieler laeuft weiter geradeaus) und
 * Freecam (Kamera fliegt frei, der Spieler bleibt stehen). Im Einzelspieler fliegt die Freecam durch Bloecke,
 * auf Servern nicht (dort waere das wie X-Ray).
 */
public final class CameraControl {
	private static boolean freeLook;
	private static boolean freeCam;
	private static float yaw;
	private static float pitch;
	private static Vec3d pos = Vec3d.ZERO;
	private static Vec3d lastPos = Vec3d.ZERO;
	@Nullable
	private static Perspective before;
	private static boolean lookToggled;
	/** Gemerkte Einstellung fuer das Ausblenden verdeckter Chunks, solange die Freecam durch Bloecke fliegt. */
	@Nullable
	private static Boolean savedCull;

	private CameraControl() {
	}

	public static boolean freeLook() {
		return freeLook;
	}

	public static boolean freeCam() {
		return freeCam;
	}

	/** Eine der beiden Kameras ist aktiv: Mausbewegung dreht dann die Kamera statt den Spieler. */
	public static boolean active() {
		return freeLook || freeCam;
	}

	public static float yaw() {
		return yaw;
	}

	public static float pitch() {
		return pitch;
	}

	public static Vec3d position(float tickProgress) {
		return lastPos.lerp(pos, tickProgress);
	}

	/** Mausbewegung (statt den Spieler zu drehen). Gleiche Empfindlichkeit wie im Spiel. */
	public static boolean turn(double dx, double dy) {
		if (!active()) return false;
		yaw += (float) dx * 0.15f;
		pitch = MathHelper.clamp(pitch + (float) dy * 0.15f, -90f, 90f);
		return true;
	}

	public static void tick(MinecraftClient client) {
		if (client.player == null || client.world == null) {
			freeLook = false;
			freeCam = false;
			before = null;
			seeThrough(client, false);
			return;
		}
		VantageConfig c = VantageConfig.get();

		// Freecam an/aus
		while (VantageClient.freecamKey.wasPressed()) {
			if (freeCam) stopFreeCam(client);
			else startFreeCam(client);
		}
		if (freeCam && !client.player.isAlive()) stopFreeCam(client);

		// Freelook: halten (oder umschalten)
		boolean want;
		if (c.freelookToggle) {
			while (VantageClient.freelookKey.wasPressed()) lookToggled = !lookToggled;
			want = lookToggled;
		} else {
			while (VantageClient.freelookKey.wasPressed()) {
				// nur leeren
			}
			want = VantageClient.freelookKey.isPressed() && client.currentScreen == null;
		}
		if (freeCam) want = false;
		if (want && !freeLook) {
			freeLook = true;
			yaw = client.player.getYaw();
			pitch = client.player.getPitch();
			if (c.freelookThirdPerson) {
				before = client.options.getPerspective();
				client.options.setPerspective(Perspective.THIRD_PERSON_BACK);
			}
		} else if (!want && freeLook) {
			freeLook = false;
			if (before != null) client.options.setPerspective(before);
			before = null;
		}

		if (freeCam) moveFreeCam(client, c);
		seeThrough(client, freeCam && noClip(client));
	}

	/** Durch Bloecke fliegen nur im Einzelspieler (eigene Welt). */
	public static boolean noClip(MinecraftClient client) {
		return client.getServer() != null;
	}

	/**
	 * In einer Wand wuerde das Spiel alle "verdeckten" Chunks weglassen und man saehe nur Leere.
	 * Darum das Ausblenden verdeckter Chunks abschalten, solange die Kamera durch Bloecke fliegt (wie im Zuschauermodus).
	 */
	private static void seeThrough(MinecraftClient client, boolean on) {
		if (on && savedCull == null) {
			savedCull = client.chunkCullingEnabled;
			client.chunkCullingEnabled = false;
		} else if (!on && savedCull != null) {
			client.chunkCullingEnabled = savedCull;
			savedCull = null;
		}
	}

	private static void startFreeCam(MinecraftClient client) {
		if (freeLook) {
			freeLook = false;
			if (before != null) client.options.setPerspective(before);
			before = null;
		}
		freeCam = true;
		yaw = client.player.getYaw();
		pitch = client.player.getPitch();
		pos = client.player.getEyePos();
		lastPos = pos;
	}

	private static void stopFreeCam(MinecraftClient client) {
		freeCam = false;
	}

	private static void moveFreeCam(MinecraftClient client, VantageConfig c) {
		lastPos = pos;
		var o = client.options;
		float forward = (o.forwardKey.isPressed() ? 1 : 0) - (o.backKey.isPressed() ? 1 : 0);
		float side = (o.leftKey.isPressed() ? 1 : 0) - (o.rightKey.isPressed() ? 1 : 0);
		float up = (o.jumpKey.isPressed() ? 1 : 0) - (o.sneakKey.isPressed() ? 1 : 0);
		if (client.currentScreen != null) {
			forward = 0;
			side = 0;
			up = 0;
		}
		double speed = MathHelper.clamp(c.freecamSpeed, 0.1f, 3f) * (o.sprintKey.isPressed() ? 2.5 : 1.0);
		double rad = Math.toRadians(yaw);
		double sin = Math.sin(rad);
		double cos = Math.cos(rad);
		// Vorwaerts in Blickrichtung (waagerecht), seitlich, hoch/runter
		double dx = (-sin * forward + cos * side) * speed;
		double dz = (cos * forward + sin * side) * speed;
		double dy = up * speed;
		if (dx == 0 && dy == 0 && dz == 0) return;
		// Auf Servern nicht durch Bloecke: jede Achse einzeln pruefen (so gleitet man an Waenden entlang)
		Vec3d p = pos;
		p = tryMove(client, p, dx, 0, 0);
		p = tryMove(client, p, 0, dy, 0);
		p = tryMove(client, p, 0, 0, dz);
		pos = p;
	}

	private static Vec3d tryMove(MinecraftClient client, Vec3d from, double dx, double dy, double dz) {
		if (dx == 0 && dy == 0 && dz == 0) return from;
		Vec3d to = from.add(dx, dy, dz);
		if (noClip(client)) return to;
		Box box = new Box(to.x - 0.15, to.y - 0.15, to.z - 0.15, to.x + 0.15, to.y + 0.15, to.z + 0.15);
		return client.world.isSpaceEmpty(box) ? to : from;
	}
}
