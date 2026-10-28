import fs from 'node:fs';
import path from 'node:path';

import { copyEntries, entryFromFood, quickAddEntry, rescaleEntry, type DiaryEntry } from '../src/domain/nutrition/entries';
import { defaultUnit, formatAmount, measure, unitsFor, type Food } from '../src/domain/nutrition/foods';
import {
  ageFromBirthYear,
  calorieGoal,
  isBelowFloor,
  macrosFromPercent,
  percentFromMacros,
  restingCalories,
} from '../src/domain/nutrition/goals';
import { foodKey, frequentFoods, recentFoods } from '../src/domain/nutrition/history';
import {
  emptyNutrients,
  energyIn,
  netCarbs,
  nutrientsFromRow,
  nutrientsToRow,
  scaleNutrients,
  sumNutrients,
  type Nutrients,
} from '../src/domain/nutrition/nutrients';
import { barcodeCandidates, canonicalBarcode, foodFromOpenFoodFacts } from '../src/domain/nutrition/openFoodFacts';
import { perServing, recipeItem, totalGrams } from '../src/domain/nutrition/recipes';
import { calorieBudget, dayTotal, goalFor, mealGoals, mealTotals, progressToward } from '../src/domain/nutrition/totals';

const n = (over: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...over });

/** USDA SR Legacy 173944, as the catalog holds it. */
const banana: Food = {
  id: 'banana',
  source: 'usda',
  barcode: null,
  name: 'Bananas, raw',
  brand: null,
  basis: '100g',
  servingLabel: null,
  servingG: null,
  servingMl: null,
  nutrients: n({ kcal: 89, carbsG: 22.8, fiberG: 2.6, sugarsG: 12.2, proteinG: 1.09, fatG: 0.33, potassiumMg: 358 }),
  portions: [
    { label: '1 cup, sliced', grams: 150 },
    { label: '1 medium (7" to 7-7/8" long)', grams: 118 },
  ],
};

/** A label typed in per serving, with no weight. */
const bar: Food = {
  id: 'bar',
  source: 'user',
  barcode: null,
  name: 'Protein bar',
  brand: 'Home',
  basis: 'serving',
  servingLabel: '1 bar',
  servingG: null,
  servingMl: null,
  nutrients: n({ kcal: 210, proteinG: 20, carbsG: 22, fatG: 7 }),
  portions: [],
};

const place = (over: Partial<{ id: string; day: string; meal: number; loggedAt: string }> = {}) => ({
  id: 'e1',
  day: '2026-10-28',
  meal: 0,
  loggedAt: '2026-10-28T08:00:00Z',
  ...over,
});

describe('nutrients', () => {
  it('scales every known amount and leaves unknown ones unknown', () => {
    const s = scaleNutrients(banana.nutrients, 1.18);
    expect(s.kcal).toBe(105.02);
    expect(s.potassiumMg).toBe(422.44);
    expect(s.sodiumMg).toBeNull();
  });

  it('adds known parts, and keeps a nutrient unknown only if every part is', () => {
    const total = sumNutrients([n({ kcal: 100, proteinG: 5 }), n({ kcal: 50, proteinG: null, fatG: 2 })]);
    expect(total).toMatchObject({ kcal: 150, proteinG: 5, fatG: 2, sodiumMg: null });
  });

  it('works out net carbs, never below zero', () => {
    expect(netCarbs({ carbsG: 22.8, fiberG: 2.6 })).toBe(20.2);
    expect(netCarbs({ carbsG: 2, fiberG: 5 })).toBe(0);
    expect(netCarbs({ carbsG: 10, fiberG: null })).toBe(10);
    expect(netCarbs({ carbsG: null, fiberG: 3 })).toBeNull();
  });

  it('shows energy in kcal or kJ', () => {
    expect(energyIn(100, 'kcal')).toBe(100);
    expect(energyIn(100, 'kj')).toBe(418);
  });

  it('maps to and from the database columns', () => {
    const row = nutrientsToRow(banana.nutrients);
    expect(row).toMatchObject({ kcal: 89, carbs_g: 22.8, potassium_mg: 358, sodium_mg: null });
    expect(nutrientsFromRow(row)).toEqual(banana.nutrients);
    expect(nutrientsFromRow({ kcal: 'lots' }).kcal).toBe(0);
  });
});

