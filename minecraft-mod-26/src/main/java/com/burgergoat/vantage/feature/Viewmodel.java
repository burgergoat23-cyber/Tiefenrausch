package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.anim.KnifeAnimations;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.skin.SkinCatalog;
import com.burgergoat.vantage.skin.SkinManager;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.tags.ItemTags;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

/**
 * Viewmodel wie in CS: Hand verschieben, drehen und skalieren (rechte und linke Hand),
 * dazu Zieh-, Inspect- und Schlaganimationen je Messer (und fuer Axt und Streitkolben).
 */
public final class Viewmodel {
	private enum Kind {
		DRAW, INSPECT, SWING
	}

	private static KnifeAnimations.Anim anim;
	private static Kind kind;
	/** Abwechselnd Vorhand/Rueckhand wie in CS */
	private static boolean altSwing;
	private static float animTime = -1f;
	private static float lastAnimTime = -1f;
	private static int animSlot = -1;
	private static int lastSlot = -1;
	private static Item lastItem;
	private static int cueIndex;
	/** Nur fuer den automatischen Test: Animation an einer festen Stelle (0..1) anhalten. */
	private static float frozen = -1f;

	private Viewmodel() {
	}

	// ------------------------------------------------------------------ Steuerung

	private static String knifeShape(ItemStack stack) {
		SkinCatalog.Skin skin = SkinManager.skinFor(stack);
		if (skin != null && skin.shape() != null) return skin.shape().id();
		return null;
	}

	public static void startInspect(Minecraft client) {
		if (!VantageConfig.get().inspect || client.player == null) return;
		ItemStack held = client.player.getMainHandItem();
		if (held.isEmpty()) return;
		String shape = knifeShape(held);
		start(client, shape == null ? KnifeAnimations.INSPECT_LOOK : KnifeAnimations.inspect(shape), Kind.INSPECT);
	}

	public static void playDraw(Minecraft client) {
		if (client.player == null) return;
		String shape = knifeShape(client.player.getMainHandItem());
		start(client, shape == null ? KnifeAnimations.DRAW_RAISE : KnifeAnimations.draw(shape), Kind.DRAW);
	}

	/**
	 * Nach jedem Linksklick-Angriff (MinecraftClient.doAttack): Schlaganimation wie in CS.
	 * Nur wenn das Spiel wirklich gerade einen Schwung gestartet hat.
	 */
	public static void afterAttack(Minecraft client) {
		LocalPlayer p = client.player;
		if (p == null || !VantageConfig.get().swingAnim) return;
		if (!p.swinging || p.swingTime >= 0 || p.swingingArm != InteractionHand.MAIN_HAND) return;
		ItemStack held = p.getMainHandItem();
		int type;
		if (held.is(ItemTags.SWORDS)) type = 0;
		else if (held.is(ItemTags.AXES)) type = 1;
		else if (held.is(Items.MACE)) type = 2;
		else return;
		// Schwerer Stich wie mit der rechten Maustaste in CS: bei einem kritischen Treffer (im Fallen)
		boolean heavy = p.fallDistance > 0 && !p.onGround() && !p.onClimbable() && !p.isInWater() && !p.isSprinting();
		altSwing = !altSwing;
		start(client, KnifeAnimations.swing(type, knifeShape(held), altSwing, heavy), Kind.SWING);
	}

	private static void start(Minecraft client, KnifeAnimations.Anim a, Kind k) {
		anim = a;
		kind = k;
		animTime = 0f;
		lastAnimTime = 0f;
		cueIndex = 0;
		animSlot = client.player.getInventory().getSelectedSlot();
	}

	/** Nur fuer den automatischen Test: zeigt eine Animation an der Stelle t (0..1) als Standbild. */
	public static void freeze(Minecraft client, KnifeAnimations.Anim a, float t) {
		start(client, a, Kind.SWING);
		frozen = t;
	}

	public static void stop() {
		frozen = -1f;
		anim = null;
		animTime = -1f;
		lastAnimTime = -1f;
	}

	public static boolean inspecting() {
		return anim != null && kind == Kind.INSPECT;
	}

	public static boolean drawing() {
		return anim != null && kind == Kind.DRAW;
	}

	public static boolean swinging() {
		return anim != null && kind == Kind.SWING;
	}

	public static void tick(Minecraft client) {
		if (frozen >= 0) return;
		if (client.player == null) {
			stop();
			lastSlot = -1;
			lastItem = null;
			return;
		}
		VantageConfig c = VantageConfig.get();
		int slot = client.player.getInventory().getSelectedSlot();
		ItemStack held = client.player.getMainHandItem();
		Item item = held.isEmpty() ? null : held.getItem();
		boolean changed = lastSlot != -1 && (slot != lastSlot || item != lastItem);
		lastSlot = slot;
		lastItem = item;
		if (changed) {
			if (swinging() && Macros.isBusyOrJustDone()) {
				// Attribut-Swap: Schlag laeuft mit der Waffe weiter, die gerade getauscht wurde
				animSlot = slot;
			} else {
				stop();
				String shape = knifeShape(held);
				if (shape != null && c.drawAnim && !Macros.isBusyOrJustDone()) start(client, KnifeAnimations.draw(shape), Kind.DRAW);
			}
		}
		if (anim == null) return;
		lastAnimTime = animTime;
		// Schlaege immer in Echtzeit (passend zur Angriffs-Abklingzeit), Ziehen/Inspect mit eigenem Tempo
		animTime += kind == Kind.SWING ? 1f : Math.max(0.25f, c.animSpeed);
		boolean interrupted = slot != animSlot
				|| (kind == Kind.INSPECT && (client.options.keyAttack.isDown() || client.options.keyUse.isDown()));
		playCues(client);
		if (animTime >= anim.ticks() || interrupted) stop();
	}

