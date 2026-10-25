package com.burgergoat.arsenal.anim;

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

	// ------------------------------------------------------------------ Inspect

	public static final Anim INSPECT_LOOK = a("look", 64, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, -0.05f, 0.08f, 0.05f, -10, -55, 20),
			k(0.35f, -0.05f, 0.09f, 0.05f, -12, -58, 22),
			k(0.55f, -0.02f, 0.1f, 0.05f, -10, 125, -20),
			k(0.75f, -0.02f, 0.1f, 0.05f, -12, 128, -22),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.45f));

	public static final Anim INSPECT_KARAMBIT = a("karambit", 72, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.1f, 0, 0.05f, 0, -10, 0, 0),
			k(0.3f, 0, 0.05f, 0, -10, 0, -360),
			k(0.38f, 0, 0.05f, 0, -10, 0, -360),
			k(0.58f, 0, 0.05f, 0, -10, 0, -720),
			k(0.7f, -0.05f, 0.1f, 0.05f, -10, -50, -700),
			k(0.85f, -0.05f, 0.1f, 0.05f, -12, -52, -698),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.2f), swish(0.48f));

	public static final Anim INSPECT_BUTTERFLY = a("butterfly", 80, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.1f, 0, 0.06f, 0, -5, 180, 0),
			k(0.2f, 0, 0.06f, 0, -5, 360, 15),
			k(0.3f, 0, 0.08f, 0, -5, 540, -15),
			k(0.4f, 0, 0.08f, 0, -5, 720, 0),
			k(0.55f, 0, 0.4f, 0, -380, 720, 0),
			k(0.7f, 0, 0.06f, 0, -720, 720, 0),
			k(0.8f, 0, 0.06f, 0, -720, 900, 10),
			k(0.9f, 0, 0.04f, 0, -720, 1080, 0),
			k(1, 0, 0, 0, -720, 1080, 0)},
			click(0.1f), click(0.2f), click(0.3f), click(0.4f), swish(0.5f), click(0.7f), click(0.8f), click(0.9f));

	public static final Anim INSPECT_DAGGERS = a("daggers", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.2f, 0, 0.08f, 0, -10, 0, -360),
			k(0.3f, 0, 0.08f, 0, -10, 0, -360),
			k(0.5f, -0.04f, 0.1f, 0.04f, -10, -60, -360),
			k(0.65f, -0.04f, 0.1f, 0.04f, -10, 120, -360),
			k(0.85f, 0, 0.05f, 0, -5, 0, -720),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.12f), swish(0.75f));

	public static final Anim INSPECT_FLIP = a("flip", 66, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, 0, 0.06f, 0, -8, 0, -180),
			k(0.25f, 0, 0.06f, 0, -8, 0, 0),
			k(0.45f, -0.05f, 0.1f, 0.05f, -10, -55, 15),
			k(0.6f, -0.05f, 0.1f, 0.05f, -12, -57, 17),
			k(0.8f, -0.03f, 0.1f, 0.05f, -10, 125, -15),
			k(1, 0, 0, 0, 0, 0, 0)}, click(0.12f), click(0.25f), swish(0.7f));

	public static final Anim INSPECT_TOSS = a("toss", 74, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.12f, 0, 0.04f, 0, 10, 0, 0),
			k(0.35f, 0, 0.45f, 0, -400, 0, 0),
			k(0.55f, 0, 0.02f, 0, -720, 0, 0),
			k(0.7f, -0.05f, 0.1f, 0.05f, -730, -55, 15),
			k(0.85f, -0.05f, 0.1f, 0.05f, -732, -57, 17),
			k(1, 0, 0, 0, -720, 0, 0)}, swish(0.2f), click(0.55f));

	public static final Anim INSPECT_FALCHION = a("falchion", 70, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.3f, 0, 0.06f, 0, -5, 0, -720),
			k(0.4f, 0, 0.06f, 0, -5, 0, -720),
			k(0.6f, -0.05f, 0.1f, 0.05f, -10, -55, -700),
			k(0.8f, -0.03f, 0.1f, 0.05f, -10, 125, -740),
			k(1, 0, 0, 0, 0, 0, -720)}, swish(0.1f), swish(0.22f), swish(0.7f));

	public static final Anim INSPECT_NAVAJA = a("navaja", 64, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.15f, 0, 0.05f, 0, -5, 0, -360),
			k(0.3f, -0.04f, 0.08f, 0.04f, -10, -55, -360),
			k(0.55f, -0.04f, 0.08f, 0.04f, -10, 125, -360),
			k(0.75f, 0, 0.05f, 0, -5, 0, -720),
			k(1, 0, 0, 0, 0, 0, -720)}, click(0.15f), swish(0.45f), click(0.75f));

	private static final Map<String, Anim[]> BY_SHAPE = new HashMap<>();

	static {
		put(DRAW_KARAMBIT, INSPECT_KARAMBIT, "karambit", "talon");
		put(DRAW_BUTTERFLY, INSPECT_BUTTERFLY, "butterfly");
		put(DRAW_DAGGERS, INSPECT_DAGGERS, "shadow_daggers");
		put(DRAW_FLIP, INSPECT_FLIP, "flip", "ursus");
		put(DRAW_FLIP, INSPECT_FALCHION, "falchion");
		put(DRAW_FLIP, INSPECT_NAVAJA, "navaja", "stiletto");
		put(DRAW_TOSS, INSPECT_TOSS, "m9", "bayonet");
		put(DRAW_RAISE, INSPECT_TOSS, "gut");
		put(DRAW_RAISE, INSPECT_FLIP, "nomad");
		put(DRAW_RAISE, INSPECT_LOOK, "huntsman", "bowie", "classic", "paracord", "survival", "skeleton", "kukri");
	}

	private static void put(Anim draw, Anim inspect, String... shapes) {
		for (String s : shapes) BY_SHAPE.put(s, new Anim[]{draw, inspect});
	}

	private KnifeAnimations() {
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
