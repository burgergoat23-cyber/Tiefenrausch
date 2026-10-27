package com.burgergoat.vantage.anim;

import java.util.HashMap;
import java.util.Map;

/**
 * Zieh- und Inspect-Animationen je Messer, nachempfunden den Bewegungen aus Counter-Strike
 * (Karambit-Fingerdreher, Butterfly-Flips, Schattendolch-Wirbel, M9-Wurf …).
 * Werte: Zeit t (0..1), Verschiebung x/y/z in Bloecken, Drehung rx/ry/rz in Grad (Handraum).
 */
public final class KnifeAnimations {
	public record Key(float t, float x, float y, float z, float rx, float ry, float rz) {
	}

	/** Geraeusch bei Zeit t: 0 = Schwung, 1 = Klick */
	public record Cue(float t, int sound) {
	}

	public record Anim(String name, int ticks, Key[] keys, Cue[] cues) {
		/** Bewegung zum Zeitpunkt t: {x, y, z, rx, ry, rz} */
		public float[] sample(float t) {
			float[] out = new float[6];
			if (t <= keys[0].t()) return values(keys[0]);
			if (t >= keys[keys.length - 1].t()) return values(keys[keys.length - 1]);
			int i = 0;
			while (i < keys.length - 2 && t > keys[i + 1].t()) i++;
			Key a = keys[i];
			Key b = keys[i + 1];
			Key prev = keys[Math.max(0, i - 1)];
			Key next = keys[Math.min(keys.length - 1, i + 2)];
			float span = Math.max(1e-4f, b.t() - a.t());
			float s = (t - a.t()) / span;
			float[] va = values(a);
			float[] vb = values(b);
			float[] vp = values(prev);
			float[] vn = values(next);
			for (int c = 0; c < 6; c++) {
				// Catmull-Rom-Tangenten (mit echten Zeitabstaenden), an den Enden 0
				float m0 = i == 0 ? 0 : (vb[c] - vp[c]) / Math.max(1e-4f, b.t() - prev.t()) * span;
				float m1 = i + 2 >= keys.length ? 0 : (vn[c] - va[c]) / Math.max(1e-4f, next.t() - a.t()) * span;
				float s2 = s * s;
				float s3 = s2 * s;
				out[c] = (2 * s3 - 3 * s2 + 1) * va[c] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * vb[c] + (s3 - s2) * m1;
			}
			return out;
		}

		private static float[] values(Key k) {
			return new float[]{k.x(), k.y(), k.z(), k.rx(), k.ry(), k.rz()};
		}
	}

	private static Key k(float t, float x, float y, float z, float rx, float ry, float rz) {
		return new Key(t, x, y, z, rx, ry, rz);
	}

	private static Cue swish(float t) {
		return new Cue(t, 0);
	}

	private static Cue click(float t) {
		return new Cue(t, 1);
	}

	private static Anim a(String name, int ticks, Key[] keys, Cue... cues) {
		return new Anim(name, ticks, keys, cues);
	}

	// ------------------------------------------------------------------ Ziehen (Deploy)

