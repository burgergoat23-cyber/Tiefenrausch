package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.Zoom;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zoom: in 26.2 rechnet die Kamera das Sichtfeld selbst aus. */
@Mixin(Camera.class)
public abstract class CameraMixin {
	@Inject(method = "calculateFov", at = @At("RETURN"), cancellable = true)
	private void vantage$zoom(float tickProgress, CallbackInfoReturnable<Float> cir) {
		float f = Zoom.factor(tickProgress);
		if (f > 1.001f) {
			cir.setReturnValue(cir.getReturnValueF() / f);
		}
	}
}
