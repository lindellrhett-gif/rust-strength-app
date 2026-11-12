import fs from 'node:fs';
import path from 'node:path';

import type { DiaryEntry } from '../src/domain/nutrition/entries';
import { entryFromFood, quickAddEntry } from '../src/domain/nutrition/entries';
import { draftFromFood, emptyDraft, foodFromDraft, type FoodDraft } from '../src/domain/nutrition/foodForm';
import type { Food } from '../src/domain/nutrition/foods';
import { measure } from '../src/domain/nutrition/foods';
import { emptyNutrients, type Nutrients } from '../src/domain/nutrition/nutrients';
import { measureLine, parseLine, recipeFromHtml, searchTermFor, servingsFrom } from '../src/domain/nutrition/recipeImport';
import { recipeFood, recipeItem, type RecipeItem } from '../src/domain/nutrition/recipes';
import { cleanMealName, entriesFromSavedMeal, itemsFromEntries, savedMealTotal } from '../src/domain/nutrition/savedMeals';

const n = (over: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...over });
const usda = (name: string, nutrients: Partial<Nutrients>, portions: Food['portions'] = []): Food => ({
  id: name, source: 'usda', barcode: null, name, brand: null, basis: '100g', servingLabel: null, servingG: null,
  servingMl: null, nutrients: n(nutrients), portions,
});

const draft = (over: Partial<FoodDraft> = {}, nutrients: Partial<Record<string, string>> = {}): FoodDraft => {
  const d = emptyDraft();
  return { ...d, name: 'Protein bar', servingLabel: '1 bar', ...over, nutrients: { ...d.nutrients, kcal: '210', ...nutrients } };
};

describe('creating a food from a label', () => {
  it('needs only a name and calories; the rest can stay blank', () => {
    const result = foodFromDraft(draft());
    if ('problems' in result) throw new Error(JSON.stringify(result.problems));
    expect(result.food).toMatchObject({ name: 'Protein bar', basis: 'serving', servingLabel: '1 bar', brand: null, barcode: null });
    expect(result.food.nutrients).toMatchObject({ kcal: 210, proteinG: null });
  });

  it('reads the numbers as typed, commas and all', () => {
    const result = foodFromDraft(draft({ servingSize: '60' }, { proteinG: '20', fatG: '7,5', sodiumMg: '180' }));
    if ('problems' in result) throw new Error('unexpected problems');
    expect(result.food.nutrients).toMatchObject({ proteinG: 20, fatG: 7.5, sodiumMg: 180 });
    expect(result.food.servingG).toBe(60);
  });

  it('stores a UPC in the one form barcodes are kept in', () => {
    const result = foodFromDraft(draft({ barcode: '737628064502' }));
    expect('food' in result && result.food.barcode).toBe('0737628064502');
  });

  it('says what to fix', () => {
    const result = foodFromDraft(draft({ name: ' ', barcode: '12ab', servingLabel: '' }, { kcal: '', fatG: 'lots' }));
    expect('problems' in result && result.problems.map((p) => p.field).sort()).toEqual(
      ['barcode', 'fatG', 'kcal', 'name', 'servingLabel'].sort());
  });

  it('refuses what 100 g can’t hold, but allows a big serving', () => {
    const per100 = foodFromDraft(draft({ basis: '100g' }, { kcal: '1200', fatG: '120' }));
    expect('problems' in per100 && per100.problems.map((p) => p.field)).toEqual(['kcal', 'fatG']);
    const serving = foodFromDraft(draft({ basis: 'serving' }, { kcal: '1200', fatG: '120' }));
    expect('food' in serving).toBe(true);
  });

  it('keeps a drink’s serving in millilitres', () => {
    const result = foodFromDraft(draft({ basis: '100ml', servingLabel: '1 can', servingSize: '330' }, { kcal: '42' }));
    if ('problems' in result) throw new Error('unexpected problems');
    expect(result.food).toMatchObject({ basis: '100ml', servingMl: 330, servingG: null });
  });

  it('round-trips a food through the form to edit it', () => {
    const food: Food = {
      id: 'x', source: 'off', barcode: '0737628064502', name: 'Thai peanut noodle kit', brand: 'Simply Asia', basis: '100g',
      servingLabel: '1/3 package (52 g)', servingG: 52, servingMl: null, nutrients: n({ kcal: 385, proteinG: 9.62, sodiumMg: 288 }), portions: [],
    };
    const again = foodFromDraft(draftFromFood(food));
    if ('problems' in again) throw new Error(JSON.stringify(again.problems));
    expect(again.food).toMatchObject({ name: food.name, brand: 'Simply Asia', barcode: food.barcode, basis: '100g', servingG: 52 });
    expect(again.food.nutrients).toEqual(food.nutrients);
  });
});

