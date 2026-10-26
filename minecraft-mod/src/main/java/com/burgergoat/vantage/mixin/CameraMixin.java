package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.CameraControl;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.client.render.Camera;
import net.minecraft.entity.Entity;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Freelook dreht die Kamera um den Spieler, Freecam setzt Position und Blickrichtung ganz frei. */
@Mixin(Camera.class)
public abstract class CameraMixin {
	@Shadow
	private boolean thirdPerson;

	@Shadow
	protected abstract void setPos(Vec3d pos);

	@Shadow
	protected abstract void setRotation(float yaw, float pitch);

	@WrapOperation(method = "update", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/Camera;setRotation(FF)V"))
	private void vantage$freeRotation(Camera camera, float yaw, float pitch, Operation<Void> original) {
		if (CameraControl.active()) original.call(camera, CameraControl.yaw(), CameraControl.pitch());
		else original.call(camera, yaw, pitch);
	}

	@Inject(method = "update", at = @At("TAIL"))
	private void vantage$freeCam(World area, Entity focusedEntity, boolean thirdPerson, boolean inverseView, float tickProgress, CallbackInfo ci) {
		if (CameraControl.freeCam()) {
			// Eigener Spieler wird dann sichtbar gezeichnet (wie in der dritten Person)
			this.thirdPerson = true;
			setPos(CameraControl.position(tickProgress));
			setRotation(CameraControl.yaw(), CameraControl.pitch());
		}
	}
}
