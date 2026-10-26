package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.GuiThemes;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Beschriftungen in Kisten, Oefen usw. hell machen, wenn ein dunkles GUI-Design an ist. */
@Mixin(GuiGraphicsExtractor.class)
public class DrawContextMixin {
	@ModifyVariable(method = "text(Lnet/minecraft/client/gui/Font;Lnet/minecraft/util/FormattedCharSequence;IIIZ)V",
			at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private int vantage$labelOrdered(int color) {
		return GuiThemes.labelColor(color);
	}

	@ModifyVariable(method = "text(Lnet/minecraft/client/gui/Font;Ljava/lang/String;IIIZ)V",
			at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private int vantage$labelString(int color) {
		return GuiThemes.labelColor(color);
	}

	@ModifyVariable(method = "text(Lnet/minecraft/client/gui/Font;Lnet/minecraft/network/chat/Component;IIIZ)V",
			at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private int vantage$labelText(int color) {
		return GuiThemes.labelColor(color);
	}
}
