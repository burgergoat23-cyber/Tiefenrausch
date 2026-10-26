package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.GuiThemes;
import net.minecraft.client.gui.DrawContext;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Beschriftungen in Kisten, Oefen usw. hell machen, wenn ein dunkles GUI-Design an ist. */
@Mixin(DrawContext.class)
public class DrawContextMixin {
	@ModifyVariable(method = "drawText(Lnet/minecraft/client/font/TextRenderer;Lnet/minecraft/text/OrderedText;IIIZ)V",
			at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private int vantage$labelOrdered(int color) {
		return GuiThemes.labelColor(color);
	}

	@ModifyVariable(method = "drawText(Lnet/minecraft/client/font/TextRenderer;Ljava/lang/String;IIIZ)V",
			at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private int vantage$labelString(int color) {
		return GuiThemes.labelColor(color);
	}

	@ModifyVariable(method = "drawText(Lnet/minecraft/client/font/TextRenderer;Lnet/minecraft/text/Text;IIIZ)V",
			at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private int vantage$labelText(int color) {
		return GuiThemes.labelColor(color);
	}
}
