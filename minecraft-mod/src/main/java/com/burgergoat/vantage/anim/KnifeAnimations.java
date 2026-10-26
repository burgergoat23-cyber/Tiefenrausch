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

	// ------------------------------------------------------------------ Schlaege
	// Wie in CS: zwei Hiebe im Wechsel (Vorhand von rechts, Rueckhand von links), dazu ein schwerer Stich.
	// Axt und Streitkolben schlagen wie Axt und Hammer aus CS (Danger Zone) von oben.

	public static final Anim SLASH_RIGHT = a("slash_r", 9, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.16f, 0.08f, 0.1f, 0.04f, 8, -30, -25),
			k(0.42f, -0.3f, -0.02f, -0.22f, -30, 45, 55),
			k(0.6f, -0.4f, -0.14f, -0.1f, -20, 60, 70),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.22f));

	public static final Anim SLASH_LEFT = a("slash_l", 9, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.16f, -0.22f, 0.1f, 0.02f, 5, 35, 40),
			k(0.42f, 0.1f, -0.04f, -0.22f, -28, -40, -45),
			k(0.6f, 0.16f, -0.14f, -0.08f, -15, -55, -60),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.22f));

	public static final Anim STAB = a("stab", 12, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.25f, 0.04f, 0.02f, 0.14f, 12, -8, -6),
			k(0.45f, -0.14f, 0.04f, -0.42f, -12, 12, 4),
			k(0.62f, -0.14f, 0.03f, -0.4f, -12, 12, 4),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.35f));

	/** Karambit: hakende Boegen mit Drehung um den Ring. */
	public static final Anim HOOK_RIGHT = a("hook_r", 9, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.16f, 0.06f, 0.06f, 0.02f, 0, -20, -40),
			k(0.42f, -0.28f, -0.04f, -0.2f, -25, 40, 120),
			k(0.6f, -0.36f, -0.12f, -0.08f, -15, 55, 150),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.22f));

	public static final Anim HOOK_LEFT = a("hook_l", 9, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.16f, -0.2f, 0.08f, 0, 0, 30, 60),
			k(0.42f, 0.1f, -0.04f, -0.2f, -25, -40, -110),
			k(0.6f, 0.16f, -0.12f, -0.08f, -12, -55, -140),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.22f));

	/** Schattendolche: schnelle Faustschlaege nach vorne. */
	public static final Anim PUNCH_A = a("punch_a", 8, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.2f, 0.02f, -0.02f, 0.1f, 10, 0, 0),
			k(0.42f, -0.12f, 0.02f, -0.4f, -25, 10, -10),
			k(0.56f, -0.12f, 0.02f, -0.38f, -25, 10, -10),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.25f));

	public static final Anim PUNCH_B = a("punch_b", 8, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.2f, -0.05f, 0, 0.1f, 10, 0, 0),
			k(0.42f, -0.22f, -0.04f, -0.38f, -20, 20, 15),
			k(0.56f, -0.22f, -0.04f, -0.36f, -20, 20, 15),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.25f));

	/** Axt: Hieb von oben (Danger-Zone-Axt). */
	public static final Anim CHOP = a("chop", 11, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.3f, 0.04f, 0.22f, 0.12f, 50, -10, -12),
			k(0.5f, -0.08f, -0.16f, -0.32f, -70, 8, 12),
			k(0.66f, -0.08f, -0.18f, -0.3f, -72, 8, 12),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.4f));

	public static final Anim CHOP_DIAGONAL = a("chop_d", 11, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.3f, 0.12f, 0.2f, 0.1f, 40, -25, -35),
			k(0.5f, -0.2f, -0.14f, -0.3f, -60, 25, 35),
			k(0.66f, -0.22f, -0.16f, -0.28f, -62, 26, 36),
			k(1, 0, 0, 0, 0, 0, 0)}, swish(0.4f));

	/** Streitkolben: schwerer Hammerschlag mit langem Ausholen. */
	public static final Anim SMASH = a("smash", 14, new Key[]{
			k(0, 0, 0, 0, 0, 0, 0),
			k(0.35f, 0.02f, 0.3f, 0.16f, 65, -5, -8),
			k(0.55f, -0.06f, -0.22f, -0.34f, -80, 5, 8),
			k(0.62f, -0.06f, -0.2f, -0.33f, -76, 5, 8),
			k(0.72f, -0.06f, -0.24f, -0.33f, -82, 5, 8),
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
