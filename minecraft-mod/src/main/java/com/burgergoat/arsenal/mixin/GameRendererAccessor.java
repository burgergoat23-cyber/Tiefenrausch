package com.burgergoat.arsenal.mixin;

import net.minecraft.client.render.GameRenderer;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(GameRenderer.class)
public interface GameRendererAccessor {
	@Accessor("postProcessorId")
	Identifier arsenal$getPostProcessorId();

	@Invoker("setPostProcessor")
	void arsenal$setPostProcessor(Identifier id);

	@Invoker("clearPostProcessor")
	void arsenal$clearPostProcessor();
}