describe('saved meals', () => {
  const oats = usda('Oats', { kcal: 379, carbsG: 67.7 }, [{ label: '1 cup', grams: 81 }]);
  const at = (id: string, time: string) => ({ id, day: '2026-10-28', meal: 0, loggedAt: `2026-10-28T${time}:00Z` });
  const entries = [
    quickAddEntry({ kcal: 40, name: 'Coffee with milk' }, at('2', '07:35')) as DiaryEntry,
    entryFromFood(oats, 1, 'portion:1 cup', at('1', '07:30')) as DiaryEntry,
  ];

  it('saves a meal’s foods in the order they were logged, with their numbers', () => {
    const items = itemsFromEntries(entries);
    expect(items.map((i) => i.name)).toEqual(['Oats', 'Coffee with milk']);
    expect(items[0]).toMatchObject({ foodId: 'Oats', amount: 1, unit: '1 cup', grams: 81 });
    expect(savedMealTotal({ id: 'm', name: 'Breakfast', items }).kcal).toBeCloseTo(347, 0);
  });

  it('logs a saved meal into any meal of any day, each food a new entry', () => {
    let i = 0;
    const logged = entriesFromSavedMeal(
      { id: 'm', name: 'Breakfast', items: itemsFromEntries(entries) },
      { day: '2026-10-29', meal: 2, loggedAt: '2026-10-29T18:00:00Z' },
      () => `n${++i}`,
    );
    expect(logged.map((e) => [e.id, e.name, e.day, e.meal])).toEqual([
      ['n1', 'Oats', '2026-10-29', 2],
      ['n2', 'Coffee with milk', '2026-10-29', 2],
    ]);
    expect(entriesFromSavedMeal({ id: 'm', name: 'x', items: [] }, { day: 'd', meal: 6, loggedAt: '' }, () => 'z')).toEqual([]);
  });

  it('tidies the name', () => {
    expect(cleanMealName('  Usual   breakfast ')).toBe('Usual breakfast');
    expect(cleanMealName('  ')).toBeNull();
    expect(cleanMealName('x'.repeat(81))).toBeNull();
  });
});

describe('recipes', () => {
  const oats = usda('Oats', { kcal: 379, carbsG: 67.7, proteinG: 13.2 }, [{ label: '1 cup', grams: 81 }]);
  const milk = usda('Milk, 2%', { kcal: 50, proteinG: 3.3 }, [{ label: '1 cup', grams: 244 }]);
  const bar: Food = { ...oats, id: 'bar', source: 'user', basis: 'serving', servingLabel: '1 bar', portions: [], nutrients: n({ kcal: 210 }) };

  it('is a food per serving, with a weight when every ingredient has one', () => {
    const items = [recipeItem(oats, 2, 'portion:1 cup'), recipeItem(milk, 2, 'portion:1 cup')] as RecipeItem[];
    const food = recipeFood({ id: 'r', name: ' Overnight  oats ', servings: 4, items });
    expect(food).toMatchObject({ id: 'r', source: 'recipe', name: 'Overnight oats', basis: 'serving', servingLabel: '1 serving', servingG: 162.5 });
    expect(food?.nutrients.kcal).toBeCloseTo((379 * 1.62 + 50 * 4.88) / 4, 1);
    expect(measure(food as Food, 1, 'serving')?.nutrients.kcal).toBe(food?.nutrients.kcal);
  });

  it('has no weight when an ingredient has none', () => {
    const items = [recipeItem(oats, 1, 'portion:1 cup'), recipeItem(bar, 1, 'serving')] as RecipeItem[];
    expect(recipeFood({ id: 'r', name: 'Mix', servings: 2, items })?.servingG).toBeNull();
  });

  it('needs a name, an ingredient and servings', () => {
    const items = [recipeItem(oats, 1, 'g')] as RecipeItem[];
    expect(recipeFood({ id: 'r', name: '', servings: 2, items })).toBeNull();
    expect(recipeFood({ id: 'r', name: 'x', servings: 2, items: [] })).toBeNull();
    expect(recipeFood({ id: 'r', name: 'x', servings: 0, items })).toBeNull();
  });
});

