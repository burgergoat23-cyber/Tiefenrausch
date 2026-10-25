package com.burgergoat.arsenal.mixin;

import net.minecraft.structure.SimpleStructurePiece;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

@Mixin(SimpleStructurePiece.class)
public interface SimpleStructurePieceAccessor {
	@Accessor("templateIdString")
	String arsenal$getTemplateIdString();
}
