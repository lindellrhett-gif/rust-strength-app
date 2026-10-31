/**
 * Diary settings, water and weigh-ins. Pure, no I/O.
 *
 * Nobody has to set anything to log food: with no settings row, the diary
 * uses these defaults, and the goal calculator's inputs stay empty until the
 * person fills them in.
 */

import { DEFAULT_MEAL_NAMES, MAX_MEALS } from './entries';
import type { ActivityLevel, SexForCalculator } from './goals';

export interface NutritionSettings {
  mealNames: string[];
  energyUnit: 'kcal' | 'kj';
  /** Add logged exercise to the day's calorie budget. */
  addExercise: boolean;
  /** Show carbs minus fiber. */
  netCarbs: boolean;
  waterGoalMl: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: SexForCalculator | null;
  activity: ActivityLevel | null;
  goalWeightKg: number | null;
  weeklyChangeKg: number | null;
}

export const DEFAULT_NUTRITION_SETTINGS: NutritionSettings = {
  mealNames: [...DEFAULT_MEAL_NAMES],
  energyUnit: 'kcal',
  addExercise: true,
  netCarbs: false,
  waterGoalMl: null,
  heightCm: null,
  birthYear: null,
  sex: null,
  activity: null,
  goalWeightKg: null,
  weeklyChangeKg: null,
};

export const MEAL_NAME_MAX = 30;

/**
 * Meal names as typed, tidied: trimmed, no blanks, one to six of them, each
 * up to 30 characters. Null if nothing usable is left.
 */
export function cleanMealNames(names: readonly string[]): string[] | null {
  const cleaned = names.map((n) => n.replace(/\s+/g, ' ').trim()).filter((n) => n.length > 0);
  if (cleaned.length === 0 || cleaned.length > MAX_MEALS) return null;
  if (cleaned.some((n) => n.length > MEAL_NAME_MAX)) return null;
  return cleaned;
}

// --- Water ---------------------------------------------------------------------

export interface WaterLog {
  id: string;
  day: string;
  ml: number;
  loggedAt: string;
}

/** The cup US nutrition labels use. */
export const ML_PER_CUP = 240;

/** The largest single entry the database takes. */
export const MAX_WATER_ML = 5000;

export function waterTotal(logs: readonly WaterLog[]): number {
  return logs.reduce((sum, l) => sum + l.ml, 0);
}

// --- Weigh-ins -------------------------------------------------------------------

export interface WeighIn {
  id: string;
  /** Local date, YYYY-MM-DD; one weigh-in a day. */
  measuredOn: string;
  kg: number;
}

/** The same bounds as run calories and the database. */
export function validWeighInKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= 20 && kg <= 400;
}

/** The most recent weigh-in, by date. */
export function latestWeighIn(weighIns: readonly WeighIn[]): WeighIn | null {
  let best: WeighIn | null = null;
  for (const w of weighIns) if (best == null || w.measuredOn > best.measuredOn) best = w;
  return best;
}
