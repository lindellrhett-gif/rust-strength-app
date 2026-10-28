/**
 * Diary entries: what was eaten, when, and what it was worth. Pure, no I/O.
 *
 * An entry carries its own copy of the nutrients for the amount eaten
 * (migration 0027), so the diary never has to look a food up again, and
 * editing or deleting that food later leaves the day as it was.
 */

import { measure, type Food, type FoodSource } from './foods';
import { emptyNutrients, scaleNutrients, type Nutrients } from './nutrients';

export type EntrySource = FoodSource | 'quick';

/** Up to six meals a day (Breakfast, Lunch, Dinner, Snacks by default). */
export const MAX_MEALS = 6;
export const DEFAULT_MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const;

export interface DiaryEntry {
  id: string;
  /** Local date, YYYY-MM-DD. */
  day: string;
  /** 0 to 5, in the person's meal order. */
  meal: number;
  foodId: string | null;
  source: EntrySource;
  barcode: string | null;
  name: string;
  brand: string | null;
  amount: number;
  unit: string;
  grams: number | null;
  /** For the amount eaten, not per 100 g. */
  nutrients: Nutrients;
  loggedAt: string;
}

export interface EntryPlace {
  id: string;
  day: string;
  meal: number;
  loggedAt: string;
}

function validMeal(meal: number): boolean {
  return Number.isInteger(meal) && meal >= 0 && meal < MAX_MEALS;
}

/** An entry for `amount` of a food in one of its units, or null if that doesn't measure. */
export function entryFromFood(food: Food, amount: number, unitKey: string, place: EntryPlace): DiaryEntry | null {
  if (!validMeal(place.meal)) return null;
  const m = measure(food, amount, unitKey);
  if (!m) return null;
  return {
    id: place.id,
    day: place.day,
    meal: place.meal,
    foodId: food.id,
    source: food.source,
    barcode: food.barcode,
    name: food.name,
    brand: food.brand,
    amount: m.amount,
    unit: m.unit.label,
    grams: m.grams,
    nutrients: m.nutrients,
    loggedAt: place.loggedAt,
  };
}

export interface QuickAdd {
  kcal: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  name?: string | null;
}

/** Calories, and macros if given, with no food behind them. */
export function quickAddEntry(q: QuickAdd, place: EntryPlace): DiaryEntry | null {
  if (!validMeal(place.meal) || !(q.kcal >= 0) || q.kcal > 20_000) return null;
  const macros = [q.proteinG, q.carbsG, q.fatG];
  if (macros.some((v) => v != null && !(v >= 0))) return null;
  const nutrients = { ...emptyNutrients(), kcal: q.kcal, proteinG: q.proteinG ?? null, carbsG: q.carbsG ?? null, fatG: q.fatG ?? null };
  return {
    id: place.id,
    day: place.day,
    meal: place.meal,
    foodId: null,
    source: 'quick',
    barcode: null,
    name: q.name?.trim() || 'Quick add',
    brand: null,
    amount: 1,
    unit: 'entry',
    grams: null,
    nutrients,
    loggedAt: place.loggedAt,
  };
}

/**
 * Copies of entries for another day (and, optionally, one meal), each with a
 * new id. Copying yesterday's breakfast, or a whole day, is this.
 */
export function copyEntries(
  entries: readonly DiaryEntry[],
  to: { day: string; meal?: number; loggedAt: string },
  newId: () => string,
): DiaryEntry[] {
  if (to.meal != null && !validMeal(to.meal)) return [];
  return [...entries]
    .sort((a, b) => a.meal - b.meal || a.loggedAt.localeCompare(b.loggedAt))
    .map((e) => ({ ...e, id: newId(), day: to.day, meal: to.meal ?? e.meal, loggedAt: to.loggedAt }));
}

/** The same entry with a new amount, its nutrients scaled to match. */
export function rescaleEntry(entry: DiaryEntry, amount: number): DiaryEntry | null {
  if (!(amount > 0) || !(entry.amount > 0)) return null;
  const factor = amount / entry.amount;
  return {
    ...entry,
    amount,
    grams: entry.grams == null ? null : Math.round(entry.grams * factor * 100) / 100,
    nutrients: scaleNutrients(entry.nutrients, factor),
  };
}
