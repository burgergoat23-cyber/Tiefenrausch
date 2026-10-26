package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import net.minecraft.block.Blocks;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LightningEntity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.particle.BlockStateParticleEffect;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.math.Vec3d;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Random;

/**
 * Kill-Effekte: Stirbt ein Gegner, den du kurz vorher getroffen hast, gibt es einen Effekt an seiner Stelle
 * (Blitz, Blut, Feuerwerk oder Seelen). Alles nur auf deinem Bildschirm.
 */
public final class KillEffects {
	public static final String[] NAMES = {"Blitz", "Blut", "Feuerwerk", "Seelen"};
	private static final Map<Integer, Long> HIT = new HashMap<>();
	private static final Random RANDOM = new Random();

	private KillEffects() {
	}

	/** Linksklick auf ein Ziel (AttackEntityCallback). */
	public static void onAttack(Entity target) {
		if (target instanceof LivingEntity) HIT.put(target.getId(), System.currentTimeMillis());
	}

	public static void tick(MinecraftClient mc) {
		if (mc.world == null || HIT.isEmpty()) return;
		long now = System.currentTimeMillis();
		for (Iterator<Map.Entry<Integer, Long>> it = HIT.entrySet().iterator(); it.hasNext(); ) {
			Map.Entry<Integer, Long> e = it.next();
			if (now - e.getValue() > 3000) {
				it.remove();
				continue;
			}
			Entity ent = mc.world.getEntityById(e.getKey());
			if (ent instanceof LivingEntity le && le.isDead()) {
				it.remove();
				if (VantageConfig.get().killEffects) play(mc, new Vec3d(le.getX(), le.getY() + le.getHeight() / 2, le.getZ()), VantageConfig.get().killEffect);
			}
		}
	}

	/** Den Effekt an einer Stelle abspielen (auch fuer die Vorschau im Menue). */
	public static void play(MinecraftClient mc, Vec3d pos, int kind) {
		ClientWorld w = mc.world;
		if (w == null) return;
		boolean sound = VantageConfig.get().killSound;
		switch (kind) {
			case 1 -> {
				var blood = new BlockStateParticleEffect(ParticleTypes.BLOCK, Blocks.REDSTONE_BLOCK.getDefaultState());
				for (int i = 0; i < 60; i++) {
					w.addParticleClient(blood, true, true, pos.x + gauss(0.3), pos.y + gauss(0.4), pos.z + gauss(0.3), gauss(0.3), RANDOM.nextDouble() * 0.4, gauss(0.3));
				}
				if (sound) w.playSoundClient(pos.x, pos.y, pos.z, SoundEvents.ENTITY_PLAYER_ATTACK_CRIT, SoundCategory.PLAYERS, 1f, 0.7f, false);
			}
			case 2 -> {
				for (int i = 0; i < 70; i++) {
					w.addParticleClient(ParticleTypes.FIREWORK, true, true, pos.x, pos.y + 0.5, pos.z, gauss(0.25), gauss(0.25) + 0.1, gauss(0.25));
				}
				for (int i = 0; i < 20; i++) {
					w.addParticleClient(ParticleTypes.END_ROD, true, true, pos.x, pos.y + 0.5, pos.z, gauss(0.15), gauss(0.15) + 0.05, gauss(0.15));
				}
				if (sound) w.playSoundClient(pos.x, pos.y, pos.z, SoundEvents.ENTITY_FIREWORK_ROCKET_TWINKLE, SoundCategory.PLAYERS, 1f, 1f, false);
			}
			case 3 -> {
				for (int i = 0; i < 40; i++) {
					w.addParticleClient(ParticleTypes.SOUL, true, true, pos.x + gauss(0.4), pos.y + gauss(0.5), pos.z + gauss(0.4), gauss(0.02), 0.05 + RANDOM.nextDouble() * 0.08, gauss(0.02));
				}
				for (int i = 0; i < 20; i++) {
					w.addParticleClient(ParticleTypes.SOUL_FIRE_FLAME, true, true, pos.x + gauss(0.3), pos.y + gauss(0.4), pos.z + gauss(0.3), 0, 0.04, 0);
				}
				if (sound) w.playSoundClient(pos.x, pos.y, pos.z, SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP, SoundCategory.PLAYERS, 1f, 0.6f, false);
			}
			default -> {
				// Blitz nur zum Anschauen: kein Feuer, kein Schaden (nur auf deinem Bildschirm)
				LightningEntity bolt = new LightningEntity(EntityType.LIGHTNING_BOLT, w);
				bolt.refreshPositionAfterTeleport(new Vec3d(pos.x, pos.y - 1, pos.z));
				bolt.setCosmetic(true);
				if (!sound) bolt.setSilent(true);
				w.addEntity(bolt);
			}
		}
	}

	private static double gauss(double s) {
		return RANDOM.nextGaussian() * s;
	}
}
