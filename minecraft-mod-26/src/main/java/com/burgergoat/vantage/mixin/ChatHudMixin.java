package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.feature.ChatTweaks;
import net.minecraft.client.gui.components.ChatComponent;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Chat-Verbesserungen: Uhrzeit, gleiche Nachrichten zusammenfassen, laengerer Verlauf. */
@Mixin(ChatComponent.class)
public class ChatHudMixin {
	@ModifyVariable(method = "addMessage(Lnet/minecraft/network/chat/Component;Lnet/minecraft/network/chat/MessageSignature;Lnet/minecraft/client/multiplayer/chat/GuiMessageSource;Lnet/minecraft/client/multiplayer/chat/GuiMessageTag;)V",
			at = @At("HEAD"), argsOnly = true)
	private Component vantage$chat(Component message) {
		ChatHudAccessor self = (ChatHudAccessor) this;
		return ChatTweaks.process(message, () -> {
			if (!self.vantage$messages().isEmpty()) {
				self.vantage$messages().remove(0);
				self.vantage$refresh();
			}
		});
	}

	@ModifyConstant(method = "addMessageToQueue", constant = @Constant(intValue = 100), require = 0)
	private int vantage$history(int max) {
		return ChatTweaks.history(max);
	}

	@ModifyConstant(method = "addMessageToDisplayQueue", constant = @Constant(intValue = 100), require = 0)
	private int vantage$visibleHistory(int max) {
		return ChatTweaks.history(max);
	}
}
