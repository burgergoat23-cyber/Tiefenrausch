package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraft.util.Mth;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import org.jetbrains.annotations.Nullable;

/**
 * Freelook (Taste halten: frei umschauen, der Spieler laeuft weiter geradeaus) und
 * Freecam (Kamera fliegt frei, der Spieler bleibt stehen). Die Freecam fliegt nicht durch Bloecke.
 */
public final class CameraControl {
	private static boolean freeLook;
	private static boolean freeCam;
	private static float yaw;
	private static float pitch;
	private static Vec3 pos = Vec3.ZERO;
	private static Vec3 lastPos = Vec3.ZERO;
	@Nullable
	private static CameraType before;
	private static boolean lookToggled;

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

	public static Vec3 position(float tickProgress) {
		return lastPos.lerp(pos, tickProgress);
	}

	/** Mausbewegung (statt den Spieler zu drehen). Gleiche Empfindlichkeit wie im Spiel. */
	public static boolean turn(double dx, double dy) {
		if (!active()) return false;
		yaw += (float) dx * 0.15f;
		pitch = Mth.clamp(pitch + (float) dy * 0.15f, -90f, 90f);
		return true;
	}

	public static void tick(Minecraft client) {
		if (client.player == null || client.level == null) {
			freeLook = false;
			freeCam = false;
			before = null;
			return;
		}
		VantageConfig c = VantageConfig.get();

		// Freecam an/aus
		while (VantageClient.freecamKey.consumeClick()) {
			if (freeCam) freeCam = false;
			else startFreeCam(client);
		}
		if (freeCam && !client.player.isAlive()) freeCam = false;

		// Freelook: halten (oder umschalten)
		boolean want;
		if (c.freelookToggle) {
			while (VantageClient.freelookKey.consumeClick()) lookToggled = !lookToggled;
			want = lookToggled;
		} else {
			while (VantageClient.freelookKey.consumeClick()) {
				// nur leeren
			}
			want = VantageClient.freelookKey.isDown() && client.gui.screen() == null;
		}
		if (freeCam) want = false;
		if (want && !freeLook) {
			freeLook = true;
			yaw = client.player.getYRot();
			pitch = client.player.getXRot();
			if (c.freelookThirdPerson) {
				before = client.options.getCameraType();
				client.options.setCameraType(CameraType.THIRD_PERSON_BACK);
			}
		} else if (!want && freeLook) {
			freeLook = false;
			if (before != null) client.options.setCameraType(before);
			before = null;
		}

		if (freeCam) moveFreeCam(client, c);
	}

	private static void startFreeCam(Minecraft client) {
		if (freeLook) {
			freeLook = false;
			if (before != null) client.options.setCameraType(before);
			before = null;
		}
		freeCam = true;
		yaw = client.player.getYRot();
		pitch = client.player.getXRot();
		pos = client.player.getEyePosition();
		lastPos = pos;
	}

	private static void moveFreeCam(Minecraft client, VantageConfig c) {
		lastPos = pos;
		var o = client.options;
		float forward = (o.keyUp.isDown() ? 1 : 0) - (o.keyDown.isDown() ? 1 : 0);
		float side = (o.keyLeft.isDown() ? 1 : 0) - (o.keyRight.isDown() ? 1 : 0);
		float up = (o.keyJump.isDown() ? 1 : 0) - (o.keyShift.isDown() ? 1 : 0);
		if (client.gui.screen() != null) {
			forward = 0;
			side = 0;
			up = 0;
		}
		double speed = Mth.clamp(c.freecamSpeed, 0.1f, 3f) * (o.keySprint.isDown() ? 2.5 : 1.0);
		double rad = Math.toRadians(yaw);
		double sin = Math.sin(rad);
		double cos = Math.cos(rad);
		double dx = (-sin * forward + cos * side) * speed;
		double dz = (cos * forward + sin * side) * speed;
		double dy = up * speed;
		if (dx == 0 && dy == 0 && dz == 0) return;
		// Nicht durch Bloecke: jede Achse einzeln pruefen (so gleitet man an Waenden entlang)
		Vec3 p = pos;
		p = tryMove(client, p, dx, 0, 0);
		p = tryMove(client, p, 0, dy, 0);
		p = tryMove(client, p, 0, 0, dz);
		pos = p;
	}

	private static Vec3 tryMove(Minecraft client, Vec3 from, double dx, double dy, double dz) {
		if (dx == 0 && dy == 0 && dz == 0) return from;
		Vec3 to = from.add(dx, dy, dz);
		AABB box = new AABB(to.x - 0.15, to.y - 0.15, to.z - 0.15, to.x + 0.15, to.y + 0.15, to.z + 0.15);
		return client.level.noCollision(box) ? to : from;
	}
}
