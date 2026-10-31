/**
 * Saved meals: foods logged together in one tap ("Usual breakfast"). Pure,
 * no I/O.
 *
 * Each item keeps its own copy of the numbers, like a diary entry, so a saved
 * meal logs the same food every time even if the food is later edited.
 */

import type { DiaryEntry, EntrySource } from './entries';
import { MAX_MEALS } from './entries';
import { sumNutrients, type Nutrients } from './nutrients';

export interface SavedMealItem {
  foodId: string | null;
  source: EntrySource;
  barcode: string | null;
  name: string;
  brand: string | null;
  amount: number;
  unit: string;
  grams: number | null;
  nutrients: Nutrients;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
}

export const MAX_SAVED_MEAL_ITEMS = 100;
export const SAVED_MEAL_NAME_MAX = 80;

/** A meal's entries as the items of a saved meal, in the order they were logged. */
export function itemsFromEntries(entries: readonly DiaryEntry[]): SavedMealItem[] {
  return [...entries]
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
    .slice(0, MAX_SAVED_MEAL_ITEMS)
    .map((e) => ({
      foodId: e.foodId,
      source: e.source,
      barcode: e.barcode,
      name: e.name,
      brand: e.brand,
      amount: e.amount,
      unit: e.unit,
      grams: e.grams,
      nutrients: e.nutrients,
    }));
}

/** Diary entries for a saved meal, logged into one meal of one day, each with a new id. */
export function entriesFromSavedMeal(
  meal: SavedMeal,
  place: { day: string; meal: number; loggedAt: string },
  newId: () => string,
): DiaryEntry[] {
  if (!Number.isInteger(place.meal) || place.meal < 0 || place.meal >= MAX_MEALS) return [];
  return meal.items.map((item) => ({ ...item, id: newId(), day: place.day, meal: place.meal, loggedAt: place.loggedAt }));
}

export function savedMealTotal(meal: SavedMeal): Nutrients {
  return sumNutrients(meal.items.map((i) => i.nutrients));
}

/** A saved meal's name, tidied, or null if it can't be used. */
export function cleanMealName(typed: string): string | null {
  const name = typed.replace(/\s+/g, ' ').trim();
  return name && name.length <= SAVED_MEAL_NAME_MAX ? name : null;
}