	private static void playCues(Minecraft client) {
		if (!VantageConfig.get().knifeSounds) return;
		KnifeAnimations.Cue[] cues = anim.cues();
		float t = animTime / anim.ticks();
		while (cueIndex < cues.length && cues[cueIndex].t() <= t) {
			SoundEvent s = cues[cueIndex].sound() == 0 ? SoundEvents.PLAYER_ATTACK_SWEEP : SoundEvents.TRIPWIRE_CLICK_ON;
			float pitch = cues[cueIndex].sound() == 0 ? 1.75f + client.player.getRandom().nextFloat() * 0.2f : 1.9f;
			client.getSoundManager().play(SimpleSoundInstance.forUI(s, pitch, cues[cueIndex].sound() == 0 ? 0.18f : 0.35f));
			cueIndex++;
		}
	}

	// ------------------------------------------------------------------ Zeichnen

	private static int side(InteractionHand hand) {
		Minecraft mc = Minecraft.getInstance();
		HumanoidArm arm = mc.player == null ? HumanoidArm.RIGHT : mc.player.getMainArm();
		if (hand == InteractionHand.OFF_HAND) arm = arm.getOpposite();
		return arm == HumanoidArm.RIGHT ? 1 : -1;
	}

	private static boolean useOff(InteractionHand hand) {
		return hand == InteractionHand.OFF_HAND && VantageConfig.get().vmOffSeparate;
	}

	/** Nach matrices.push(): Position der ganzen Hand (mit Arm). */
	public static void applyOffset(PoseStack matrices, InteractionHand hand) {
		VantageConfig c = VantageConfig.get();
		boolean off = useOff(hand);
		float x = off ? c.vmOffX : c.vmX;
		float y = off ? c.vmOffY : c.vmY;
		float z = off ? c.vmOffZ : c.vmZ;
		if (x == 0 && y == 0 && z == 0) return;
		matrices.translate(side(hand) * x * 0.5f, y * 0.5f, z * 0.5f);
	}

	/** Direkt vor dem Zeichnen des Items: Drehung, Groesse und Animation. */
	public static void applyItem(PoseStack matrices, InteractionHand hand, ItemStack item, float tickProgress) {
		VantageConfig c = VantageConfig.get();
		boolean off = useOff(hand);
		int sd = side(hand);
		float rx = off ? c.vmOffRotX : c.vmRotX;
		float ry = off ? c.vmOffRotY : c.vmRotY;
		float rz = off ? c.vmOffRotZ : c.vmRotZ;
		float scale = off ? c.vmOffScale : c.vmScale;
		if (rx != 0) matrices.mulPose(Axis.XP.rotationDegrees(rx));
		if (ry != 0) matrices.mulPose(Axis.YP.rotationDegrees(sd * ry));
		if (rz != 0) matrices.mulPose(Axis.ZP.rotationDegrees(sd * rz));
		if (scale != 1f) {
			float s = Mth.clamp(scale, 0.2f, 2f);
			matrices.scale(s, s, s);
		}
		if (hand == InteractionHand.MAIN_HAND) Snipers.apply(matrices, item, sd, tickProgress);
		if (anim == null || hand != InteractionHand.MAIN_HAND) return;
		float time = frozen >= 0 ? frozen * anim.ticks() : Mth.lerp(tickProgress, lastAnimTime, animTime);
		float[] v = anim.sample(Mth.clamp(time / anim.ticks(), 0f, 1f));
		matrices.translate(sd * v[0], v[1], v[2]);
		matrices.mulPose(Axis.YP.rotationDegrees(sd * v[4]));
		matrices.mulPose(Axis.XP.rotationDegrees(v[3]));
		matrices.mulPose(Axis.ZP.rotationDegrees(sd * v[5]));
	}

	/** Waehrend der Zieh-Animation soll das Item nicht zusaetzlich von unten hochfahren. */
	public static float equipProgress(InteractionHand hand, float original) {
		return hand == InteractionHand.MAIN_HAND && (drawing() || swinging()) ? 0f : original;
	}

	/** Waehrend der eigenen Schlaganimation den normalen Minecraft-Schwung ausblenden. */
	public static float swingProgress(InteractionHand hand, float original) {
		return hand == InteractionHand.MAIN_HAND && swinging() ? 0f : original;
	}
}
