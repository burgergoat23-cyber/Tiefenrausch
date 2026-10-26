package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.Macros;
import com.burgergoat.vantage.feature.Viewmodel;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Minecraft.class)
public abstract class MinecraftClientMixin {
	/** Vor jedem Linksklick-Angriff: Attribut-Swap (Streitkolben) bzw. Schild-Brecher. */
	@Inject(method = "startAttack", at = @At("HEAD"))
	private void vantage$beforeAttack(CallbackInfoReturnable<Boolean> cir) {
		Macros.beforeAttack((Minecraft) (Object) this);
	}

	/** Nach dem Angriff: Schlaganimation wie in CS (nur wenn wirklich geschwungen wurde). */
	@Inject(method = "startAttack", at = @At("RETURN"))
	private void vantage$afterAttack(CallbackInfoReturnable<Boolean> cir) {
		Viewmodel.afterAttack((Minecraft) (Object) this);
	}
}