describe('importing a recipe from a page', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'recipes', 'wordpress-recipe.html'), 'utf8');

  it('finds the recipe inside a WordPress-style graph, past other JSON-LD', () => {
    const recipe = recipeFromHtml(html);
    expect(recipe?.name).toBe('Simple Banana Oat Bake & Berries');
    expect(recipe?.servings).toBe(6);
    expect(recipe?.lines).toEqual([
      '2 cups rolled oats',
      '2 large bananas, mashed',
      '1 ½ cups milk',
      '1 (14 oz) can coconut milk',
      '2 tbsp maple syrup',
      'For the topping:',
      '1 cup blueberries',
      'Pinch of salt',
    ]);
  });

  it('says so when a page has no recipe, or broken data', () => {
    expect(recipeFromHtml('<html><body>No recipe here</body></html>')).toBeNull();
    expect(recipeFromHtml('<script type="application/ld+json">{not json</script>')).toBeNull();
  });

  it('reads the number of servings however it is written', () => {
    expect(servingsFrom('4')).toBe(4);
    expect(servingsFrom('Makes 12 cookies')).toBe(12);
    expect(servingsFrom(['8', '8 slices'])).toBe(8);
    expect(servingsFrom(3)).toBe(3);
    expect(servingsFrom('a crowd')).toBeNull();
  });

  it('splits a line into amount, unit and food, and spots headings', () => {
    expect(parseLine('1 ½ cups milk')).toMatchObject({ quantity: 1.5, unit: 'cup', description: 'milk', isHeading: false });
    expect(parseLine('3-4 cloves garlic')).toMatchObject({ quantity: 3.5, unit: 'clove' });
    expect(parseLine('For the topping:').isHeading).toBe(true);
    expect(parseLine('Pinch of salt').quantity).toBeNull();
  });

  it('searches for the food without its preparation', () => {
    expect(searchTermFor(parseLine('2 large bananas, mashed'))).toBe('bananas');
    expect(searchTermFor(parseLine('1 (14 oz) can coconut milk'))).toBe('coconut milk');
    expect(searchTermFor(parseLine('1 cup all-purpose flour, sifted'))).toBe('all-purpose flour');
  });

  describe('measuring a line in the matched food', () => {
    const oats = usda('Oats', { kcal: 379 }, [{ label: '1 cup', grams: 81 }, { label: '1 tbsp', grams: 5 }]);
    const banana = usda('Bananas, raw', { kcal: 89 }, [
      { label: '1 cup, sliced', grams: 150 },
      { label: '1 large (8" to 8-7/8" long)', grams: 136 },
      { label: '1 medium (7" to 7-7/8" long)', grams: 118 },
    ]);
    const syrup: Food = { ...oats, basis: '100ml', portions: [], nutrients: n({ kcal: 260 }) };

    it('a cup or spoon in the food’s own household measure', () => {
      expect(measureLine(oats, parseLine('2 cups rolled oats'))).toEqual({ amount: 2, unitKey: 'portion:1 cup' });
      expect(measureLine(oats, parseLine('3 tablespoons oats'))).toEqual({ amount: 3, unitKey: 'portion:1 tbsp' });
    });

    it('a size word in the matching portion', () => {
      expect(measureLine(banana, parseLine('2 large bananas, mashed'))).toEqual({
        amount: 2, unitKey: 'portion:1 large (8" to 8-7/8" long)',
      });
    });

    it('a count in the first portion that isn’t a cup or spoon', () => {
      expect(measureLine(banana, parseLine('3 bananas'))).toEqual({ amount: 3, unitKey: 'portion:1 large (8" to 8-7/8" long)' });
    });

    it('weights in grams, and a can by its stated weight', () => {
      expect(measureLine(oats, parseLine('200 g oats'))).toEqual({ amount: 200, unitKey: 'g' });
      expect(measureLine(oats, parseLine('1 lb oats'))).toEqual({ amount: 453.59, unitKey: 'g' });
      expect(measureLine(oats, parseLine('4 oz oats'))).toEqual({ amount: 4, unitKey: 'oz' });
      expect(measureLine(oats, parseLine('1 (14 oz) can coconut milk'))).toEqual({ amount: 396.89, unitKey: 'g' });
    });

    it('volume for a drink measured per 100 ml', () => {
      expect(measureLine(syrup, parseLine('2 tbsp maple syrup'))).toEqual({ amount: 29.57, unitKey: 'ml' });
    });

    it('leaves it to the person when it can’t tell', () => {
      expect(measureLine(oats, parseLine('Pinch of salt'))).toBeNull();
      expect(measureLine(syrup, parseLine('1 large syrup'))).toBeNull();
    });
  });
});
