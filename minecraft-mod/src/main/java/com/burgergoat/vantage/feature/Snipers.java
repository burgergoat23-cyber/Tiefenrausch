package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.skin.SkinCatalog;
import com.burgergoat.vantage.skin.SkinManager;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.CrossbowItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.sound.SoundEvent;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Hand;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;

/**
 * Scharfschuetzengewehre wie in CS2: AWP-Skin auf dem Bogen, SSG-08-Skin auf der Armbrust.
 * Bogen spannen = Anlegen und durchs Zielfernrohr schauen (mit Zoom), loslassen = Schuss mit Rueckstoss und
 * Repetieren. Armbrust laden = Verschluss hoch, zurueck, vor, runter. Alles nur Anzeige (Spielmechanik bleibt gleich).
 */
public final class Snipers {
	private static final int AIM_TICKS = 5;
	private static final int SCOPE_TICKS = 7;
	private static final int FIRE_TICKS = 30;
	private static final int SSG_FIRE_TICKS = 12;

	private static boolean wasUsing;
	private static int useTicks;
	private static int lastUseTicks;
	private static float aim, lastAim;
	private static int fireTime = -1;
	private static boolean fireAwp;
	private static boolean wasCharged;
	private static float scope, lastScope;
	private static int lastCue = -1;

	private Snipers() {
	}

	/** "awp", "ssg" oder null fuer diesen Gegenstand. */
	public static String kind(ItemStack stack) {
		if (stack == null || stack.isEmpty() || !(stack.isOf(Items.BOW) || stack.isOf(Items.CROSSBOW))) return null;
		SkinCatalog.Skin skin = SkinManager.skinFor(stack);
		if (skin == null) return null;
		String cat = skin.category().id;
		return "awp".equals(cat) || "ssg".equals(cat) ? cat : null;
	}

	private static ItemStack held(MinecraftClient mc) {
		return mc.player == null ? ItemStack.EMPTY : mc.player.getMainHandStack();
	}

	public static void tick(MinecraftClient mc) {
		lastAim = aim;
		lastScope = scope;
		ClientPlayerEntity p = mc.player;
		String k = p == null ? null : kind(held(mc));
		if (k == null) {
			wasUsing = false;
			useTicks = 0;
			aim = 0;
			scope = 0;
			fireTime = -1;
			wasCharged = false;
			return;
		}
		ItemStack stack = held(mc);
		boolean using = p.isUsingItem() && p.getActiveHand() == Hand.MAIN_HAND;
		lastUseTicks = useTicks;
		useTicks = using ? p.getItemUseTime() : 0;
		if ("awp".equals(k)) {
			if (wasUsing && !using && lastUseTicks >= 3) startFire(mc, true);
			float target = using ? Math.min(1f, useTicks / (float) AIM_TICKS) : 0f;
			aim += (target - aim) * 0.6f;
			boolean sc = using && useTicks >= SCOPE_TICKS;
			if (sc && scope < 0.5f) play(mc, SoundEvents.UI_BUTTON_CLICK.value(), 2f, 0.4f);
			scope = sc ? 1f : 0f;
		} else {
			aim = 0;
			scope = 0;
			boolean charged = CrossbowItem.isCharged(stack);
			if (wasCharged && !charged) startFire(mc, false);
			wasCharged = charged;
			if (using) reloadCues(mc);
			else lastCue = -1;
		}
		wasUsing = using;
		if (fireTime >= 0) {
			fireTime++;
			if (fireAwp) boltCues(mc, fireTime);
			if (fireTime > (fireAwp ? FIRE_TICKS : SSG_FIRE_TICKS)) fireTime = -1;
		}
	}

	private static void startFire(MinecraftClient mc, boolean awp) {
		fireTime = 0;
		fireAwp = awp;
		lastCue = -1;
		play(mc, SoundEvents.ENTITY_FIREWORK_ROCKET_LARGE_BLAST, awp ? 0.55f : 0.75f, 0.9f);
		play(mc, SoundEvents.ENTITY_FIREWORK_ROCKET_BLAST, awp ? 0.5f : 0.7f, 0.7f);
	}

	private static void play(MinecraftClient mc, SoundEvent s, float pitch, float vol) {
		mc.getSoundManager().play(PositionedSoundInstance.ui(s, pitch, vol));
	}

	/** Klick-Geraeusche beim Repetieren nach dem AWP-Schuss. */
	private static void boltCues(MinecraftClient mc, int t) {
		int cue = t >= 22 ? 3 : t >= 17 ? 2 : t >= 11 ? 1 : t >= 7 ? 0 : -1;
		if (cue <= lastCue) return;
		lastCue = cue;
		cueSound(mc, cue);
	}

	/** Klick-Geraeusche beim Laden der SSG (Armbrust spannen). */
	private static void reloadCues(MinecraftClient mc) {
		float p = reloadProgress();
		int cue = p >= 0.8f ? 3 : p >= 0.62f ? 2 : p >= 0.32f ? 1 : p >= 0.16f ? 0 : -1;
		if (cue <= lastCue) return;
		lastCue = cue;
		cueSound(mc, cue);
	}

