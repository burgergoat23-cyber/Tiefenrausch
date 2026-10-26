package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.skin.SkinManager;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.client.item.ItemModelManager;
import net.minecraft.component.ComponentType;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.item.ItemStack;
import net.minecraft.util.HeldItemContext;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/** Tauscht beim Zeichnen das Item-Modell gegen den gewaehlten Skin aus (nur auf dem eigenen Bildschirm). */
@Mixin(ItemModelManager.class)
public abstract class ItemModelManagerMixin {
	@WrapOperation(method = "update", at = @At(value = "INVOKE", target = "Lnet/minecraft/item/ItemStack;get(Lnet/minecraft/component/ComponentType;)Ljava/lang/Object;"))
	private Object vantage$skinModel(ItemStack stack, ComponentType<?> type, Operation<Object> original,
			@Local(argsOnly = true) HeldItemContext context) {
		Object value = original.call(stack, type);
		if (type == DataComponentTypes.ITEM_MODEL) {
			Identifier skin = SkinManager.resolve(stack, context, value instanceof Identifier id ? id : null);
			if (skin != null) {
				return skin;
			}
		}
		return value;
	}
}
