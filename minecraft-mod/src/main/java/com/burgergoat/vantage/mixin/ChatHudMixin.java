package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.ChatTweaks;
import net.minecraft.client.gui.hud.ChatHud;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Chat-Verbesserungen: Uhrzeit, gleiche Nachrichten zusammenfassen, laengerer Verlauf. */
@Mixin(ChatHud.class)
public class ChatHudMixin {
	@ModifyVariable(method = "addMessage(Lnet/minecraft/text/Text;Lnet/minecraft/network/message/MessageSignatureData;Lnet/minecraft/client/gui/hud/MessageIndicator;)V",
			at = @At("HEAD"), argsOnly = true)
	private Text vantage$chat(Text message) {
		ChatHudAccessor self = (ChatHudAccessor) this;
		return ChatTweaks.process(message, () -> {
			if (!self.vantage$messages().isEmpty()) {
				self.vantage$messages().remove(0);
				self.vantage$refresh();
			}
		});
	}

	@ModifyConstant(method = "addMessage(Lnet/minecraft/client/gui/hud/ChatHudLine;)V", constant = @Constant(intValue = 100), require = 0)
	private int vantage$history(int max) {
		return ChatTweaks.history(max);
	}

	@ModifyConstant(method = "addVisibleMessage", constant = @Constant(intValue = 100), require = 0)
	private int vantage$visibleHistory(int max) {
		return ChatTweaks.history(max);
	}
}
