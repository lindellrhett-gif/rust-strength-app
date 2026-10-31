import { readFileSync } from 'node:fs';

import {
  diaryDayFromRow,
  entryFromRow,
  entryPatch,
  entryToRow,
  foodFromRow,
  goalFromRow,
  goalToRow,
  settingsFromRow,
  settingsToRow,
  weighInFromRow,
} from '../src/data/nutritionRows';
import { entryFromFood, quickAddEntry, type DiaryEntry } from '../src/domain/nutrition/entries';
import { NUTRIENT_COLUMNS } from '../src/domain/nutrition/nutrients';
import {
  cleanMealNames,
  DEFAULT_NUTRITION_SETTINGS,
  latestWeighIn,
  validWeighInKg,
  waterTotal,
} from '../src/domain/nutrition/settings';
import type { DiaryEntryRow, FoodRow, NutritionGoalRow, NutritionSettingsRow } from '../src/lib/database.types';

/**
 * The columns a table has in migration 0027, read from the SQL itself, so a
 * misspelt column in the app fails here instead of on someone's phone.
 */
const migration = readFileSync('supabase/migrations/0027_nutrition.sql', 'utf8');
function columnsOf(table: string): Set<string> {
  const start = migration.indexOf(`create table if not exists ${table} (`);
  if (start < 0) throw new Error(`no table ${table}`);
  const body = migration.slice(start, migration.indexOf('\n);', start));
  const cols = new Set<string>();
  for (const line of body.split('\n').slice(1)) {
    const m = /^\s+([a-z_0-9]+)\s+(uuid|text|real|int|smallint|date|timestamptz|jsonb|boolean|tsvector|nutrient_amount|text\[\])/.exec(line);
    if (m) cols.add(m[1]);
  }
  return cols;
}

const foodRow: FoodRow = {
  id: 'f1',
  owner_id: null,
  source: 'usda',
  source_ref: '173944',
  barcode: null,
  name: 'Bananas, raw',
  brand: null,
  basis: '100g',
  serving_label: null,
  serving_g: null,
  serving_ml: null,
  servings: null,
  extra: { dataset: 'sr_legacy' },
  search: null,
  created_at: '2026-10-28T00:00:00Z',
  kcal: 89,
  fat_g: 0.33,
  sat_fat_g: 0.112,
  trans_fat_g: 0,
  cholesterol_mg: 0,
  sodium_mg: 1,
  carbs_g: 22.8,
  fiber_g: 2.6,
  sugars_g: 12.2,
  added_sugars_g: null,
  protein_g: 1.09,
  vitamin_d_mcg: 0,
  calcium_mg: 5,
  iron_mg: 0.26,
  potassium_mg: 358,
};

describe('the app writes only columns that exist', () => {
  const place = { id: 'e1', day: '2026-10-28', meal: 1, loggedAt: '2026-10-28T12:00:00Z' };
  const food = foodFromRow(foodRow, [{ id: 'p', food_id: 'f1', label: '1 cup, sliced', grams: 150, position: 0 }]);

  it('a diary entry', () => {
    const entry = entryFromFood(food, 1, 'portion:1 cup, sliced', place) as DiaryEntry;
    const cols = columnsOf('diary_entries');
    for (const key of Object.keys(entryToRow(entry, 'u1'))) expect(cols).toContain(key);
    for (const key of Object.keys(entryPatch(entry))) expect(cols).toContain(key);
  });

  it('every nutrient, in every table that carries them', () => {
    for (const table of ['foods', 'diary_entries', 'saved_meal_items', 'recipe_items']) {
      const cols = columnsOf(table);
      for (const column of Object.values(NUTRIENT_COLUMNS)) expect(cols).toContain(column);
    }
  });

  it('settings and goals', () => {
    const settingsCols = columnsOf('nutrition_settings');
    const all = settingsToRow({ ...DEFAULT_NUTRITION_SETTINGS, heightCm: 180, birthYear: 1996, sex: 'male' });
    for (const key of Object.keys(all)) expect(settingsCols).toContain(key);
    const goalCols = columnsOf('nutrition_goals');
    const goal = goalToRow(
      { startsOn: '2026-10-01', kcal: 2000, proteinG: 150, carbsG: 200, fatG: 67, targets: { fiberG: 30 }, mealSplit: null },
      'u1',
      'percent',
    );
    for (const key of Object.keys(goal)) expect(goalCols).toContain(key);
  });
});

