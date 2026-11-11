package de.brotzeitdelight.gametest;

import de.brotzeitdelight.BrotzeitDelight;
import de.brotzeitdelight.registry.ModItems;
import net.minecraft.gametest.framework.GameTest;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.CraftingInput;
import net.minecraft.world.item.crafting.CraftingRecipe;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.item.crafting.RecipeType;
import net.neoforged.neoforge.gametest.GameTestHolder;
import net.neoforged.neoforge.gametest.PrefixGameTestTemplate;

import java.util.List;
import java.util.Optional;

/**
 * Spieltests für die Breze (Meilenstein 3).
 */
@GameTestHolder(BrotzeitDelight.MOD_ID)
@PrefixGameTestTemplate(false)
public final class PretzelGameTests {
    private PretzelGameTests() {
    }

    /** 8.1: 1 Weizenteig ergibt 1 rohe Breze, und in der Werkbank bleibt nichts zurück. */
    @GameTest(template = GameTestHelpers.EMPTY_TEMPLATE)
    public static void rawPretzelFromDough(GameTestHelper helper) {
        ItemStack dough = new ItemStack(vectorwing.farmersdelight.common.registry.ModItems.WHEAT_DOUGH.get());
        CraftingInput input = CraftingInput.of(1, 1, List.of(dough));
        Optional<RecipeHolder<CraftingRecipe>> found = helper.getLevel().getRecipeManager()
                .getRecipeFor(RecipeType.CRAFTING, input, helper.getLevel());
        helper.assertTrue(found.isPresent(), "Kein Werkbank-Rezept für Weizenteig");
        RecipeHolder<CraftingRecipe> holder = found.orElseThrow();
        helper.assertTrue(holder.id().equals(GameTestHelpers.id("crafting/raw_pretzel")), "Falsche Rezept-ID: " + holder.id());
        ItemStack result = holder.value().assemble(input, helper.getLevel().registryAccess());
        helper.assertTrue(result.is(ModItems.RAW_PRETZEL.get()) && result.getCount() == 1, "Falsches Ergebnis: " + result);
        helper.assertTrue(holder.value().getRemainingItems(input).stream().allMatch(ItemStack::isEmpty),
                "In der Werkbank darf nichts zurückbleiben");
        helper.succeed();
    }

    /** 8.2: Ofen 200, Räucherofen 100, Lagerfeuer 600 Ticks, je 0,35 Erfahrung. */
    @GameTest(template = GameTestHelpers.EMPTY_TEMPLATE)
    public static void pretzelCookingRecipes(GameTestHelper helper) {
        GameTestHelpers.assertCookingRecipe(helper, RecipeType.SMELTING, "smelting/pretzel",
                ModItems.RAW_PRETZEL.get(), ModItems.PRETZEL.get(), 200, 0.35F);
        GameTestHelpers.assertCookingRecipe(helper, RecipeType.SMOKING, "smoking/pretzel",
                ModItems.RAW_PRETZEL.get(), ModItems.PRETZEL.get(), 100, 0.35F);
        GameTestHelpers.assertCookingRecipe(helper, RecipeType.CAMPFIRE_COOKING, "campfire_cooking/pretzel",
                ModItems.RAW_PRETZEL.get(), ModItems.PRETZEL.get(), 600, 0.35F);
        helper.succeed();
    }

    /** Abschnitte 6 und 7: rohe Breze nicht essbar, Breze 5 Hunger, 0,6 Sättigung, normale Esszeit, Stapel 64. */
    @GameTest(template = GameTestHelpers.EMPTY_TEMPLATE)
    public static void pretzelFoodValues(GameTestHelper helper) {
        GameTestHelpers.assertNotEdible(helper, ModItems.RAW_PRETZEL.get());
        GameTestHelpers.assertFood(helper, ModItems.PRETZEL.get(), 5, 0.6F, 32);
        helper.assertTrue(new ItemStack(ModItems.PRETZEL.get()).getMaxStackSize() == 64, "Breze stapelt nicht bis 64");
        helper.assertTrue(new ItemStack(ModItems.RAW_PRETZEL.get()).getMaxStackSize() == 64, "Rohe Breze stapelt nicht bis 64");
        helper.succeed();
    }

    /** Abschnitt 12: rohe Breze 65 %, Breze 85 %. */
    @GameTest(template = GameTestHelpers.EMPTY_TEMPLATE)
    public static void pretzelCompostChances(GameTestHelper helper) {
        GameTestHelpers.assertCompostChance(helper, ModItems.RAW_PRETZEL.get(), 0.65F);
        GameTestHelpers.assertCompostChance(helper, ModItems.PRETZEL.get(), 0.85F);
        helper.succeed();
    }
}
