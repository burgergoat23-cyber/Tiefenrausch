package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.CameraControl;
import com.burgergoat.vantage.feature.Macros;
import com.burgergoat.vantage.feature.Viewmodel;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Minecraft.class)
public abstract class MinecraftClientMixin {
	/** Vor jedem Linksklick-Angriff: Attribut-Swap (Streitkolben) bzw. Schild-Brecher. */
	@Inject(method = "startAttack", at = @At("HEAD"), cancellable = true)
	private void vantage$beforeAttack(CallbackInfoReturnable<Boolean> cir) {
		// In der Freecam wird nicht geschlagen
		if (CameraControl.freeCam()) {
			cir.setReturnValue(false);
			return;
		}
		Macros.beforeAttack((Minecraft) (Object) this);
	}

	@Inject(method = "startUseItem", at = @At("HEAD"), cancellable = true)
	private void vantage$noUseInFreeCam(CallbackInfo ci) {
		if (CameraControl.freeCam()) ci.cancel();
	}

	@Inject(method = "continueAttack", at = @At("HEAD"), cancellable = true)
	private void vantage$noBreakInFreeCam(boolean breaking, CallbackInfo ci) {
		if (CameraControl.freeCam()) ci.cancel();
	}

	/** Nach dem Angriff: Schlaganimation wie in CS (nur wenn wirklich geschwungen wurde). */
	@Inject(method = "startAttack", at = @At("RETURN"))
	private void vantage$afterAttack(CallbackInfoReturnable<Boolean> cir) {
		Viewmodel.afterAttack((Minecraft) (Object) this);
	}
}
