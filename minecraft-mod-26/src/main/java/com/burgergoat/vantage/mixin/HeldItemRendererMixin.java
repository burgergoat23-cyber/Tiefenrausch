package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.Viewmodel;
import com.llamalad7.mixinextras.sugar.Local;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.ItemInHandRenderer;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Viewmodel (Position/Groesse der Hand) und Inspect-Animation in der Ich-Perspektive. */
@Mixin(ItemInHandRenderer.class)
public abstract class HeldItemRendererMixin {
	/** Waehrend der Zieh-Animation (Messer) kein zusaetzliches Hochfahren von unten. */
	@ModifyVariable(method = "submitArmWithItem", at = @At("HEAD"), argsOnly = true, ordinal = 3)
	private float vantage$equipProgress(float equipProgress, @Local(argsOnly = true) InteractionHand hand) {
		return Viewmodel.equipProgress(hand, equipProgress);
	}

	/** Eigene Schlaganimation (CS) statt des normalen Schwungs. */
	@ModifyVariable(method = "submitArmWithItem", at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private float vantage$swingProgress(float swingProgress, @Local(argsOnly = true) InteractionHand hand) {
		return Viewmodel.swingProgress(hand, swingProgress);
	}

	@Inject(method = "submitArmWithItem", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;pushPose()V", shift = At.Shift.AFTER, ordinal = 0))
	private void vantage$viewmodelOffset(AbstractClientPlayer player, float tickProgress, float pitch, InteractionHand hand, float swingProgress,
			ItemStack item, float equipProgress, PoseStack matrices, SubmitNodeCollector queue, int light, CallbackInfo ci) {
		Viewmodel.applyOffset(matrices, hand);
	}

	@Inject(method = "submitArmWithItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/ItemInHandRenderer;renderItem(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/item/ItemDisplayContext;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;I)V"))
	private void vantage$inspect(AbstractClientPlayer player, float tickProgress, float pitch, InteractionHand hand, float swingProgress,
			ItemStack item, float equipProgress, PoseStack matrices, SubmitNodeCollector queue, int light, CallbackInfo ci) {
		Viewmodel.applyItem(matrices, hand, item, tickProgress);
	}
}
