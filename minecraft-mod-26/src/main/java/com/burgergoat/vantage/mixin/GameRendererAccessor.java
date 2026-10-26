package com.burgergoat.vantage.mixin;

import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(GameRenderer.class)
public interface GameRendererAccessor {
	@Accessor("postEffectId")
	Identifier vantage$getPostProcessorId();

	@Invoker("setPostEffect")
	void vantage$setPostProcessor(Identifier id);

	@Invoker("clearPostEffect")
	void vantage$clearPostProcessor();
}
