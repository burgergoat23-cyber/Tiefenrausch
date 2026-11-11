package de.brotzeitdelight.item;

import net.minecraft.world.food.FoodProperties;

/**
 * Hunger- und Sättigungswerte aller essbaren Items (Vorgabe Abschnitte 6 und 7).
 * Aufbau nach dem Vorbild von vectorwing.farmersdelight.common.FoodValues.
 */
public final class ModFoods {
    /** Breze: wie Vanilla-Brot. */
    public static final FoodProperties PRETZEL = new FoodProperties.Builder()
            .nutrition(5).saturationModifier(0.6F).build();

    private ModFoods() {
    }
}