describe('measuring a food', () => {
  it('offers household portions first, then grams and ounces', () => {
    expect(unitsFor(banana).map((u) => u.label)).toEqual(['1 cup, sliced', '1 medium (7" to 7-7/8" long)', 'g', 'oz']);
    expect(defaultUnit(banana).label).toBe('1 cup, sliced');
  });

  it('turns a portion into grams and nutrients', () => {
    const m = measure(banana, 1, 'portion:1 medium (7" to 7-7/8" long)');
    expect(m?.grams).toBe(118);
    expect(m?.nutrients.kcal).toBe(105.02);
  });

  it('measures in ounces', () => {
    const m = measure(banana, 4, 'oz');
    expect(m?.grams).toBe(113.4);
    expect(m?.nutrients.kcal).toBeCloseTo(100.92, 2);
  });

  it('measures a per-serving food in servings only, unless its weight is known', () => {
    expect(unitsFor(bar).map((u) => u.key)).toEqual(['serving']);
    expect(measure(bar, 1.5, 'serving')?.nutrients.proteinG).toBe(30);
    expect(measure(bar, 50, 'g')).toBeNull();
    const weighed = { ...bar, servingG: 60 };
    expect(measure(weighed, 30, 'g')?.nutrients.kcal).toBe(105);
  });

  it('measures a drink by volume, with no weight', () => {
    const cola: Food = { ...banana, basis: '100ml', portions: [], servingLabel: '1 can', servingMl: 330, nutrients: n({ kcal: 42 }) };
    expect(unitsFor(cola).map((u) => u.label)).toEqual(['1 can', 'ml', 'fl oz']);
    const can = measure(cola, 1, 'serving');
    expect(can?.nutrients.kcal).toBe(138.6);
    expect(can?.grams).toBeNull();
    expect(measure(cola, 100, 'g')).toBeNull();
  });

  it('refuses nothing, a negative amount, and an absurd one', () => {
    expect(measure(banana, 0, 'g')).toBeNull();
    expect(measure(banana, -1, 'g')).toBeNull();
    expect(measure(banana, 1_000_000, 'g')).toBeNull();
  });

  it('writes amounts the way people say them', () => {
    expect(formatAmount(150, 'g')).toBe('150 g');
    expect(formatAmount(1, '1 medium')).toBe('1 medium');
    expect(formatAmount(2, '1 cup, sliced')).toBe('2 × 1 cup, sliced');
    expect(formatAmount(0.333333, 'oz')).toBe('0.33 oz');
  });
});

describe('diary entries', () => {
  it('copies the numbers for what was eaten into the entry', () => {
    const e = entryFromFood(banana, 2, 'portion:1 cup, sliced', place());
    expect(e).toMatchObject({ foodId: 'banana', source: 'usda', name: 'Bananas, raw', amount: 2, unit: '1 cup, sliced', grams: 300 });
    expect(e?.nutrients.kcal).toBe(267);
  });

  it('refuses a seventh meal or a unit the food lacks', () => {
    expect(entryFromFood(banana, 1, 'g', place({ meal: 6 }))).toBeNull();
    expect(entryFromFood(banana, 1, 'serving', place())).toBeNull();
  });

  it('quick-adds calories with optional macros', () => {
    const q = quickAddEntry({ kcal: 300, proteinG: 20 }, place({ meal: 3 }));
    expect(q).toMatchObject({ source: 'quick', name: 'Quick add', foodId: null, meal: 3 });
    expect(q?.nutrients).toMatchObject({ kcal: 300, proteinG: 20, carbsG: null });
    expect(quickAddEntry({ kcal: -1 }, place())).toBeNull();
    expect(quickAddEntry({ kcal: 100, fatG: -2 }, place())).toBeNull();
  });

  it('copies a meal to another day with new ids, in order', () => {
    const a = entryFromFood(banana, 1, 'g', place({ id: 'a', loggedAt: '2026-10-27T08:05:00Z' })) as DiaryEntry;
    const b = entryFromFood(bar, 1, 'serving', place({ id: 'b', loggedAt: '2026-10-27T08:00:00Z' })) as DiaryEntry;
    let i = 0;
    const copies = copyEntries([a, b], { day: '2026-10-28', meal: 2, loggedAt: '2026-10-28T12:00:00Z' }, () => `new${++i}`);
    expect(copies.map((c) => [c.id, c.name, c.day, c.meal])).toEqual([
      ['new1', 'Protein bar', '2026-10-28', 2],
      ['new2', 'Bananas, raw', '2026-10-28', 2],
    ]);
    expect(copies[0].nutrients).toEqual(b.nutrients);
  });

  it('rescales an entry when its amount changes', () => {
    const e = entryFromFood(banana, 1, 'portion:1 cup, sliced', place()) as DiaryEntry;
    const half = rescaleEntry(e, 0.5);
    expect(half?.grams).toBe(75);
    expect(half?.nutrients.kcal).toBe(66.75);
    expect(rescaleEntry(e, 0)).toBeNull();
  });
});