	private static void cueSound(MinecraftClient mc, int cue) {
		switch (cue) {
			case 0 -> play(mc, SoundEvents.BLOCK_IRON_TRAPDOOR_OPEN, 1.7f, 0.5f);
			case 1 -> play(mc, SoundEvents.BLOCK_PISTON_CONTRACT, 2f, 0.35f);
			case 2 -> play(mc, SoundEvents.BLOCK_PISTON_EXTEND, 2f, 0.35f);
			default -> play(mc, SoundEvents.BLOCK_IRON_TRAPDOOR_CLOSE, 1.8f, 0.5f);
		}
	}

	private static float reloadProgress() {
		return MathHelper.clamp(useTicks / 25f, 0f, 1f);
	}

	// ------------------------------------------------------------------ fuer Modelle, Kamera und Hand

	/** Endung fuer das Modell mit offenem Verschluss: "", "_up" oder "_back". */
	public static String boltSuffix() {
		MinecraftClient mc = MinecraftClient.getInstance();
		String k = kind(held(mc));
		if (k == null) return "";
		if (fireTime >= 0 && fireAwp) {
			int t = fireTime;
			if (t >= 7 && t < 11) return "_up";
			if (t >= 11 && t < 17) return "_back";
			if (t >= 17 && t < 22) return "_up";
			return "";
		}
		if ("ssg".equals(k) && useTicks > 0) {
			float p = reloadProgress();
			if (p >= 0.16f && p < 0.32f) return "_up";
			if (p >= 0.32f && p < 0.62f) return "_back";
			if (p >= 0.62f && p < 0.8f) return "_up";
		}
		return "";
	}

	/** Durchs Zielfernrohr schauen (AWP gespannt). */
	public static boolean scoped() {
		return scope > 0.5f;
	}

	public static float zoomTarget() {
		return scoped() ? 4f : 1f;
	}

	/** Die normale Bogen-/Armbrust-Haltung von Minecraft fuer die Gewehre ausschalten. */
	public static boolean overrideVanilla(ItemStack stack) {
		return kind(stack) != null;
	}

	/** Bewegung des Gewehrs (Anlegen, Rueckstoss, Nachladen) direkt vor dem Zeichnen. */
	public static void apply(MatrixStack m, ItemStack stack, int sd, float tickProgress) {
		String k = kind(stack);
		if (k == null || stack != held(MinecraftClient.getInstance())) return;
		float a = MathHelper.lerp(tickProgress, lastAim, aim);
		if (a > 0) {
			// Zur Bildmitte und naeher ans Auge (Anlegen)
			m.translate(-sd * 0.5f * a, 0.1f * a, 0.12f * a);
		}
		if (fireTime >= 0) {
			float t = fireTime + tickProgress;
			int len = fireAwp ? FIRE_TICKS : SSG_FIRE_TICKS;
			float kick = t < 2 ? t / 2f : Math.max(0f, 1f - (t - 2) / 6f);
			m.translate(0, 0.03f * kick, 0.14f * kick);
			m.multiply(RotationAxis.POSITIVE_X.rotationDegrees(10f * kick));
			if (fireAwp && t > 6 && t < len) {
				// Repetieren: Gewehr leicht zur Seite kippen
				float s = MathHelper.sin((t - 6) / (len - 6) * MathHelper.PI);
				m.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(sd * 18f * s));
				m.translate(-sd * 0.04f * s, -0.04f * s, 0);
			}
		}
		if ("ssg".equals(k) && useTicks > 0) {
			// Laden: Gewehr kippt zur Seite, Verschluss arbeitet
			float p = reloadProgress();
			float s = MathHelper.sin(Math.min(1f, p * 1.15f) * MathHelper.PI);
			m.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(sd * 24f * s));
			m.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-6f * s));
			m.translate(-sd * 0.06f * s, -0.05f * s, 0);
		}
	}

	/** Schwarzer Rand mit Fadenkreuz wie beim AWP-Zielfernrohr. */
	public static void renderScope(DrawContext ctx, RenderTickCounter tick) {
		if (!scoped() || !MinecraftClient.getInstance().options.getPerspective().isFirstPerson()) return;
		int w = ctx.getScaledWindowWidth();
		int h = ctx.getScaledWindowHeight();
		int cx = w / 2;
		int cy = h / 2;
		int r = Math.round(Math.min(w, h) * 0.47f);
		int black = 0xFF000000;
		ctx.fill(0, 0, w, Math.max(0, cy - r), black);
		ctx.fill(0, cy + r, w, h, black);
		for (int y = cy - r; y < cy + r; y++) {
			float dy = y + 0.5f - cy;
			int half = (int) Math.sqrt(Math.max(0f, r * r - dy * dy));
			ctx.fill(0, y, cx - half, y + 1, black);
			ctx.fill(cx + half, y, w, y + 1, black);
			// dunkler Rand innen
			int edge = Math.max(1, r / 40);
			ctx.fill(cx - half, y, cx - half + edge, y + 1, 0x90000000);
			ctx.fill(cx + half - edge, y, cx + half, y + 1, 0x90000000);
		}
		// feines Fadenkreuz quer durch das ganze Glas
		ctx.fill(cx - r, cy, cx + r, cy + 1, 0xE0000000);
		ctx.fill(cx, cy - r, cx + 1, cy + r, 0xE0000000);
	}
}
