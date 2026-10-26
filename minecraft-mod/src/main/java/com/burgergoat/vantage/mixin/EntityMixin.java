package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.CameraControl;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Freelook/Freecam: die Maus dreht dann die Kamera, nicht den eigenen Spieler. */
@Mixin(Entity.class)
public abstract class EntityMixin {
	@Inject(method = "changeLookDirection", at = @At("HEAD"), cancellable = true)
	private void vantage$freeLook(double dx, double dy, CallbackInfo ci) {
		if ((Object) this == MinecraftClient.getInstance().player && CameraControl.turn(dx, dy)) ci.cancel();
	}
}
