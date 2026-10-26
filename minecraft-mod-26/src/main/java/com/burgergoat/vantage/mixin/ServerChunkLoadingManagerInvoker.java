package com.burgergoat.vantage.mixin;

import net.minecraft.server.level.ChunkMap;
import net.minecraft.world.level.ChunkPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(ChunkMap.class)
public interface ServerChunkLoadingManagerInvoker {
	/** true = Chunk wurde schon einmal fertig erzeugt (also war dort schon jemand in Sichtweite). */
	@Invoker("isExistingChunkFull")
	boolean vantage$isLevelChunk(ChunkPos pos);
}
