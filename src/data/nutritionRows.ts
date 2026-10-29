/**
 * Nutrition rows (migration 0027) to the domain's shapes and back. Pure: it
 * only imports types, so the mapping is tested without a database.
 */

import type {
  BodyWeightRow,
  DiaryDayRow,
  DiaryEntryInsert,
  DiaryEntryRow,
  FoodPortionRow,
  FoodRow,
  Json,
  NutritionGoalRow,
  NutritionSettingsRow,
  RecipeItemRow,
  SavedMealItemRow,
  SavedMealRow,
  WaterLogRow,
} from '@/lib/database.types';
import type { DiaryEntry, EntrySource } from '@/domain/nutrition/entries';
import type { Food } from '@/domain/nutrition/foods';
import type { ActivityLevel } from '@/domain/nutrition/goals';
import {
  NUTRIENT_COLUMNS,
  NUTRIENT_KEYS,
  nutrientsFromRow,
  nutrientsToRow,
  type NutrientKey,
} from '@/domain/nutrition/nutrients';
import {
  DEFAULT_NUTRITION_SETTINGS,
  type NutritionSettings,
  type WaterLog,
  type WeighIn,
} from '@/domain/nutrition/settings';
import type { NutritionGoal } from '@/domain/nutrition/totals';
import type { RecipeItem } from '@/domain/nutrition/recipes';
import type { SavedMeal, SavedMealItem } from '@/domain/nutrition/savedMeals';

export function foodFromRow(row: FoodRow, portions: readonly FoodPortionRow[] = []): Food {
  return {
    id: row.id,
    source: row.source,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    basis: row.basis,
    servingLabel: row.serving_label,
    servingG: row.serving_g,
    servingMl: row.serving_ml,
    nutrients: nutrientsFromRow(row),
    portions: [...portions]
      .filter((p) => p.food_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ label: p.label, grams: p.grams })),
  };
}

export function entryFromRow(row: DiaryEntryRow): DiaryEntry {
  return {
    id: row.id,
    day: row.day,
    meal: row.meal,
    foodId: row.food_id,
    source: row.source as EntrySource,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    amount: row.amount,
    unit: row.unit,
    grams: row.grams,
    nutrients: nutrientsFromRow(row),
    loggedAt: row.logged_at,
  };
}

export function entryToRow(entry: DiaryEntry, userId: string): DiaryEntryInsert {
  return {
    id: entry.id,
    user_id: userId,
    day: entry.day,
    meal: entry.meal,
    food_id: entry.foodId,
    source: entry.source,
    barcode: entry.barcode,
    name: entry.name,
    brand: entry.brand,
    amount: entry.amount,
    unit: entry.unit,
    grams: entry.grams,
    logged_at: entry.loggedAt,
    ...(nutrientsToRow(entry.nutrients) as { kcal: number }),
  };
}

/** What can change on an entry once it's logged: where it sits, and how much. */
export function entryPatch(entry: DiaryEntry) {
  return {
    day: entry.day,
    meal: entry.meal,
    amount: entry.amount,
    unit: entry.unit,
    grams: entry.grams,
    ...(nutrientsToRow(entry.nutrients) as { kcal: number }),
  };
}

const ACTIVITY_LEVELS: readonly ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

/** A person's settings, or the defaults when they have no row yet. */
export function settingsFromRow(row: NutritionSettingsRow | null): NutritionSettings {
  if (!row) return { ...DEFAULT_NUTRITION_SETTINGS, mealNames: [...DEFAULT_NUTRITION_SETTINGS.mealNames] };
  return {
    mealNames: row.meal_names.length > 0 ? row.meal_names : [...DEFAULT_NUTRITION_SETTINGS.mealNames],
    energyUnit: row.energy_unit,
    addExercise: row.add_exercise,
    netCarbs: row.net_carbs,
    waterGoalMl: row.water_goal_ml,
    heightCm: row.height_cm,
    birthYear: row.birth_year,
    sex: row.sex_for_calculator,
    activity: row.activity_level && ACTIVITY_LEVELS.includes(row.activity_level) ? row.activity_level : null,
    goalWeightKg: row.goal_weight_kg,
    weeklyChangeKg: row.weekly_change_kg,
  };
}

export function settingsToRow(s: Partial<NutritionSettings>): Omit<Partial<NutritionSettingsRow>, 'user_id'> {
  const out: Omit<Partial<NutritionSettingsRow>, 'user_id'> = {};
  if (s.mealNames !== undefined) out.meal_names = s.mealNames;
  if (s.energyUnit !== undefined) out.energy_unit = s.energyUnit;
  if (s.addExercise !== undefined) out.add_exercise = s.addExercise;
  if (s.netCarbs !== undefined) out.net_carbs = s.netCarbs;
  if (s.waterGoalMl !== undefined) out.water_goal_ml = s.waterGoalMl;
  if (s.heightCm !== undefined) out.height_cm = s.heightCm;
  if (s.birthYear !== undefined) out.birth_year = s.birthYear;
  if (s.sex !== undefined) out.sex_for_calculator = s.sex;
  if (s.activity !== undefined) out.activity_level = s.activity;
  if (s.goalWeightKg !== undefined) out.goal_weight_kg = s.goalWeightKg;
  if (s.weeklyChangeKg !== undefined) out.weekly_change_kg = s.weeklyChangeKg;
  return out;
}

