package com.burgergoat.vantage.mixin;

import com.burgergoat.vantage.skin.SkinManager;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.client.renderer.item.ItemModelResolver;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.component.DataComponents;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.ItemOwner;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/** Tauscht beim Zeichnen das Item-Modell gegen den gewaehlten Skin aus (nur auf dem eigenen Bildschirm). */
@Mixin(ItemModelResolver.class)
public abstract class ItemModelManagerMixin {
	@WrapOperation(method = "appendItemLayers", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/item/ItemStack;get(Lnet/minecraft/core/component/DataComponentType;)Ljava/lang/Object;"))
	private Object vantage$skinModel(ItemStack stack, DataComponentType<?> type, Operation<Object> original,
			@Local(argsOnly = true) ItemOwner context) {
		Object value = original.call(stack, type);
		if (type == DataComponents.ITEM_MODEL) {
			Identifier skin = SkinManager.resolve(stack, context, value instanceof Identifier id ? id : null);
			if (skin != null) {
				return skin;
			}
		}
		return value;
	}
}
