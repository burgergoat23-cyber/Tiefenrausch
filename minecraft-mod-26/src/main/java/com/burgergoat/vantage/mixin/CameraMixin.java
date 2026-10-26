package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.CameraControl;
import com.burgergoat.vantage.feature.Zoom;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.client.Camera;
import net.minecraft.world.phys.Vec3;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zoom, Freelook und Freecam: in 26.2 rechnet die Kamera Sichtfeld, Position und Blickrichtung selbst. */
@Mixin(Camera.class)
public abstract class CameraMixin {
	@Shadow
	private boolean detached;

	@Shadow
	protected abstract void setRotation(float yaw, float pitch);

	@Shadow
	protected abstract void setPosition(Vec3 pos);

	@Inject(method = "calculateFov", at = @At("RETURN"), cancellable = true)
	private void vantage$zoom(float tickProgress, CallbackInfoReturnable<Float> cir) {
		float f = Zoom.factor(tickProgress);
		if (f > 1.001f) {
			cir.setReturnValue(cir.getReturnValueF() / f);
		}
	}

	@WrapOperation(method = "alignWithEntity", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V"))
	private void vantage$freeRotation(Camera camera, float yaw, float pitch, Operation<Void> original) {
		if (CameraControl.active()) original.call(camera, CameraControl.yaw(), CameraControl.pitch());
		else original.call(camera, yaw, pitch);
	}

	@Inject(method = "alignWithEntity", at = @At("TAIL"))
	private void vantage$freeCam(float tickProgress, CallbackInfo ci) {
		if (CameraControl.freeCam()) {
			// Eigener Spieler wird dann sichtbar gezeichnet (wie in der dritten Person)
			this.detached = true;
			setPosition(CameraControl.position(tickProgress));
			setRotation(CameraControl.yaw(), CameraControl.pitch());
		}
	}
}