describe('the day', () => {
  const entries = [
    entryFromFood(banana, 1, 'portion:1 cup, sliced', place({ id: '1', meal: 0 })),
    entryFromFood(bar, 1, 'serving', place({ id: '2', meal: 2 })),
    quickAddEntry({ kcal: 300 }, place({ id: '3', meal: 2 })),
  ] as DiaryEntry[];

  it('totals each meal and the day', () => {
    expect(mealTotals(entries, 4).map((t) => t.kcal)).toEqual([133.5, 0, 510, 0]);
    expect(dayTotal(entries).kcal).toBe(643.5);
  });

  it('works out the budget, with exercise only when the setting is on', () => {
    expect(calorieBudget(2000, 643.5, 400, true)).toEqual({ goal: 2000, food: 644, exercise: 400, remaining: 1756 });
    expect(calorieBudget(2000, 643.5, 400, false).remaining).toBe(1356);
    expect(calorieBudget(null, 643.5, 400, true).remaining).toBeNull();
  });

  it('uses the goal in force on each day', () => {
    const goals = [{ startsOn: '2026-10-15', kcal: 1800 }, { startsOn: '2026-10-01', kcal: 2000 }];
    expect(goalFor(goals, '2026-10-10')?.kcal).toBe(2000);
    expect(goalFor(goals, '2026-10-15')?.kcal).toBe(1800);
    expect(goalFor(goals, '2026-09-30')).toBeNull();
  });

  it('shows progress on macros first, then other targets', () => {
    const goal = { startsOn: '2026-10-01', kcal: 2000, proteinG: 150, carbsG: 200, fatG: null, targets: { fiberG: 30 }, mealSplit: null };
    const p = progressToward(dayTotal(entries), goal);
    expect(p.map((x) => x.key)).toEqual(['carbsG', 'proteinG', 'fiberG']);
    expect(p[1].eaten).toBeCloseTo(21.64, 2);
    expect(p[2].fraction).toBeCloseTo(3.9 / 30, 3);
  });

  it('splits the calorie goal by meal when asked', () => {
    expect(mealGoals({ kcal: 2000, mealSplit: [25, 35, 30, 10] }, 4)).toEqual([500, 700, 600, 200]);
    expect(mealGoals({ kcal: 2000, mealSplit: [50, 50] }, 4)).toBeNull();
    expect(mealGoals({ kcal: 2000, mealSplit: null }, 4)).toBeNull();
  });
});

