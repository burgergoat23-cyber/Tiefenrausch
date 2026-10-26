package com.burgergoat.vantage.mixin;

import net.minecraft.server.world.ServerChunkLoadingManager;
import net.minecraft.util.math.ChunkPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(ServerChunkLoadingManager.class)
public interface ServerChunkLoadingManagerInvoker {
	/** true = Chunk wurde schon einmal fertig erzeugt (also war dort schon jemand in Sichtweite). */
	@Invoker("isLevelChunk")
	boolean vantage$isLevelChunk(ChunkPos pos);
}
