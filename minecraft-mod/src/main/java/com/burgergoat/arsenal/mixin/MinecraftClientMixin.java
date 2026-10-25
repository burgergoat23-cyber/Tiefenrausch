package com.burgergoat.arsenal.mixin;

import com.burgergoat.arsenal.feature.Macros;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
	/** Vor jedem Linksklick-Angriff: Attribut-Swap (Streitkolben) bzw. Schild-Brecher. */
	@Inject(method = "doAttack", at = @At("HEAD"))
	private void arsenal$beforeAttack(CallbackInfoReturnable<Boolean> cir) {
		Macros.beforeAttack((MinecraftClient) (Object) this);
	}
}