describe('goal calculator', () => {
  const adult = {
    weightKg: 80, heightCm: 180, birthYear: 1996, sex: 'male' as const, activity: 'moderate' as const,
    weeklyChangeKg: 0, today: '2026-10-28',
  };

  it('uses Mifflin-St Jeor for resting energy', () => {
    expect(restingCalories({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' })).toBe(1780);
    expect(restingCalories({ weightKg: 60, heightCm: 165, age: 30, sex: 'female' })).toBeCloseTo(1320.25, 2);
    // Halfway between the two without a sex given.
    expect(restingCalories({ weightKg: 80, heightCm: 180, age: 30, sex: null })).toBe(1697);
  });

  it('multiplies by the activity factor to maintain', () => {
    expect(calorieGoal(adult)).toEqual({ kcal: 2759, maintenance: 2759, resting: 1780, weeklyChangeKg: 0, notes: [] });
  });

  it('moves the goal by about 1,100 kcal a day per kilogram a week', () => {
    expect(calorieGoal({ ...adult, weeklyChangeKg: -0.5 })?.kcal).toBe(2209);
    expect(calorieGoal({ ...adult, weeklyChangeKg: 0.25 })?.kcal).toBe(3034);
  });

  it('caps the change at a kilogram a week', () => {
    const g = calorieGoal({ ...adult, weeklyChangeKg: -2 });
    expect(g?.weeklyChangeKg).toBe(-1);
    expect(g?.notes).toContain('change_capped');
  });

  it('offers nobody under 18 a weight-loss goal, counting the birthday as not yet', () => {
    const teen = calorieGoal({ ...adult, birthYear: 2010, weeklyChangeKg: -0.5 });
    expect(teen?.weeklyChangeKg).toBe(0);
    expect(teen?.notes).toContain('loss_not_offered_under_18');
    // Born in 2008, so 18 or about to be: still treated as 17 until 2027.
    expect(calorieGoal({ ...adult, birthYear: 2008, weeklyChangeKg: -0.5 })?.notes).toContain('loss_not_offered_under_18');
    expect(calorieGoal({ ...adult, birthYear: 2007, weeklyChangeKg: -0.5 })?.notes).toEqual([]);
    // Gaining is fine at any age the app allows.
    expect(calorieGoal({ ...adult, birthYear: 2010, weeklyChangeKg: 0.25 })?.notes).toEqual([]);
  });

  it('flags a goal below the calorie floor without refusing it', () => {
    const small = { ...adult, weightKg: 50, heightCm: 155, sex: 'female' as const, activity: 'sedentary' as const };
    const g = calorieGoal({ ...small, weeklyChangeKg: -1 });
    expect(g?.notes).toContain('below_floor');
    expect(g?.kcal).toBeGreaterThan(0);
    expect(isBelowFloor(1400, 'male')).toBe(true);
    expect(isBelowFloor(1400, 'female')).toBe(false);
    expect(isBelowFloor(1100, null)).toBe(true);
  });

  it('needs believable inputs, and an age the app allows', () => {
    expect(calorieGoal({ ...adult, weightKg: 5 })).toBeNull();
    expect(calorieGoal({ ...adult, heightCm: 400 })).toBeNull();
    expect(calorieGoal({ ...adult, birthYear: 2020 })).toBeNull();
  });

  it('counts age from the birth year', () => {
    expect(ageFromBirthYear(1996, '2026-10-28')).toBe(30);
    expect(ageFromBirthYear(1996, '2026-10-28', true)).toBe(29);
  });

  it('turns a percentage split into grams and back', () => {
    expect(macrosFromPercent(2000, { proteinPct: 30, carbsPct: 40, fatPct: 30 })).toEqual({ proteinG: 150, carbsG: 200, fatG: 67 });
    expect(macrosFromPercent(2000, { proteinPct: 30, carbsPct: 40, fatPct: 20 })).toBeNull();
    expect(percentFromMacros({ proteinG: 150, carbsG: 200, fatG: 67 })).toEqual({ proteinPct: 30, carbsPct: 40, fatPct: 30 });
  });
});

describe('recent and frequent foods', () => {
  const at = (id: string, food: Food, day: string, time: string) =>
    entryFromFood(food, 1, food === bar ? 'serving' : 'g', place({ id, day, loggedAt: `${day}T${time}:00Z` })) as DiaryEntry;
  const log = [
    at('1', banana, '2026-10-20', '08:00'),
    at('2', bar, '2026-10-26', '10:00'),
    at('3', banana, '2026-10-27', '08:00'),
    at('4', banana, '2026-10-27', '12:00'),
    at('5', bar, '2026-10-28', '10:00'),
    quickAddEntry({ kcal: 100 }, place({ id: '6', loggedAt: '2026-10-28T11:00:00Z' })) as DiaryEntry,
  ];

  it('lists each food once, newest first, without quick adds', () => {
    expect(recentFoods(log).map((e) => e.id)).toEqual(['5', '4']);
  });

  it('ranks by days eaten, not entries, since a date', () => {
    // Two days each: the tie goes to the one eaten more recently.
    expect(frequentFoods(log, '2026-10-01').map((f) => [f.entry.name, f.days])).toEqual([
      ['Protein bar', 2],
      ['Bananas, raw', 2],
    ]);
    expect(frequentFoods(log, '2026-10-26').map((f) => [f.entry.name, f.days])).toEqual([
      ['Protein bar', 2],
      ['Bananas, raw', 1],
    ]);
  });

  it('knows a food by id, then barcode, then name and brand', () => {
    expect(foodKey({ source: 'usda', foodId: 'x', barcode: '123', name: 'A', brand: null })).toBe('id:x');
    expect(foodKey({ source: 'off', foodId: null, barcode: '123', name: 'A', brand: null })).toBe('barcode:123');
    expect(foodKey({ source: 'user', foodId: null, barcode: null, name: ' Oats ', brand: 'Home' })).toBe('name:oats|home');
    expect(foodKey({ source: 'quick', foodId: null, barcode: null, name: 'Quick add', brand: null })).toBeNull();
  });
});

describe('recipes', () => {
  const items = [recipeItem(banana, 2, 'portion:1 medium (7" to 7-7/8" long)'), recipeItem(bar, 1, 'serving')];

  it('makes ingredients from foods', () => {
    expect(items[0]).toMatchObject({ name: 'Bananas, raw', grams: 236, unit: '1 medium (7" to 7-7/8" long)' });
  });

  it('divides the whole recipe by its servings', () => {
    const one = perServing(items as NonNullable<(typeof items)[number]>[], 4);
    expect(one?.kcal).toBeCloseTo((210.04 + 210) / 4, 2);
    expect(perServing([], 0)).toBeNull();
  });

  it('weighs the whole recipe only when every ingredient has a weight', () => {
    expect(totalGrams(items as NonNullable<(typeof items)[number]>[])).toBeNull();
    expect(totalGrams([items[0] as NonNullable<(typeof items)[number]>])).toBe(236);
  });
});

describe('Open Food Facts', () => {
  // Real responses, trimmed (Open Food Facts, ODbL): see fixtures/off/README.md.
  const off = (code: string) =>
    JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'off', `${code}.json`), 'utf8'));

  it('reads a product per 100 g, with minerals turned from grams into mg', () => {
    const result = foodFromOpenFoodFacts(off('737628064502'), '737628064502');
    if (!('food' in result)) throw new Error(result.problem);
    const f = result.food;
    expect(f).toMatchObject({
      // Asked for as the 12-digit UPC, listed as the 13-digit EAN.
      source: 'off', barcode: '0737628064502', brand: 'Simply Asia', basis: '100g', servingG: 52, servingMl: null,
    });
    expect(f.nutrients).toMatchObject({ kcal: 385, proteinG: 9.62, sodiumMg: 288, calciumMg: 38, ironMg: 0.69 });
    expect(measure(f, 1, 'serving')?.nutrients.kcal).toBeCloseTo(200.2, 1);
  });

  it('reads a drink per 100 ml, with its can as the serving', () => {
    const result = foodFromOpenFoodFacts(off('5449000000996'), '5449000000996');
    if (!('food' in result)) throw new Error(result.problem);
    expect(result.food).toMatchObject({ name: 'Coca-Cola Original', basis: '100ml', servingMl: 330, servingG: null });
    expect(measure(result.food, 1, 'serving')?.nutrients.kcal).toBeCloseTo(139.92, 2);
  });

  it('takes the first brand when several are listed', () => {
    const result = foodFromOpenFoodFacts(off('3017620422003'), '3017620422003');
    if (!('food' in result)) throw new Error(result.problem);
    expect(result.food.brand).toBe('Nutella');
    expect(result.food.nutrients.addedSugarsG).toBe(52.13);
  });

  it('works out calories from kJ, and sodium from salt, when only those are given', () => {
    const r = foodFromOpenFoodFacts(
      { status: 1, product: { product_name: 'Crackers', nutriments: { 'energy-kj_100g': 1840, 'salt_100g': 1.5 } } },
      '12345678',
    );
    if (!('food' in r)) throw new Error(r.problem);
    expect(r.food.nutrients.kcal).toBeCloseTo(439.77, 2);
    expect(r.food.nutrients.sodiumMg).toBe(600);
  });

  it('falls back to per-serving numbers when there are no per-100 g ones', () => {
    const r = foodFromOpenFoodFacts(
      { status: 1, product: { product_name: 'Bar', serving_size: '1 bar (40 g)', nutriments: { 'energy-kcal_serving': 180 } } },
      '12345678',
    );
    if (!('food' in r)) throw new Error(r.problem);
    expect(r.food).toMatchObject({ basis: 'serving', servingLabel: '1 bar (40 g)' });
    expect(r.food.nutrients.kcal).toBe(180);
  });

  it('says when a product is missing or has no nutrition', () => {
    expect(foodFromOpenFoodFacts({ status: 0 }, '12345678')).toEqual({ problem: 'not_found' });
    expect(foodFromOpenFoodFacts({ status: 1, product: { product_name: 'Water' } }, '12345678')).toEqual({ problem: 'no_nutrition' });
    expect(foodFromOpenFoodFacts({ status: 1, product: { nutriments: { 'energy-kcal_100g': 4000 } } }, '12345678')).toEqual({
      problem: 'no_nutrition',
    });
  });

  it('tries a UPC-A both ways, as iOS reports it with a leading zero', () => {
    expect(barcodeCandidates('0737628064502')).toEqual(['0737628064502', '737628064502']);
    expect(barcodeCandidates('737628064502')).toEqual(['737628064502', '0737628064502']);
    expect(barcodeCandidates('5449000000996')).toEqual(['5449000000996']);
    expect(barcodeCandidates('12ab')).toEqual([]);
  });

  it('keeps one form of each barcode, so a product always matches itself', () => {
    expect(canonicalBarcode('737628064502')).toBe('0737628064502');
    expect(canonicalBarcode('0737628064502')).toBe('0737628064502');
    expect(canonicalBarcode('96385074')).toBe('96385074');
    expect(canonicalBarcode('abc')).toBeNull();
  });
});
