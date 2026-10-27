package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.CameraControl;
import com.burgergoat.vantage.feature.Snipers;
import com.burgergoat.vantage.feature.Viewmodel;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.item.HeldItemRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.item.consume.UseAction;
import net.minecraft.util.Hand;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Viewmodel (Position/Groesse der Hand) und Inspect-Animation in der Ich-Perspektive. */
@Mixin(HeldItemRenderer.class)
public abstract class HeldItemRendererMixin {
	/** In der Freecam keine Hand vor der Kamera. */
	@Inject(method = "renderItem(FLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;Lnet/minecraft/client/network/ClientPlayerEntity;I)V",
			at = @At("HEAD"), cancellable = true)
	private void vantage$hideHands(CallbackInfo ci) {
		if (CameraControl.freeCam()) ci.cancel();
	}

	/** Waehrend der Zieh-Animation (Messer) kein zusaetzliches Hochfahren von unten. */
	@ModifyVariable(method = "renderFirstPersonItem", at = @At("HEAD"), argsOnly = true, ordinal = 3)
	private float vantage$equipProgress(float equipProgress, @Local(argsOnly = true) Hand hand) {
		return Viewmodel.equipProgress(hand, equipProgress);
	}

	/** Eigene Schlaganimation (CS) statt des normalen Schwungs. */
	@ModifyVariable(method = "renderFirstPersonItem", at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private float vantage$swingProgress(float swingProgress, @Local(argsOnly = true) Hand hand) {
		return Viewmodel.swingProgress(hand, swingProgress);
	}

	@Inject(method = "renderFirstPersonItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/util/math/MatrixStack;push()V", shift = At.Shift.AFTER, ordinal = 0))
	private void vantage$viewmodelOffset(AbstractClientPlayerEntity player, float tickProgress, float pitch, Hand hand, float swingProgress,
			ItemStack item, float equipProgress, MatrixStack matrices, OrderedRenderCommandQueue queue, int light, CallbackInfo ci) {
		Viewmodel.applyOffset(matrices, hand);
	}

	@Inject(method = "renderFirstPersonItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/item/HeldItemRenderer;renderItem(Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/item/ItemStack;Lnet/minecraft/item/ItemDisplayContext;Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;I)V"))
	private void vantage$inspect(AbstractClientPlayerEntity player, float tickProgress, float pitch, Hand hand, float swingProgress,
			ItemStack item, float equipProgress, MatrixStack matrices, OrderedRenderCommandQueue queue, int light, CallbackInfo ci) {
		Viewmodel.applyItem(matrices, hand, item, tickProgress);
	}

	/** Durchs Zielfernrohr (AWP): Gewehr und Hand ausblenden wie in CS. */
	@Inject(method = "renderFirstPersonItem", at = @At("HEAD"), cancellable = true)
	private void vantage$scopeHide(AbstractClientPlayerEntity player, float tickProgress, float pitch, Hand hand, float swingProgress,
			ItemStack item, float equipProgress, MatrixStack matrices, OrderedRenderCommandQueue queue, int light, CallbackInfo ci) {
		if (hand == Hand.MAIN_HAND && Snipers.scoped() && Snipers.kind(item) != null) ci.cancel();
	}

	/** Gewehr-Skins: keine Armbrust-Sonderhaltung von Minecraft. */
	@WrapOperation(method = "renderFirstPersonItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/item/ItemStack;isOf(Lnet/minecraft/item/Item;)Z"), require = 0)
	private boolean vantage$noCrossbowPose(ItemStack stack, Item item, Operation<Boolean> original) {
		if (item == Items.CROSSBOW && Snipers.overrideVanilla(stack)) return false;
		return original.call(stack, item);
	}

	/** Gewehr-Skins: kein Bogen-Zittern, die eigene Anlege-Animation uebernimmt. */
	@WrapOperation(method = "renderFirstPersonItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/item/ItemStack;getUseAction()Lnet/minecraft/item/consume/UseAction;"), require = 0)
	private UseAction vantage$noBowPose(ItemStack stack, Operation<UseAction> original) {
		return Snipers.overrideVanilla(stack) ? UseAction.NONE : original.call(stack);
	}
}
