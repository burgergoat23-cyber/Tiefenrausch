package de.brotzeitdelight.registry;

import de.brotzeitdelight.BrotzeitDelight;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;
import vectorwing.farmersdelight.FarmersDelight;

/**
 * Der Kreativ-Tab „Brotzeit Delight".
 */
public final class ModCreativeTabs {
    public static final DeferredRegister<CreativeModeTab> CREATIVE_TABS =
            DeferredRegister.create(Registries.CREATIVE_MODE_TAB, BrotzeitDelight.MOD_ID);

    /** Übersetzungsschlüssel für den Namen des Tabs. */
    public static final String TITLE_KEY = "itemGroup." + BrotzeitDelight.MOD_ID;

    // Farmer's Delight meldet seinen Tab unter der eigenen Mod-ID an
    // (vectorwing.farmersdelight.common.registry.ModCreativeTabs). Unser Tab steht direkt dahinter.
    private static final ResourceKey<CreativeModeTab> FARMERS_DELIGHT_TAB = ResourceKey.create(
            Registries.CREATIVE_MODE_TAB,
            ResourceLocation.fromNamespaceAndPath(FarmersDelight.MODID, FarmersDelight.MODID));

    public static final DeferredHolder<CreativeModeTab, CreativeModeTab> MAIN = CREATIVE_TABS.register("main",
            () -> CreativeModeTab.builder()
                    .title(Component.translatable(TITLE_KEY))
                    .icon(() -> new ItemStack(ModItems.PRETZEL.get()))
                    .withTabsBefore(FARMERS_DELIGHT_TAB)
                    .displayItems((parameters, output) -> output.accept(ModItems.PRETZEL.get()))
                    .build());

    private ModCreativeTabs() {
    }
}
