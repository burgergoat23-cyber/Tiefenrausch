package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.CameraControl;
import net.minecraft.client.input.KeyboardInput;
import net.minecraft.util.PlayerInput;
import net.minecraft.util.math.Vec2f;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Freecam: die Bewegungstasten steuern die Kamera, der Spieler bleibt stehen. */
@Mixin(KeyboardInput.class)
public abstract class KeyboardInputMixin {
	@Inject(method = "tick", at = @At("TAIL"))
	private void vantage$freeCamInput(CallbackInfo ci) {
		if (CameraControl.freeCam()) {
			((InputAccessor) this).vantage$setPlayerInput(PlayerInput.DEFAULT);
			((InputAccessor) this).vantage$setMovementVector(Vec2f.ZERO);
		}
	}
}
