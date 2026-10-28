/**
 * Recipes: a food made of other foods. Pure, no I/O.
 *
 * Each ingredient keeps the nutrients for its own amount (recipe_items in
 * migration 0027), and the recipe's food row holds the result per serving, so
 * logging a recipe is logging any other per-serving food.
 */

import { measure, type Food } from './foods';
import { scaleNutrients, sumNutrients, type Nutrients } from './nutrients';

export interface RecipeItem {
  foodId: string | null;
  name: string;
  amount: number;
  unit: string;
  grams: number | null;
  /** For this item's amount. */
  nutrients: Nutrients;
}

export const MAX_SERVINGS = 1000;

/** An ingredient from a food and an amount of it, or null if that doesn't measure. */
export function recipeItem(food: Food, amount: number, unitKey: string): RecipeItem | null {
  const m = measure(food, amount, unitKey);
  if (!m) return null;
  return { foodId: food.id, name: food.name, amount, unit: m.unit.label, grams: m.grams, nutrients: m.nutrients };
}

/** What one serving holds, or null without a sensible number of servings. */
export function perServing(items: readonly RecipeItem[], servings: number): Nutrients | null {
  if (!(servings > 0) || servings > MAX_SERVINGS) return null;
  return scaleNutrients(sumNutrients(items.map((i) => i.nutrients)), 1 / servings);
}

/** The whole recipe's weight, when every ingredient has one. */
export function totalGrams(items: readonly RecipeItem[]): number | null {
  if (items.length === 0 || items.some((i) => i.grams == null)) return null;
  return Math.round(items.reduce((sum, i) => sum + (i.grams as number), 0) * 100) / 100;
}
