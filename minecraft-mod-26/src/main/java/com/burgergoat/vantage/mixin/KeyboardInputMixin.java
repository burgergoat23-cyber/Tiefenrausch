package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.CameraControl;
import net.minecraft.client.player.KeyboardInput;
import net.minecraft.world.entity.player.Input;
import net.minecraft.world.phys.Vec2;
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
			((InputAccessor) this).vantage$setKeyPresses(Input.EMPTY);
			((InputAccessor) this).vantage$setMoveVector(Vec2.ZERO);
		}
	}
}
