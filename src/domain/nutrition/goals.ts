/**
 * The calorie goal calculator and the macro split. Pure, no I/O.
 *
 * Resting energy uses the Mifflin-St Jeor equation, multiplied by a standard
 * activity factor for everyday activity (logged exercise is added on top by
 * the diary's setting, not here). A weekly weight change moves the goal by
 * about 7,700 kcal per kilogram, the usual figure for body fat.
 *
 * Every number here is an estimate, and the app says so. Two guardrails, as
 * decided for 1.2: a goal below the calorie floor is flagged (a warning, not
 * a block), and nobody under 18 gets a weight-loss goal.
 */

import { KCAL_PER_G } from './nutrients';

export type SexForCalculator = 'female' | 'male';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting',
  light: 'On your feet some of the day',
  moderate: 'On your feet most of the day',
  active: 'Physical work',
  very_active: 'Hard physical work',
};

export const KCAL_PER_KG_CHANGE = 7700;

/** The fastest weekly change the calculator works with, either way. */
export const MAX_WEEKLY_CHANGE_KG = 1;

/**
 * Below these the goal is flagged. They are the floors commonly used by diet
 * apps and general guidance; without a sex given, the lower one applies.
 */
export const CALORIE_FLOOR: Record<SexForCalculator | 'unspecified', number> = {
  female: 1200,
  male: 1500,
  unspecified: 1200,
};

export const ADULT_AGE = 18;

/**
 * Age from a birth year, on a local date. Without the birthday it can be a
 * year high; `conservative` takes the lower age, for decisions that protect
 * minors.
 */
export function ageFromBirthYear(birthYear: number, today: string, conservative = false): number {
  const year = Number(today.slice(0, 4));
  return year - birthYear - (conservative ? 1 : 0);
}

/**
 * Resting energy (Mifflin-St Jeor), kcal a day. Without a sex given it sits
 * halfway between the two equations.
 */
export function restingCalories(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: SexForCalculator | null;
}): number {
  const offset = input.sex === 'male' ? 5 : input.sex === 'female' ? -161 : -78;
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + offset;
}

export interface GoalInput {
  weightKg: number;
  heightCm: number;
  birthYear: number;
  sex: SexForCalculator | null;
  activity: ActivityLevel;
  /** Negative to lose, positive to gain. */
  weeklyChangeKg: number;
  /** Local date, YYYY-MM-DD. */
  today: string;
}

export type GoalNote = 'loss_not_offered_under_18' | 'change_capped' | 'below_floor';

export interface CalorieGoal {
  kcal: number;
  maintenance: number;
  resting: number;
  /** The change the goal was worked out for, after the guardrails. */
  weeklyChangeKg: number;
  notes: GoalNote[];
}

/** Null when an input is missing or impossible. */
export function calorieGoal(input: GoalInput): CalorieGoal | null {
  const { weightKg, heightCm, birthYear, sex, activity, today } = input;
  if (!(weightKg >= 20 && weightKg <= 400) || !(heightCm >= 50 && heightCm <= 272)) return null;
  if (!Number.isInteger(birthYear) || !(activity in ACTIVITY_FACTORS)) return null;
  const age = ageFromBirthYear(birthYear, today);
  if (!(age >= 13 && age <= 120)) return null;

  const notes: GoalNote[] = [];
  let change = Number.isFinite(input.weeklyChangeKg) ? input.weeklyChangeKg : 0;
  if (Math.abs(change) > MAX_WEEKLY_CHANGE_KG) {
    change = Math.sign(change) * MAX_WEEKLY_CHANGE_KG;
    notes.push('change_capped');
  }
  if (change < 0 && ageFromBirthYear(birthYear, today, true) < ADULT_AGE) {
    change = 0;
    notes.push('loss_not_offered_under_18');
  }

  const resting = restingCalories({ weightKg, heightCm, age, sex });
  const maintenance = resting * ACTIVITY_FACTORS[activity];
  const kcal = Math.round(maintenance + (change * KCAL_PER_KG_CHANGE) / 7);
  if (isBelowFloor(kcal, sex)) notes.push('below_floor');
  return { kcal, maintenance: Math.round(maintenance), resting: Math.round(resting), weeklyChangeKg: change, notes };
}

export function isBelowFloor(kcal: number, sex: SexForCalculator | null): boolean {
  return kcal < CALORIE_FLOOR[sex ?? 'unspecified'];
}

export interface MacroPercent {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface MacroGrams {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Grams for a percentage split of the calories. Null unless it adds to 100. */
export function macrosFromPercent(kcal: number, pct: MacroPercent): MacroGrams | null {
  const { proteinPct, carbsPct, fatPct } = pct;
  if ([proteinPct, carbsPct, fatPct].some((p) => !(p >= 0 && p <= 100))) return null;
  if (Math.round(proteinPct + carbsPct + fatPct) !== 100 || !(kcal > 0)) return null;
  return {
    proteinG: Math.round((kcal * proteinPct) / 100 / KCAL_PER_G.protein),
    carbsG: Math.round((kcal * carbsPct) / 100 / KCAL_PER_G.carbs),
    fatG: Math.round((kcal * fatPct) / 100 / KCAL_PER_G.fat),
  };
}

/** The percentage split that grams make of their own calories. */
export function percentFromMacros(g: MacroGrams): MacroPercent | null {
  const p = g.proteinG * KCAL_PER_G.protein;
  const c = g.carbsG * KCAL_PER_G.carbs;
  const f = g.fatG * KCAL_PER_G.fat;
  const total = p + c + f;
  if (!(total > 0) || [p, c, f].some((v) => v < 0)) return null;
  const proteinPct = Math.round((p / total) * 100);
  const fatPct = Math.round((f / total) * 100);
  return { proteinPct, carbsPct: 100 - proteinPct - fatPct, fatPct };
}
