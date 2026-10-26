package com.burgergoat.vantage.mixin;

import net.minecraft.world.level.levelgen.structure.TemplateStructurePiece;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

@Mixin(TemplateStructurePiece.class)
public interface SimpleStructurePieceAccessor {
	@Accessor("templateName")
	String vantage$getTemplateIdString();
}