	public static final Anim DRAW_RAISE = a("raise", 16, new Key[]{
			k(0, 0, -0.55f, 0.05f, 45, 0, 0),
			k(0.55f, 0, 0.04f, 0, -8, 0, 0),
			k(0.8f, 0, -0.01f, 0, 3, 0, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.2f));

	public static final Anim DRAW_FLIP = a("flip_open", 18, new Key[]{
			k(0, 0.05f, -0.45f, 0, 20, 0, -170),
			k(0.35f, 0, -0.08f, 0, 5, 0, -165),
			k(0.6f, 0, 0.03f, 0, -5, 0, 12),
			k(0.8f, 0, 0, 0, 0, 0, -4),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.5f), swish(0.45f));

	public static final Anim DRAW_KARAMBIT = a("karambit", 22, new Key[]{
			k(0, 0, -0.6f, 0, 30, 0, -720),
			k(0.3f, 0, -0.12f, 0, 8, 0, -420),
			k(0.62f, 0, 0.05f, 0, -4, 0, -50),
			k(0.82f, 0, 0, 0, 0, 0, 8),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.25f), swish(0.5f));

	public static final Anim DRAW_BUTTERFLY = a("butterfly", 24, new Key[]{
			k(0, 0, -0.5f, 0, 30, 0, 0),
			k(0.2f, 0, -0.15f, 0, 10, 180, 20),
			k(0.4f, 0, 0, 0, 0, 360, -20),
			k(0.6f, 0, 0.03f, 0, 0, 540, 15),
			k(0.8f, 0, 0, 0, 0, 700, -5),
			k(1, 0, 0, 0, 0, 720, 0)}, click(0.2f), click(0.4f), click(0.6f), click(0.8f));

	public static final Anim DRAW_DAGGERS = a("daggers", 20, new Key[]{
			k(0, 0, -0.5f, 0, 30, 0, 0),
			k(0.35f, 0, -0.1f, 0, 0, 0, -240),
			k(0.7f, 0, 0.03f, 0, 0, 0, -345),
			k(1, 0, 0, 0, 0, 0, -360)}, swish(0.3f));

	public static final Anim DRAW_TOSS = a("toss", 24, new Key[]{
			k(0, 0, -0.4f, 0, 30, 0, 0),
			k(0.25f, 0, 0.02f, 0, 0, 0, 0),
			k(0.55f, 0, 0.38f, 0, -200, 0, 0),
			k(0.8f, 0, 0.02f, 0, -360, 0, 0),
			k(1, 0, 0, 0, -360, 0, 0)}, swish(0.35f), click(0.8f));

	public static final Anim DRAW_TALON = a("talon", 22, new Key[]{
			k(0, 0, -0.6f, 0, 30, 30, 720),
			k(0.3f, 0, -0.14f, 0, 10, 20, 400),
			k(0.6f, 0, 0.05f, 0, -4, -10, 40),
			k(0.82f, 0, 0, 0, 0, 3, -6),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.2f), swish(0.48f));

	public static final Anim DRAW_URSUS = a("ursus", 20, new Key[]{
			k(0, 0.05f, -0.5f, 0, 25, 180, -160),
			k(0.35f, 0, -0.1f, 0, 8, 120, -120),
			k(0.6f, 0, 0.04f, 0, -6, 10, 10),
			k(0.8f, 0, 0, 0, 0, -4, -3),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.52f), swish(0.4f));

	public static final Anim DRAW_FALCHION = a("falchion", 22, new Key[]{
			k(0, 0, -0.5f, 0, 40, 0, 0),
			k(0.25f, 0, -0.18f, 0, 70, 0, -40),
			k(0.5f, 0, 0.02f, 0, -20, 0, 20),
			k(0.7f, 0, 0.02f, 0, 6, 0, -6),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.35f), click(0.5f));

	public static final Anim DRAW_NAVAJA = a("navaja", 24, new Key[]{
			k(0, 0, -0.45f, 0, 20, 0, -150),
			k(0.3f, 0, -0.08f, 0, 4, 0, -140),
			k(0.45f, 0, -0.04f, 0, 2, 0, -70),
			k(0.62f, 0, 0.02f, 0, -3, 0, 8),
			k(0.8f, 0, 0, 0, 0, 0, -2),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.45f), click(0.62f));

	public static final Anim DRAW_STILETTO = a("stiletto", 18, new Key[]{
			k(0, 0, -0.45f, 0, 25, 0, -180),
			k(0.35f, 0, -0.06f, 0, 0, 0, -180),
			k(0.45f, 0, -0.02f, 0, -6, 0, 6),
			k(0.6f, 0, 0.01f, 0, 2, 0, -2),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.42f));

	public static final Anim DRAW_BAYONET = a("bayonet", 20, new Key[]{
			k(0, 0, -0.5f, 0, 35, 0, 0),
			k(0.3f, 0, -0.1f, 0, 10, 0, -180),
			k(0.6f, 0, 0.04f, 0, -6, 0, -350),
			k(0.8f, 0, 0, 0, 2, 0, -362),
			k(1, 0, 0, 0, 0, 0, -360)}, swish(0.35f));

	public static final Anim DRAW_GUT = a("gut", 18, new Key[]{
			k(0, 0, -0.5f, 0, 60, -30, 0),
			k(0.4f, 0, -0.06f, 0, -40, 20, 10),
			k(0.7f, 0, 0.03f, 0, -8, 0, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.3f));

	public static final Anim DRAW_NOMAD = a("nomad", 20, new Key[]{
			k(0, 0, -0.5f, 0, 25, -180, -150),
			k(0.4f, 0, -0.08f, 0, 6, -40, -60),
			k(0.62f, 0, 0.04f, 0, -4, 6, 8),
			k(0.82f, 0, 0, 0, 0, -2, -2),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.3f), click(0.55f));

	public static final Anim DRAW_HUNTSMAN = a("huntsman", 18, new Key[]{
			k(0, 0.1f, -0.6f, 0.1f, -90, 0, 20),
			k(0.4f, 0.04f, -0.1f, 0, -30, 0, 8),
			k(0.7f, 0, 0.03f, 0, 6, 0, -3),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.35f));

	public static final Anim DRAW_BOWIE = a("bowie", 20, new Key[]{
			k(0, 0.08f, -0.55f, 0, 50, 0, 40),
			k(0.4f, 0, -0.05f, 0, -15, 0, -18),
			k(0.62f, 0, 0.02f, 0, 6, 0, 6),
			k(0.82f, 0, 0, 0, -2, 0, -2),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.3f));

	public static final Anim DRAW_CLASSIC = a("classic", 20, new Key[]{
			k(0, -0.1f, 0.5f, 0.2f, 80, 0, -30),
			k(0.4f, -0.02f, 0.08f, 0, 20, 0, -8),
			k(0.7f, 0, -0.02f, 0, -5, 0, 2),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.3f));

	public static final Anim DRAW_PARACORD = a("paracord", 22, new Key[]{
			k(0, 0, -0.5f, 0, 30, 0, 0),
			k(0.3f, 0, -0.08f, 0, 5, 200, 0),
			k(0.6f, 0, 0.03f, 0, 0, 350, 0),
			k(0.8f, 0, 0, 0, 0, 362, 0),
			k(1, 0, 0, 0, 0, 360, 0)}, swish(0.25f), swish(0.5f));

	public static final Anim DRAW_SURVIVAL = a("survival", 20, new Key[]{
			k(0, 0, -0.5f, 0, 30, 0, 180),
			k(0.35f, 0, -0.06f, 0, 5, 0, 170),
			k(0.6f, 0, 0.05f, 0, -6, 0, -8),
			k(0.8f, 0, 0, 0, 0, 0, 3),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.45f));

	public static final Anim DRAW_SKELETON = a("skeleton", 22, new Key[]{
			k(0, 0, -0.5f, 0, 30, 0, 0),
			k(0.25f, 0, -0.1f, 0, 0, 0, -200),
			k(0.5f, 0, 0.02f, 0, 0, 0, -540),
			k(0.75f, 0, 0, 0, 0, 0, -715),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.2f), swish(0.45f));

	public static final Anim DRAW_KUKRI = a("kukri", 22, new Key[]{
			k(0, 0, 0.3f, 0.1f, -70, 0, 0),
			k(0.3f, 0, -0.2f, -0.1f, 40, 0, 0),
			k(0.55f, 0, 0.03f, 0, -8, 0, 0),
			k(0.8f, 0, 0, 0, 2, 0, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.25f));

	// ------------------------------------------------------------------ Inspect
	// Positionen: das Messer wird zur Bildmitte geholt (LX/LY = "anschauen", SX/SY = Tricks in der Hand)

	private static final float LX = -0.36f;
	private static final float LY = 0.22f;
	private static final float LZ = 0.05f;
	private static final float SX = -0.26f;
	private static final float SY = 0.2f;

	public static final Anim INSPECT_LOOK = a("look", 64, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX, LY, LZ, -10, -55, 20),
			k(0.35f, LX, LY + 0.01f, LZ, -12, -58, 22),
			k(0.55f, LX + 0.03f, LY + 0.02f, LZ, -10, 125, -20),
			k(0.75f, LX + 0.03f, LY + 0.02f, LZ, -12, 128, -22),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.45f));

	public static final Anim INSPECT_KARAMBIT = a("karambit", 72, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.1f, SX, SY, 0, -10, 0, 0),
			k(0.3f, SX, SY, 0, -10, 0, -360),
			k(0.38f, SX, SY, 0, -10, 0, -360),
			k(0.58f, SX, SY, 0, -10, 0, -720),
			k(0.7f, LX, LY, LZ, -10, -50, -700),
			k(0.85f, LX, LY, LZ, -12, -52, -698),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.2f), swish(0.48f));

	public static final Anim INSPECT_BUTTERFLY = a("butterfly", 80, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.1f, SX, SY, 0, -5, 180, 0),
			k(0.2f, SX, SY, 0, -5, 360, 15),
			k(0.3f, SX, SY + 0.02f, 0, -5, 540, -15),
			k(0.4f, SX, SY + 0.02f, 0, -5, 720, 0),
			k(0.55f, SX, SY + 0.4f, 0, -380, 720, 0),
			k(0.7f, SX, SY, 0, -720, 720, 0),
			k(0.8f, SX, SY, 0, -720, 900, 10),
			k(0.9f, SX, SY - 0.02f, 0, -720, 1080, 0),
			k(1, 0, 0, 0, -720, 1080, 0)},
			click(0.1f), click(0.2f), click(0.3f), click(0.4f), swish(0.5f), click(0.7f), click(0.8f), click(0.9f));

	public static final Anim INSPECT_DAGGERS = a("daggers", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.2f, SX, SY, 0, -10, 0, -360),
			k(0.3f, SX, SY, 0, -10, 0, -360),
			k(0.5f, LX, LY, LZ, -10, -60, -360),
			k(0.65f, LX, LY, LZ, -10, 120, -360),
			k(0.85f, SX, SY, 0, -5, 0, -720),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.12f), swish(0.75f));

	public static final Anim INSPECT_FLIP = a("flip", 66, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, SX, SY, 0, -8, 0, -180),
			k(0.25f, SX, SY, 0, -8, 0, 0),
			k(0.45f, LX, LY, LZ, -10, -55, 15),
			k(0.6f, LX, LY, LZ, -12, -57, 17),
			k(0.8f, LX + 0.03f, LY, LZ, -10, 125, -15),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.12f), click(0.25f), swish(0.7f));

	public static final Anim INSPECT_TOSS = a("toss", 74, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, SX, SY - 0.04f, 0, 10, 0, 0),
			k(0.35f, SX, SY + 0.42f, 0, -400, 0, 0),
			k(0.55f, SX, SY, 0, -720, 0, 0),
			k(0.7f, LX, LY, LZ, -730, -55, 15),
			k(0.85f, LX, LY, LZ, -732, -57, 17),
			k(1, 0, 0, 0, -720, 0, 0)}, swish(0.2f), click(0.55f));

	public static final Anim INSPECT_FALCHION = a("falchion", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.3f, SX, SY, 0, -5, 0, -720),
			k(0.4f, SX, SY, 0, -5, 0, -720),
			k(0.6f, LX, LY, LZ, -10, -55, -700),
			k(0.8f, LX + 0.03f, LY, LZ, -10, 125, -740),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.1f), swish(0.22f), swish(0.7f));

	public static final Anim INSPECT_NAVAJA = a("navaja", 64, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, SX, SY, 0, -5, 0, -360),
			k(0.3f, LX, LY, LZ, -10, -55, -360),
			k(0.55f, LX, LY, LZ, -10, 125, -360),
			k(0.75f, SX, SY, 0, -5, 0, -720),
			k(1, 0, 0, 0, 0, 0, -720)}, click(0.15f), swish(0.45f), click(0.75f));

	public static final Anim INSPECT_TALON = a("talon", 76, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, SX, SY, 0, -10, 0, 360),
			k(0.3f, LX, LY, LZ, -10, -55, 380),
			k(0.5f, LX, LY + 0.02f, LZ, -14, -50, 360),
			k(0.7f, LX + 0.03f, LY, LZ, -10, 125, 340),
			k(0.85f, SX, SY, 0, -5, 0, 720),
			k(1, 0, 0, 0, 0, 0, 720)}, swish(0.1f), swish(0.8f));

	public static final Anim INSPECT_URSUS = a("ursus", 68, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX, LY, LZ, -10, -55, 18),
			k(0.35f, LX, LY, LZ, -14, -58, 20),
			k(0.5f, SX, SY + 0.05f, 0, -190, 0, 0),
			k(0.62f, SX, SY, 0, -360, 0, 0),
			k(0.8f, LX + 0.03f, LY, LZ, -370, 125, -15),
			k(1, 0, 0, 0, -360, 0, 0)}, swish(0.45f), click(0.62f));

	public static final Anim INSPECT_STILETTO = a("stiletto", 64, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX, LY, LZ, -10, -55, 18),
			k(0.3f, LX, LY, LZ, -10, -55, 18),
			k(0.4f, SX, SY, 0, -5, 0, -180),
			k(0.5f, SX, SY, 0, -5, 0, -180),
			k(0.56f, SX, SY, 0, -8, 0, 4),
			k(0.75f, LX + 0.03f, LY, LZ, -10, 125, -15),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.4f), click(0.56f));

	public static final Anim INSPECT_BAYONET = a("bayonet", 72, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.1f, SX, SY, 0, -8, 0, 0),
			k(0.3f, SX, SY, 0, -8, 0, -720),
			k(0.45f, LX, LY, LZ, -10, -55, -705),
			k(0.6f, LX, LY, LZ, -12, -57, -703),
			k(0.8f, LX + 0.03f, LY, LZ, -10, 125, -735),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.15f), swish(0.25f));

	public static final Anim INSPECT_GUT = a("gut", 62, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.18f, LX, LY, LZ, -10, -70, 25),
			k(0.32f, LX, LY + 0.04f, LZ + 0.06f, -30, -70, 25),
			k(0.4f, LX, LY, LZ, -10, -70, 25),
			k(0.6f, LX + 0.03f, LY, LZ, -10, 110, -25),
			k(0.78f, LX + 0.03f, LY, LZ, -12, 112, -27),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.36f), swish(0.5f));

	public static final Anim INSPECT_NOMAD = a("nomad", 66, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX, LY, LZ, -10, -55, 18),
			k(0.3f, LX, LY, LZ, -10, -55, -12),
			k(0.45f, LX, LY, LZ, -10, -55, 18),
			k(0.6f, SX, SY, 0, -8, 180, 0),
			k(0.8f, LX + 0.03f, LY, LZ, -10, 125, -15),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.55f));

	public static final Anim INSPECT_HUNTSMAN = a("huntsman", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX, LY, LZ, -10, -55, 20),
			k(0.3f, LX - 0.04f, LY + 0.03f, LZ, -10, -55, 20),
			k(0.45f, LX, LY + 0.08f, LZ, -60, -20, 5),
			k(0.6f, LX, LY + 0.04f, LZ, -12, 125, -20),
			k(0.8f, LX + 0.03f, LY, LZ, -14, 128, -22),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.4f), swish(0.55f));

	public static final Anim INSPECT_BOWIE = a("bowie", 72, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX, LY, LZ, -10, -55, 20),
			k(0.35f, LX, LY, LZ, -12, -58, 22),
			k(0.5f, SX, SY + 0.03f, 0, -180, 0, 0),
			k(0.65f, LX, LY, LZ, -190, 55, -20),
			k(0.82f, LX, LY, LZ, -188, 55, -22),
			k(1, 0, 0, 0, -360, 0, 0)}, swish(0.45f), swish(0.9f));

	public static final Anim INSPECT_CLASSIC = a("classic", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, SX, SY - 0.04f, 0, 10, 0, 0),
			k(0.3f, SX, SY + 0.3f, 0, 10, 0, -180),
			k(0.45f, SX, SY, 0, 10, 0, -360),
			k(0.6f, LX, LY, LZ, -10, -55, -342),
			k(0.8f, LX + 0.03f, LY, LZ, -10, 125, -375),
			k(1, 0, 0, 0, 0, 0, -360)}, swish(0.2f), click(0.45f));

	public static final Anim INSPECT_PARACORD = a("paracord", 72, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, SX, SY, 0, -5, 0, 0),
			k(0.3f, SX, SY, 0, -5, 360, 0),
			k(0.48f, SX, SY, 0, -5, 720, 0),
			k(0.62f, LX, LY, LZ, -10, 665, 18),
			k(0.8f, LX + 0.03f, LY, LZ, -10, 845, -15),
			k(1, 0, 0, 0, 0, 720, 0)}, swish(0.2f), swish(0.4f));

	public static final Anim INSPECT_SURVIVAL = a("survival", 66, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, SX, SY, 0, -5, 0, 180),
			k(0.3f, SX, SY, 0, -5, 0, 180),
			k(0.45f, SX, SY, 0, -5, 0, 0),
			k(0.6f, LX, LY, LZ, -10, -55, 18),
			k(0.8f, LX + 0.03f, LY, LZ, -10, 125, -15),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.15f), swish(0.45f));

	public static final Anim INSPECT_SKELETON = a("skeleton", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.1f, SX, SY, 0, -10, 0, 0),
			k(0.25f, SX, SY, 0, -10, 0, -360),
			k(0.4f, SX, SY, 0, -10, 0, -720),
			k(0.55f, SX, SY, 0, -10, 0, -1080),
			k(0.7f, LX, LY, LZ, -10, -55, -1062),
			k(0.85f, LX + 0.03f, LY, LZ, -10, 125, -1095),
			k(1, 0, 0, 0, 0, 0, -1080)}, swish(0.18f), swish(0.33f), swish(0.48f));

	public static final Anim INSPECT_KUKRI = a("kukri", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX, LY, LZ, -10, -55, 30),
			k(0.35f, LX, LY + 0.02f, LZ, -30, -55, 40),
			k(0.5f, LX, LY, LZ, -10, -55, 30),
			k(0.7f, LX + 0.03f, LY, LZ, -10, 125, -30),
			k(0.85f, LX + 0.03f, LY, LZ, -12, 128, -32),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.6f));

	// ------------------------------------------------------------------ Andere Waffen und Gegenstaende

	public static final Anim DRAW_AXE = a("axe", 22, new Key[]{
			k(0, 0.05f, 0.35f, 0.15f, -80, 0, -20),
			k(0.35f, 0, -0.12f, 0, 35, 0, 5),
			k(0.6f, 0, 0.03f, 0, -8, 0, -2),
			k(0.8f, 0, 0, 0, 3, 0, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.3f));

	public static final Anim INSPECT_AXE = a("axe", 74, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX, LY, LZ, -10, -60, 25),
			k(0.32f, LX, LY + 0.02f, LZ, -14, -62, 28),
			k(0.45f, SX, SY + 0.04f, 0, -10, 0, -340),
			k(0.55f, SX, SY, 0, -10, 0, -360),
			k(0.72f, LX + 0.03f, LY, LZ, -10, 120, -385),
			k(0.86f, LX + 0.03f, LY, LZ, -12, 122, -387),
			k(1, 0, 0, 0, 0, 0, -360)}, swish(0.45f), swish(0.65f));

	public static final Anim DRAW_AXE_TOSS = a("axe_toss", 24, new Key[]{
			k(0, 0, -0.45f, 0, 30, 0, 0),
			k(0.25f, 0, 0.0f, 0, 0, 0, 0),
			k(0.5f, 0, 0.32f, 0, -360, 0, 0),
			k(0.75f, 0, 0.02f, 0, -720, 0, 0),
			k(1, 0, 0, 0, -720, 0, 0)}, swish(0.35f), click(0.75f));

	public static final Anim INSPECT_AXE_TOSS = a("axe_toss", 72, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, SX, SY - 0.04f, 0, 10, 0, 0),
			k(0.32f, SX, SY + 0.4f, 0, -360, 0, 0),
			k(0.5f, SX, SY, 0, -720, 0, 0),
			k(0.68f, LX, LY, LZ, -730, -60, 22),
			k(0.85f, LX + 0.03f, LY, LZ, -730, 120, -22),
			k(1, 0, 0, 0, -720, 0, 0)}, swish(0.2f), click(0.5f));

	public static final Anim DRAW_MACE = a("mace", 26, new Key[]{
			k(0, 0, -0.6f, 0, 60, 0, 0),
			k(0.4f, 0, -0.15f, 0, 20, 0, 0),
			k(0.6f, 0, 0.06f, 0, -12, 0, 0),
			k(0.75f, 0, -0.03f, 0, 5, 0, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.45f));

	public static final Anim INSPECT_MACE = a("mace", 80, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, -0.1f, 0.25f, 0.1f, -60, -20, 40),
			k(0.35f, -0.12f, 0.27f, 0.1f, -62, -20, 42),
			k(0.5f, LX, LY, LZ, -10, -60, 25),
			k(0.65f, LX, LY, LZ, -10, 120, -25),
			k(0.82f, LX, LY, LZ, -12, 122, -27),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.12f), swish(0.6f));

	public static final Anim DRAW_MACE_SPIN = a("mace_spin", 24, new Key[]{
			k(0, 0, -0.5f, 0, 30, 0, 0),
			k(0.3f, 0, -0.1f, 0, 0, 0, -200),
			k(0.6f, 0, 0.03f, 0, 0, 0, -350),
			k(0.8f, 0, 0, 0, 0, 0, -362),
			k(1, 0, 0, 0, 0, 0, -360)}, swish(0.3f));

	public static final Anim INSPECT_MACE_SPIN = a("mace_spin", 74, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, SX, SY, 0, -10, 0, 0),
			k(0.3f, SX, SY, 0, -10, 0, -360),
			k(0.45f, SX, SY, 0, -10, 0, -720),
			k(0.62f, LX, LY, LZ, -10, -60, -695),
			k(0.82f, LX + 0.03f, LY, LZ, -10, 120, -745),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.2f), swish(0.38f));

	public static final Anim DRAW_SPEAR = a("spear", 24, new Key[]{
			k(0, 0, -0.5f, 0, 30, 0, 0),
			k(0.3f, 0, -0.08f, 0, 0, 0, -180),
			k(0.6f, 0, 0.04f, 0, -6, 0, -355),
			k(1, 0, 0, 0, 0, 0, -360)}, swish(0.3f));

	public static final Anim INSPECT_SPEAR = a("spear", 76, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, SX, SY, 0, -5, 0, 0),
			k(0.3f, SX, SY, 0, -5, 0, -540),
			k(0.45f, SX, SY, 0, -5, 0, -720),
			k(0.62f, LX, LY, LZ, -10, -60, -700),
			k(0.82f, LX + 0.03f, LY, LZ, -10, 120, -740),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.18f), swish(0.32f));

	public static final Anim DRAW_SHIELD = a("shield", 18, new Key[]{
			k(0, 0.15f, -0.5f, 0, 20, 60, 0),
			k(0.5f, 0, 0.03f, 0, -4, -6, 0),
			k(0.75f, 0, 0, 0, 2, 2, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.5f));

	public static final Anim INSPECT_SHIELD = a("shield", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, -0.15f, 0.12f, 0.05f, -5, -30, 0),
			k(0.35f, -0.15f, 0.12f, 0.05f, -5, -32, 0),
			k(0.55f, -0.15f, 0.1f, 0.05f, -5, 150, 0),
			k(0.8f, -0.15f, 0.1f, 0.05f, -5, 152, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.45f));

	public static final Anim DRAW_GRENADE = a("grenade", 22, new Key[]{
			k(0, 0, -0.45f, 0, 30, 0, 0),
			k(0.25f, 0, -0.02f, 0, 0, 0, 0),
			k(0.5f, 0, 0.3f, 0, -180, 90, 0),
			k(0.75f, 0, 0.0f, 0, -360, 180, 0),
			k(1, 0, 0, 0, -360, 180, 0)}, swish(0.3f), click(0.75f));

	public static final Anim INSPECT_GRENADE = a("grenade", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX * 0.8f, LY, LZ, -10, -40, 10),
			k(0.3f, LX * 0.8f, LY, LZ, -10, 80, 10),
			k(0.45f, LX * 0.8f, LY, LZ, -10, 200, 10),
			k(0.6f, LX * 0.8f, LY + 0.35f, LZ, -200, 300, 10),
			k(0.78f, LX * 0.8f, LY, LZ, -360, 360, 10),
			k(1, 0, 0, 0, -360, 360, 0)}, swish(0.55f), click(0.78f));

	public static final Anim DRAW_WIND = a("wind", 20, new Key[]{
			k(0, 0, -0.45f, 0, 30, 0, 0),
			k(0.35f, 0, -0.05f, 0, 0, 240, 0),
			k(0.7f, 0, 0.03f, 0, 0, 350, 0),
			k(1, 0, 0, 0, 0, 360, 0)}, swish(0.3f));

	public static final Anim INSPECT_WIND = a("wind", 66, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, LX * 0.8f, LY, LZ, -10, 0, 0),
			k(0.4f, LX * 0.8f, LY + 0.04f, LZ, -10, 540, 0),
			k(0.65f, LX * 0.8f, LY, LZ, -10, 1080, 0),
			k(0.8f, LX * 0.8f, LY, LZ, -10, 1100, 0),
			k(1, 0, 0, 0, 0, 1080, 0)}, swish(0.25f), swish(0.5f));

	public static final Anim DRAW_TOTEM = a("totem", 20, new Key[]{
			k(0, 0, -0.5f, 0, 20, 0, 0),
			k(0.5f, 0, 0.05f, 0, -6, 0, 0),
			k(0.75f, 0, -0.01f, 0, 2, 0, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.3f));

	public static final Anim INSPECT_TOTEM = a("totem", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.2f, LX * 0.8f, LY + 0.05f, LZ + 0.05f, -5, -30, 0),
			k(0.4f, LX * 0.8f, LY + 0.07f, LZ + 0.05f, -5, -30, 0),
			k(0.6f, LX * 0.8f, LY + 0.05f, LZ + 0.05f, -5, 150, 0),
			k(0.8f, LX * 0.8f, LY + 0.07f, LZ + 0.05f, -5, 150, 0),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.5f));

	// ------------------------------------------------------------------ Schlaege
	// Wie in CS: zwei Hiebe im Wechsel (Vorhand von rechts, Rueckhand von links), dazu ein schwerer Stich.
	// Axt und Streitkolben schlagen wie Axt und Hammer aus CS (Danger Zone) von oben.

	public static final Anim SLASH_RIGHT = a("slash_r", 9, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, 0.06f, 0.1f, 0.02f, 5, -10, -30),
			k(0.4f, -0.22f, 0.02f, -0.12f, -20, 10, 60),
			k(0.58f, -0.42f, -0.12f, -0.05f, -25, 15, 95),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.22f));

	public static final Anim SLASH_LEFT = a("slash_l", 9, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, -0.3f, 0.08f, 0, 0, 10, 70),
			k(0.4f, -0.02f, 0, -0.12f, -20, 0, -10),
			k(0.58f, 0.12f, -0.12f, -0.04f, -25, -10, -55),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.22f));

	public static final Anim STAB = a("stab", 12, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.25f, 0.04f, 0, 0.12f, 15, 0, -5),
			k(0.45f, -0.12f, 0.04f, -0.4f, -40, 5, 5),
			k(0.62f, -0.12f, 0.03f, -0.38f, -40, 5, 5),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.35f));

	/** Karambit: hakende Boegen mit Drehung um den Ring. */
	public static final Anim HOOK_RIGHT = a("hook_r", 9, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, 0.06f, 0.08f, 0.02f, 0, -10, -40),
			k(0.4f, -0.22f, 0.06f, -0.12f, -20, 10, 100),
			k(0.58f, -0.4f, -0.1f, -0.05f, -25, 15, 150),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.22f));

	public static final Anim HOOK_LEFT = a("hook_l", 9, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, -0.28f, 0.08f, 0, 0, 10, 80),
			k(0.4f, -0.02f, 0.04f, -0.12f, -20, 0, -40),
			k(0.58f, 0.12f, -0.1f, -0.04f, -25, -10, -110),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.22f));

	/** Schattendolche: schnelle Faustschlaege nach vorne. */
	public static final Anim PUNCH_A = a("punch_a", 8, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.2f, 0.02f, -0.02f, 0.1f, 10, 0, 0),
			k(0.42f, -0.15f, 0.03f, -0.38f, -35, 0, -5),
			k(0.56f, -0.15f, 0.03f, -0.36f, -35, 0, -5),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.25f));

	public static final Anim PUNCH_B = a("punch_b", 8, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.2f, -0.05f, 0, 0.1f, 10, 0, 0),
			k(0.42f, -0.25f, -0.02f, -0.36f, -30, 0, 15),
			k(0.56f, -0.25f, -0.02f, -0.34f, -30, 0, 15),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.25f));

	/** Axt: Hieb von oben (Danger-Zone-Axt): hoch ueber den Kopf, dann nach vorne unten. */
	public static final Anim CHOP = a("chop", 11, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.3f, 0.02f, 0.38f, 0.04f, 12, -5, 8),
			k(0.5f, -0.1f, -0.18f, -0.3f, -60, 5, 10),
			k(0.66f, -0.1f, -0.2f, -0.28f, -62, 5, 10),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.4f));

	public static final Anim CHOP_DIAGONAL = a("chop_d", 11, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.3f, 0.1f, 0.34f, 0.04f, 10, -5, -25),
			k(0.5f, -0.24f, -0.16f, -0.28f, -55, 10, 40),
			k(0.66f, -0.26f, -0.18f, -0.26f, -57, 10, 42),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.4f));

	/** Streitkolben: schwerer Hammerschlag mit langem Ausholen. */
	public static final Anim SMASH = a("smash", 14, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.35f, 0, 0.45f, 0.06f, 15, 0, 5),
			k(0.55f, -0.08f, -0.24f, -0.32f, -70, 5, 8),
			k(0.62f, -0.08f, -0.21f, -0.31f, -66, 5, 8),
			k(0.72f, -0.08f, -0.25f, -0.31f, -72, 5, 8),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.45f));

	/** Passende Schlaganimation. kind: 0 = Schwert/Messer, 1 = Axt, 2 = Streitkolben. */
	public static Anim swing(int kind, String shape, boolean alt, boolean heavy) {
		if (kind == 1) return alt ? CHOP_DIAGONAL : CHOP;
		if (kind == 2) return SMASH;
		if (shape != null && shape.equals("shadow_daggers")) return alt ? PUNCH_B : PUNCH_A;
		if (heavy) return STAB;
		if (shape != null && (shape.equals("karambit") || shape.equals("talon"))) return alt ? HOOK_LEFT : HOOK_RIGHT;
		return alt ? SLASH_LEFT : SLASH_RIGHT;
	}

	private static final Map<String, Anim[]> BY_SHAPE = new HashMap<>();

	static {
		// jedes Messer hat seine eigene Zieh- und Inspect-Animation
		put(DRAW_KARAMBIT, INSPECT_KARAMBIT, "karambit");
		put(DRAW_TALON, INSPECT_TALON, "talon");
		put(DRAW_BUTTERFLY, INSPECT_BUTTERFLY, "butterfly");
		put(DRAW_DAGGERS, INSPECT_DAGGERS, "shadow_daggers");
		put(DRAW_FLIP, INSPECT_FLIP, "flip");
		put(DRAW_URSUS, INSPECT_URSUS, "ursus");
		put(DRAW_FALCHION, INSPECT_FALCHION, "falchion");
		put(DRAW_NAVAJA, INSPECT_NAVAJA, "navaja");
		put(DRAW_STILETTO, INSPECT_STILETTO, "stiletto");
		put(DRAW_TOSS, INSPECT_TOSS, "m9");
		put(DRAW_BAYONET, INSPECT_BAYONET, "bayonet");
		put(DRAW_GUT, INSPECT_GUT, "gut");
		put(DRAW_NOMAD, INSPECT_NOMAD, "nomad");
		put(DRAW_HUNTSMAN, INSPECT_HUNTSMAN, "huntsman");
		put(DRAW_BOWIE, INSPECT_BOWIE, "bowie");
		put(DRAW_CLASSIC, INSPECT_CLASSIC, "classic");
		put(DRAW_PARACORD, INSPECT_PARACORD, "paracord");
		put(DRAW_SURVIVAL, INSPECT_SURVIVAL, "survival");
		put(DRAW_SKELETON, INSPECT_SKELETON, "skeleton");
		put(DRAW_KUKRI, INSPECT_KUKRI, "kukri");
		put(DRAW_RAISE, INSPECT_LOOK, "default", "sword");
		// andere Waffen: eigene Bewegungen je Art (und Wurf-Variante fuer leichte Aexte und Keulen)
		put(DRAW_AXE, INSPECT_AXE, "axe");
		put(DRAW_AXE_TOSS, INSPECT_AXE_TOSS, "axe:tomahawk", "axe:cleaver", "axe:ice_axe");
		put(DRAW_MACE, INSPECT_MACE, "mace");
		put(DRAW_MACE_SPIN, INSPECT_MACE_SPIN, "mace:scepter", "mace:baseball", "mace:wrench", "mace:morning_star");
		put(DRAW_SPEAR, INSPECT_SPEAR, "spear");
		put(DRAW_SHIELD, INSPECT_SHIELD, "shield");
		put(DRAW_GRENADE, INSPECT_GRENADE, "grenade");
		put(DRAW_WIND, INSPECT_WIND, "wind");
		put(DRAW_TOTEM, INSPECT_TOTEM, "totem");
	}

	private static void put(Anim draw, Anim inspect, String... shapes) {
		for (String s : shapes) BY_SHAPE.put(s, new Anim[]{draw, inspect});
	}

	private KnifeAnimations() {
	}

	public static boolean has(String key) {
		return BY_SHAPE.containsKey(key);
	}

	public static Anim draw(String shape) {
		Anim[] a = BY_SHAPE.get(shape);
		return a == null ? DRAW_RAISE : a[0];
	}

	public static Anim inspect(String shape) {
		Anim[] a = BY_SHAPE.get(shape);
		return a == null ? INSPECT_LOOK : a[1];
	}
}
