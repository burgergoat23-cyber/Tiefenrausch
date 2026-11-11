package de.brotzeitdelight.gametest;

import de.brotzeitdelight.BrotzeitDelight;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.food.FoodProperties;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.AbstractCookingRecipe;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.item.crafting.RecipeType;
import net.minecraft.world.item.crafting.SingleRecipeInput;
import net.minecraft.world.level.ItemLike;
import net.neoforged.neoforge.registries.datamaps.builtin.Compostable;
import net.neoforged.neoforge.registries.datamaps.builtin.NeoForgeDataMaps;

import java.util.Optional;

/**
 * Gemeinsame Prüfungen für die Spieltests.
 */
public final class GameTestHelpers {
    /** Leere Struktur aus data/brotzeitdelight/structure/empty.nbt. */
    public static final String EMPTY_TEMPLATE = "empty";

    /** Erlaubte Abweichung beim Vergleich von Kommazahlen. */
    private static final float EPSILON = 0.0001F;

    private GameTestHelpers() {
    }

    public static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(BrotzeitDelight.MOD_ID, path);
    }

    /**
     * Prüft ein Ofen-, Räucherofen- oder Lagerfeuer-Rezept: Es muss für die Zutat gefunden werden,
     * die erwartete ID haben und genau ein Stück des Ergebnisses mit der richtigen Zeit und Erfahrung liefern.
     */
    public static void assertCookingRecipe(GameTestHelper helper, RecipeType<? extends AbstractCookingRecipe> type,
                                           String recipeId, ItemLike ingredient, ItemLike result,
                                           int ticks, float experience) {
        Optional<? extends RecipeHolder<? extends AbstractCookingRecipe>> found = helper.getLevel().getRecipeManager()
                .getRecipeFor(type, new SingleRecipeInput(new ItemStack(ingredient)), helper.getLevel());
        helper.assertTrue(found.isPresent(), "Kein Rezept " + type + " für " + name(ingredient));
        RecipeHolder<? extends AbstractCookingRecipe> holder = found.orElseThrow();
        helper.assertTrue(holder.id().equals(id(recipeId)), "Falsche Rezept-ID: " + holder.id());
        ItemStack output = holder.value().getResultItem(helper.getLevel().registryAccess());
        helper.assertTrue(output.is(result.asItem()) && output.getCount() == 1,
                "Falsches Ergebnis in " + recipeId + ": " + output);
        helper.assertTrue(holder.value().getCookingTime() == ticks,
                "Falsche Zeit in " + recipeId + ": " + holder.value().getCookingTime());
        helper.assertTrue(Math.abs(holder.value().getExperience() - experience) < EPSILON,
                "Falsche Erfahrung in " + recipeId + ": " + holder.value().getExperience());
    }

    /** Prüft Hunger, Sättigungsfaktor und Esszeit in Ticks. */
    public static void assertFood(GameTestHelper helper, ItemLike item, int nutrition, float saturationModifier, int eatTicks) {
        FoodProperties food = new ItemStack(item).getFoodProperties(null);
        helper.assertTrue(food != null, name(item) + " ist nicht essbar");
        helper.assertTrue(food.nutrition() == nutrition, name(item) + ": Hunger " + food.nutrition());
        // Minecraft speichert die Sättigung als Hunger × Faktor × 2.
        float expectedSaturation = nutrition * saturationModifier * 2.0F;
        helper.assertTrue(Math.abs(food.saturation() - expectedSaturation) < EPSILON,
                name(item) + ": Sättigung " + food.saturation());
        helper.assertTrue(food.eatDurationTicks() == eatTicks, name(item) + ": Esszeit " + food.eatDurationTicks());
    }

    public static void assertNotEdible(GameTestHelper helper, ItemLike item) {
        helper.assertTrue(new ItemStack(item).getFoodProperties(null) == null, name(item) + " darf nicht essbar sein");
    }

    public static void assertCompostChance(GameTestHelper helper, ItemLike item, float chance) {
        Compostable compostable = item.asItem().builtInRegistryHolder().getData(NeoForgeDataMaps.COMPOSTABLES);
        helper.assertTrue(compostable != null, name(item) + " ist nicht kompostierbar");
        helper.assertTrue(Math.abs(compostable.chance() - chance) < EPSILON,
                name(item) + ": Kompost-Chance " + compostable.chance());
    }

    private static String name(ItemLike item) {
        return BuiltInRegistries.ITEM.getKey(item.asItem()).toString();
    }
}