describe('rows to the app’s shapes', () => {
  it('reads a catalog food with its portions, in order, ignoring other foods’ portions', () => {
    const food = foodFromRow(foodRow, [
      { id: 'b', food_id: 'f1', label: '1 medium', grams: 118, position: 1 },
      { id: 'a', food_id: 'f1', label: '1 cup, sliced', grams: 150, position: 0 },
      { id: 'c', food_id: 'other', label: '1 slice', grams: 30, position: 0 },
    ]);
    expect(food).toMatchObject({ id: 'f1', source: 'usda', basis: '100g', name: 'Bananas, raw' });
    expect(food.nutrients).toMatchObject({ kcal: 89, potassiumMg: 358, addedSugarsG: null });
    expect(food.portions).toEqual([
      { label: '1 cup, sliced', grams: 150 },
      { label: '1 medium', grams: 118 },
    ]);
  });

  it('round-trips a diary entry', () => {
    const entry = quickAddEntry({ kcal: 300, proteinG: 20 }, { id: 'q1', day: '2026-10-28', meal: 3, loggedAt: '2026-10-28T15:00:00Z' }) as DiaryEntry;
    const row = { ...entryToRow(entry, 'u1'), created_at: '2026-10-28T15:00:01Z' } as DiaryEntryRow;
    expect(entryFromRow(row)).toEqual(entry);
  });

  it('gives defaults to someone with no settings yet', () => {
    expect(settingsFromRow(null)).toEqual(DEFAULT_NUTRITION_SETTINGS);
    // A copy, so changing it can't change the defaults.
    settingsFromRow(null).mealNames.push('Fifth');
    expect(DEFAULT_NUTRITION_SETTINGS.mealNames).toHaveLength(4);
  });

  it('reads settings, and only changes what was given', () => {
    const row: NutritionSettingsRow = {
      user_id: 'u1',
      meal_names: ['Breakfast', 'Lunch', 'Dinner'],
      energy_unit: 'kj',
      add_exercise: false,
      net_carbs: true,
      water_goal_ml: 2500,
      height_cm: 180,
      birth_year: 1996,
      sex_for_calculator: null,
      activity_level: 'moderate',
      goal_weight_kg: 78,
      weekly_change_kg: -0.25,
      updated_at: '2026-10-28T00:00:00Z',
    };
    expect(settingsFromRow(row)).toMatchObject({ mealNames: ['Breakfast', 'Lunch', 'Dinner'], energyUnit: 'kj', activity: 'moderate' });
    expect(settingsToRow({ netCarbs: false })).toEqual({ net_carbs: false });
    expect(settingsToRow({ sex: null })).toEqual({ sex_for_calculator: null });
  });

  it('keeps only nutrient targets it knows, both ways', () => {
    const row: NutritionGoalRow = {
      id: 'g1', user_id: 'u1', starts_on: '2026-10-01', kcal: 2000, protein_g: 150, carbs_g: null, fat_g: null,
      macro_mode: 'grams', targets: { fiber_g: 30, sodium_mg: 2300, mystery: 5, sugars_g: 'lots' },
      meal_split: [25, 35, 30, 10], created_at: '2026-10-01T00:00:00Z',
    };
    const goal = goalFromRow(row);
    expect(goal).toMatchObject({ startsOn: '2026-10-01', kcal: 2000, proteinG: 150, mealSplit: [25, 35, 30, 10] });
    expect(goal.targets).toEqual({ fiberG: 30, sodiumMg: 2300 });
    expect(goalToRow(goal, 'u1', 'grams').targets).toEqual({ fiber_g: 30, sodium_mg: 2300 });
    expect(goalFromRow({ ...row, meal_split: ['a'] }).mealSplit).toBeNull();
  });

  it('reads a day with no row as no note, not complete', () => {
    expect(diaryDayFromRow(null)).toEqual({ note: null, completedAt: null });
  });

  it('reads a weigh-in', () => {
    expect(weighInFromRow({ id: 'w', user_id: 'u1', measured_on: '2026-10-28', kg: 80.5, created_at: '' })).toEqual({
      id: 'w', measuredOn: '2026-10-28', kg: 80.5,
    });
  });
});

describe('settings, water and weigh-ins', () => {
  it('tidies meal names, and refuses none, seven, or a name too long', () => {
    expect(cleanMealNames(['  Breakfast ', '', 'Second   breakfast', 'Dinner'])).toEqual(['Breakfast', 'Second breakfast', 'Dinner']);
    expect(cleanMealNames(['', ' '])).toBeNull();
    expect(cleanMealNames(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBeNull();
    expect(cleanMealNames(['x'.repeat(31)])).toBeNull();
  });

  it('adds up water', () => {
    expect(waterTotal([
      { id: '1', day: 'd', ml: 240, loggedAt: '' },
      { id: '2', day: 'd', ml: 500, loggedAt: '' },
    ])).toBe(740);
    expect(waterTotal([])).toBe(0);
  });

  it('finds the latest weigh-in by date, whatever order they come in', () => {
    expect(latestWeighIn([
      { id: 'a', measuredOn: '2026-10-01', kg: 82 },
      { id: 'b', measuredOn: '2026-10-28', kg: 80 },
      { id: 'c', measuredOn: '2026-10-15', kg: 81 },
    ])?.id).toBe('b');
    expect(latestWeighIn([])).toBeNull();
  });

  it('accepts the same weights as the database', () => {
    expect(validWeighInKg(80)).toBe(true);
    expect(validWeighInKg(12)).toBe(false);
    expect(validWeighInKg(Number.NaN)).toBe(false);
  });
});
