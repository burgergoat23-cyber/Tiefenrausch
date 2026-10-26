package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.Extras;
import net.minecraft.client.renderer.LevelRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Eigene Farbe und Dicke fuer den Rahmen um den angeschauten Block. */
@Mixin(LevelRenderer.class)
public class WorldRendererMixin {
	@ModifyVariable(method = "submitHitOutline", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private int vantage$outlineColor(int color) {
		return Extras.outlineColor(color);
	}

	@ModifyVariable(method = "submitHitOutline", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private float vantage$outlineWidth(float width) {
		return Extras.outlineWidth(width);
	}
}
