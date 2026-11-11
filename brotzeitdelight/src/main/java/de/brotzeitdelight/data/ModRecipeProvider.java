package de.brotzeitdelight.data;

import de.brotzeitdelight.BrotzeitDelight;
import de.brotzeitdelight.registry.ModItems;
import net.minecraft.core.HolderLookup;
import net.minecraft.data.PackOutput;
import net.minecraft.data.recipes.RecipeCategory;
import net.minecraft.data.recipes.RecipeOutput;
import net.minecraft.data.recipes.RecipeProvider;
import net.minecraft.data.recipes.ShapelessRecipeBuilder;
import net.minecraft.data.recipes.SimpleCookingRecipeBuilder;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraft.world.level.ItemLike;
import net.neoforged.neoforge.common.Tags;

import java.util.concurrent.CompletableFuture;

/**
 * Erzeugt alle Rezepte (Vorgabe Abschnitt 8). Jedes Rezept wird im Rezeptbuch freigeschaltet,
 * sobald der Spieler eine seiner Zutaten besitzt.
 */
public final class ModRecipeProvider extends RecipeProvider {
    /** Ofen, Räucherofen, Lagerfeuer (Vorgabe 8.2); dieselben Werte wie bei Farmer's Delight (data.recipe.SmeltingRecipes). */
    private static final int SMELTING_TICKS = 200;
    private static final int SMOKING_TICKS = 100;
    private static final int CAMPFIRE_TICKS = 600;
    private static final float COOKING_EXPERIENCE = 0.35F;

    public ModRecipeProvider(PackOutput output, CompletableFuture<HolderLookup.Provider> registries) {
        super(output, registries);
    }

    @Override
    protected void buildRecipes(RecipeOutput output) {
        // 8.1 Werkbank: 1 Weizenteig ergibt 1 rohe Breze. Weizenteig über das allgemeine Tag c:foods/dough.
        ShapelessRecipeBuilder.shapeless(RecipeCategory.FOOD, ModItems.RAW_PRETZEL.get())
                .requires(Tags.Items.FOODS_DOUGH)
                .unlockedBy("has_dough", has(Tags.Items.FOODS_DOUGH))
                .save(output, id("crafting", ModItems.RAW_PRETZEL.get()));

        // 8.2 Ofen, Räucherofen, Lagerfeuer
        cookingRecipes(output, ModItems.RAW_PRETZEL.get(), ModItems.PRETZEL.get());
    }

    /**
     * Legt für eine Zutat das Ofen-, Räucherofen- und Lagerfeuer-Rezept an.
     * Über das Lagerfeuer-Rezept funktioniert die Zutat auch in Pfanne und Herd von Farmer's Delight.
     */
    private static void cookingRecipes(RecipeOutput output, ItemLike ingredient, ItemLike result) {
        String criterion = "has_" + getItemName(ingredient);
        SimpleCookingRecipeBuilder.smelting(Ingredient.of(ingredient), RecipeCategory.FOOD, result, COOKING_EXPERIENCE, SMELTING_TICKS)
                .unlockedBy(criterion, has(ingredient))
                .save(output, id("smelting", result));
        SimpleCookingRecipeBuilder.smoking(Ingredient.of(ingredient), RecipeCategory.FOOD, result, COOKING_EXPERIENCE, SMOKING_TICKS)
                .unlockedBy(criterion, has(ingredient))
                .save(output, id("smoking", result));
        SimpleCookingRecipeBuilder.campfireCooking(Ingredient.of(ingredient), RecipeCategory.FOOD, result, COOKING_EXPERIENCE, CAMPFIRE_TICKS)
                .unlockedBy(criterion, has(ingredient))
                .save(output, id("campfire_cooking", result));
    }

    /** Rezept-ID nach dem Muster brotzeitdelight:art/ergebnis (Vorgabe Abschnitt 8). */
    private static ResourceLocation id(String type, ItemLike result) {
        return ResourceLocation.fromNamespaceAndPath(BrotzeitDelight.MOD_ID, type + "/" + getItemName(result));
    }
}
