package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.anim.KnifeAnimations;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.skin.SkinCatalog;
import com.burgergoat.vantage.skin.SkinManager;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.Registries;
import net.minecraft.registry.tag.ItemTags;
import net.minecraft.sound.SoundEvent;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Arm;
import net.minecraft.util.Hand;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;

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

	/** Welche Animationen: Messerform, sonst Skin-Art (evtl. mit Form) oder Art des Gegenstands. */
	private static String animKey(ItemStack stack) {
		if (stack.isEmpty()) return null;
		SkinCatalog.Skin skin = SkinManager.skinFor(stack);
		if (skin != null) {
			String cat = skin.category().id;
			if ("awp".equals(cat) || "ssg".equals(cat)) return null;
			if ("knife".equals(cat) && skin.shape() != null) return skin.shape().id();
			if (skin.shape() != null && KnifeAnimations.has(cat + ":" + skin.shape().id())) return cat + ":" + skin.shape().id();
			return cat;
		}
		if (stack.isIn(ItemTags.SWORDS)) return "sword";
		if (stack.isIn(ItemTags.AXES)) return "axe";
		if (stack.isOf(Items.MACE)) return "mace";
		if (stack.isOf(Items.ENDER_PEARL)) return "grenade";
		if (stack.isOf(Items.WIND_CHARGE)) return "wind";
		if (stack.isOf(Items.TOTEM_OF_UNDYING)) return "totem";
		if (stack.isOf(Items.SHIELD)) return "shield";
		if (Registries.ITEM.getId(stack.getItem()).getPath().endsWith("_spear")) return "spear";
		return null;
	}

	public static void startInspect(MinecraftClient client) {
		if (!VantageConfig.get().inspect || client.player == null) return;
		ItemStack held = client.player.getMainHandStack();
		if (held.isEmpty()) return;
		String key = animKey(held);
		start(client, key == null ? KnifeAnimations.INSPECT_LOOK : KnifeAnimations.inspect(key), Kind.INSPECT);
	}

	public static void playDraw(MinecraftClient client) {
		if (client.player == null) return;
		String key = animKey(client.player.getMainHandStack());
		start(client, key == null ? KnifeAnimations.DRAW_RAISE : KnifeAnimations.draw(key), Kind.DRAW);
	}

	/**
	 * Nach jedem Linksklick-Angriff (MinecraftClient.doAttack): Schlaganimation wie in CS.
	 * Nur wenn das Spiel wirklich gerade einen Schwung gestartet hat.
	 */
	public static void afterAttack(MinecraftClient client) {
		ClientPlayerEntity p = client.player;
		if (p == null || !VantageConfig.get().swingAnim) return;
		if (!p.handSwinging || p.handSwingTicks >= 0 || p.preferredHand != Hand.MAIN_HAND) return;
		ItemStack held = p.getMainHandStack();
		int type;
		if (held.isIn(ItemTags.SWORDS)) type = 0;
		else if (held.isIn(ItemTags.AXES)) type = 1;
		else if (held.isOf(Items.MACE)) type = 2;
		else return;
		// Schwerer Stich wie mit der rechten Maustaste in CS: bei einem kritischen Treffer (im Fallen)
		boolean heavy = p.fallDistance > 0 && !p.isOnGround() && !p.isClimbing() && !p.isTouchingWater() && !p.isSprinting();
		altSwing = !altSwing;
		start(client, KnifeAnimations.swing(type, knifeShape(held), altSwing, heavy), Kind.SWING);
	}

	private static void start(MinecraftClient client, KnifeAnimations.Anim a, Kind k) {
		anim = a;
		kind = k;
		animTime = 0f;
		lastAnimTime = 0f;
		cueIndex = 0;
		animSlot = client.player.getInventory().getSelectedSlot();
	}

	/** Nur fuer den automatischen Test: zeigt eine Animation an der Stelle t (0..1) als Standbild. */
	public static void freeze(MinecraftClient client, KnifeAnimations.Anim a, float t) {
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

	public static void tick(MinecraftClient client) {
		if (frozen >= 0) return;
		if (client.player == null) {
			stop();
			lastSlot = -1;
			lastItem = null;
			return;
		}
		VantageConfig c = VantageConfig.get();
		int slot = client.player.getInventory().getSelectedSlot();
		ItemStack held = client.player.getMainHandStack();
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
				String key = animKey(held);
				if (key != null && c.drawAnim && !Macros.isBusyOrJustDone()) start(client, KnifeAnimations.draw(key), Kind.DRAW);
			}
		}
		if (anim == null) return;
		lastAnimTime = animTime;
		// Schlaege immer in Echtzeit (passend zur Angriffs-Abklingzeit), Ziehen/Inspect mit eigenem Tempo
		animTime += kind == Kind.SWING ? 1f : Math.max(0.25f, c.animSpeed);
		boolean interrupted = slot != animSlot
				|| (kind == Kind.INSPECT && (client.options.attackKey.isPressed() || client.options.useKey.isPressed()));
		playCues(client);
		if (animTime >= anim.ticks() || interrupted) stop();
	}

	private static void playCues(MinecraftClient client) {
		if (!VantageConfig.get().knifeSounds) return;
		KnifeAnimations.Cue[] cues = anim.cues();
		float t = animTime / anim.ticks();
		while (cueIndex < cues.length && cues[cueIndex].t() <= t) {
			SoundEvent s = cues[cueIndex].sound() == 0 ? SoundEvents.ENTITY_PLAYER_ATTACK_SWEEP : SoundEvents.BLOCK_TRIPWIRE_CLICK_ON;
			float pitch = cues[cueIndex].sound() == 0 ? 1.75f + client.player.getRandom().nextFloat() * 0.2f : 1.9f;
			client.getSoundManager().play(PositionedSoundInstance.ui(s, pitch, cues[cueIndex].sound() == 0 ? 0.18f : 0.35f));
			cueIndex++;
		}
	}

	// ------------------------------------------------------------------ Zeichnen

	private static int side(Hand hand) {
		MinecraftClient mc = MinecraftClient.getInstance();
		Arm arm = mc.player == null ? Arm.RIGHT : mc.player.getMainArm();
		if (hand == Hand.OFF_HAND) arm = arm.getOpposite();
		return arm == Arm.RIGHT ? 1 : -1;
	}

	private static boolean useOff(Hand hand) {
		return hand == Hand.OFF_HAND && VantageConfig.get().vmOffSeparate;
	}

	/** Nach matrices.push(): Position der ganzen Hand (mit Arm). */
	public static void applyOffset(MatrixStack matrices, Hand hand) {
		VantageConfig c = VantageConfig.get();
		boolean off = useOff(hand);
		float x = off ? c.vmOffX : c.vmX;
		float y = off ? c.vmOffY : c.vmY;
		float z = off ? c.vmOffZ : c.vmZ;
		if (x == 0 && y == 0 && z == 0) return;
		matrices.translate(side(hand) * x * 0.5f, y * 0.5f, z * 0.5f);
	}

	/** Direkt vor dem Zeichnen des Items: Drehung, Groesse und Animation. */
	public static void applyItem(MatrixStack matrices, Hand hand, ItemStack item, float tickProgress) {
		VantageConfig c = VantageConfig.get();
		boolean off = useOff(hand);
		int sd = side(hand);
		float rx = off ? c.vmOffRotX : c.vmRotX;
		float ry = off ? c.vmOffRotY : c.vmRotY;
		float rz = off ? c.vmOffRotZ : c.vmRotZ;
		float scale = off ? c.vmOffScale : c.vmScale;
		if (rx != 0) matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(rx));
		if (ry != 0) matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(sd * ry));
		if (rz != 0) matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(sd * rz));
		if (scale != 1f) {
			float s = MathHelper.clamp(scale, 0.2f, 2f);
			matrices.scale(s, s, s);
		}
		if (hand == Hand.MAIN_HAND) Snipers.apply(matrices, item, sd, tickProgress);
		if (anim == null || hand != Hand.MAIN_HAND) return;
		float time = frozen >= 0 ? frozen * anim.ticks() : MathHelper.lerp(tickProgress, lastAnimTime, animTime);
		float[] v = anim.sample(MathHelper.clamp(time / anim.ticks(), 0f, 1f));
		matrices.translate(sd * v[0], v[1], v[2]);
		matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(sd * v[4]));
		matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(v[3]));
		matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(sd * v[5]));
	}

	/** Waehrend der Zieh-Animation soll das Item nicht zusaetzlich von unten hochfahren. */
	public static float equipProgress(Hand hand, float original) {
		return hand == Hand.MAIN_HAND && (drawing() || swinging()) ? 0f : original;
	}

	/** Waehrend der eigenen Schlaganimation den normalen Minecraft-Schwung ausblenden. */
	public static float swingProgress(Hand hand, float original) {
		return hand == Hand.MAIN_HAND && swinging() ? 0f : original;
	}
}
