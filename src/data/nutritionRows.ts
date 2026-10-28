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