/** Targets as stored ({"fiber_g": 30}) to the domain's keys ({fiberG: 30}), dropping anything else. */
function targetsFromJson(json: Json): Partial<Record<NutrientKey, number>> {
  const out: Partial<Record<NutrientKey, number>> = {};
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out;
  const stored = json as Record<string, unknown>;
  for (const key of NUTRIENT_KEYS) {
    const v = stored[NUTRIENT_COLUMNS[key]];
    if (key !== 'kcal' && typeof v === 'number' && Number.isFinite(v) && v > 0) out[key] = v;
  }
  return out;
}

export function goalFromRow(row: NutritionGoalRow): NutritionGoal {
  const split = Array.isArray(row.meal_split) && row.meal_split.every((v) => typeof v === 'number')
    ? (row.meal_split as number[])
    : null;
  return {
    startsOn: row.starts_on,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    targets: targetsFromJson(row.targets),
    mealSplit: split,
    macroMode: row.macro_mode === 'grams' ? 'grams' : 'percent',
  };
}

export function goalToRow(goal: NutritionGoal, userId: string, macroMode: 'percent' | 'grams') {
  const targets: Record<string, number> = {};
  for (const [key, value] of Object.entries(goal.targets) as [NutrientKey, number][]) {
    if (key !== 'kcal' && value > 0) targets[NUTRIENT_COLUMNS[key]] = value;
  }
  return {
    user_id: userId,
    starts_on: goal.startsOn,
    kcal: Math.round(goal.kcal),
    protein_g: goal.proteinG,
    carbs_g: goal.carbsG,
    fat_g: goal.fatG,
    macro_mode: macroMode,
    targets,
    meal_split: goal.mealSplit,
  };
}

export function diaryDayFromRow(row: DiaryDayRow | null): { note: string | null; completedAt: string | null } {
  return { note: row?.note ?? null, completedAt: row?.completed_at ?? null };
}

export function waterFromRow(row: WaterLogRow): WaterLog {
  return { id: row.id, day: row.day, ml: row.ml, loggedAt: row.logged_at };
}

export function weighInFromRow(row: BodyWeightRow): WeighIn {
  return { id: row.id, measuredOn: row.measured_on, kg: row.kg };
}

/** One of your foods (or a recipe) as a row to save. The catalog is never written from the app. */
export function foodToRow(food: Food, userId: string, extra: Record<string, unknown> = {}) {
  return {
    id: food.id ?? undefined,
    owner_id: userId,
    source: food.source === 'usda' ? ('user' as const) : food.source,
    source_ref: food.source === 'off' ? food.barcode : null,
    barcode: food.barcode,
    name: food.name,
    brand: food.brand,
    basis: food.basis,
    serving_label: food.servingLabel,
    serving_g: food.servingG,
    serving_ml: food.servingMl,
    servings: null as number | null,
    extra: extra as Json,
    ...(nutrientsToRow(food.nutrients) as { kcal: number }),
  };
}

function itemFromRow(row: SavedMealItemRow): SavedMealItem {
  return {
    foodId: row.food_id,
    source: row.source as EntrySource,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    amount: row.amount,
    unit: row.unit,
    grams: row.grams,
    nutrients: nutrientsFromRow(row),
  };
}

export function savedMealFromRow(row: SavedMealRow & { items?: SavedMealItemRow[] | null }): SavedMeal {
  return {
    id: row.id,
    name: row.name,
    items: [...(row.items ?? [])].sort((a, b) => a.position - b.position).map(itemFromRow),
  };
}

/** Items as rpc_save_meal takes them. */
export function savedMealItemsToJson(items: readonly SavedMealItem[]): Json {
  return items.map((i) => ({
    food_id: i.foodId,
    source: i.source,
    barcode: i.barcode,
    name: i.name,
    brand: i.brand,
    amount: i.amount,
    unit: i.unit,
    grams: i.grams,
    ...nutrientsToRow(i.nutrients),
  }));
}

export function recipeItemFromRow(row: RecipeItemRow): RecipeItem {
  return {
    foodId: row.food_id,
    name: row.name,
    amount: row.amount,
    unit: row.unit,
    grams: row.grams,
    nutrients: nutrientsFromRow(row),
  };
}

/** A recipe and its ingredients as rpc_save_recipe takes them. */
export function recipeToJson(recipe: Food, servings: number, items: readonly RecipeItem[]): { p_recipe: Json; p_items: Json } {
  return {
    p_recipe: {
      id: recipe.id,
      name: recipe.name,
      serving_label: recipe.servingLabel ?? '1 serving',
      serving_g: recipe.servingG,
      servings,
      ...nutrientsToRow(recipe.nutrients),
    },
    p_items: items.map((i) => ({
      food_id: i.foodId,
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      grams: i.grams,
      ...nutrientsToRow(i.nutrients),
    })),
  };
}
