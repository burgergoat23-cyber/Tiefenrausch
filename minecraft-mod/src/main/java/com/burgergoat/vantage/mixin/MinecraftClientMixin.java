package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.Macros;
import com.burgergoat.vantage.feature.Viewmodel;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
	/** Vor jedem Linksklick-Angriff: Attribut-Swap (Streitkolben) bzw. Schild-Brecher. */
	@Inject(method = "doAttack", at = @At("HEAD"))
	private void vantage$beforeAttack(CallbackInfoReturnable<Boolean> cir) {
		Macros.beforeAttack((MinecraftClient) (Object) this);
	}

	/** Nach dem Angriff: Schlaganimation wie in CS (nur wenn wirklich geschwungen wurde). */
	@Inject(method = "doAttack", at = @At("RETURN"))
	private void vantage$afterAttack(CallbackInfoReturnable<Boolean> cir) {
		Viewmodel.afterAttack((MinecraftClient) (Object) this);
	}
}
