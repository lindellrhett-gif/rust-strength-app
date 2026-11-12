import fs from 'node:fs';
import path from 'node:path';

// Plain CommonJS build scripts, not app code — required rather than imported.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mapDataset, mapFood, portionLabel } = require('../scripts/usda');

/**
 * The catalog loader reads real FoodData Central downloads. The fixtures are
 * real records from them (public domain), trimmed to the nutrients the app
 * keeps, so a change in how USDA lays out a file shows up here first.
 */
const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'usda', `${name}.json`), 'utf8'));

describe('SR Legacy', () => {
  const { dataset, foods, skipped } = mapDataset(fixture('sr_legacy'));
  const banana = foods.find((f: { name: string }) => f.name === 'Bananas, raw');

  it('reads every food in the file', () => {
    expect(dataset).toBe('sr_legacy');
    expect(foods).toHaveLength(2);
    expect(skipped).toEqual({});
  });

  it('keeps the label nutrients per 100 g, by nutrient id', () => {
    expect(banana).toMatchObject({
      source_ref: '173944',
      kcal: 89,
      protein_g: 1.09,
      fat_g: 0.33,
      carbs_g: 22.8,
      fiber_g: 2.6,
      sugars_g: 12.2,
      potassium_mg: 358,
    });
    expect(banana.added_sugars_g).toBeNull();
  });

  it('keeps a few more in extra, with the dataset', () => {
    expect(banana.extra).toMatchObject({ dataset: 'sr_legacy', vitamin_c_mg: 8.7 });
  });

  it('turns household measures into portions people recognise, in USDA’s own order', () => {
    // The file lists them shuffled; sequenceNumber is the order USDA intends.
    expect(banana.portions).toEqual([
      { label: '1 cup, mashed', grams: 225 },
      { label: '1 cup, sliced', grams: 150 },
      { label: '1 extra small (less than 6" long)', grams: 81 },
      { label: '1 small (6" to 6-7/8" long)', grams: 101 },
      { label: '1 medium (7" to 7-7/8" long)', grams: 118 },
      { label: '1 large (8" to 8-7/8" long)', grams: 136 },
      { label: '1 extra large (9" or longer)', grams: 152 },
      { label: '1 NLEA serving', grams: 126 },
    ]);
  });
});

describe('Survey (FNDDS)', () => {
  const { foods, skipped } = mapDataset(fixture('survey'));

  it('uses the portion descriptions as they are', () => {
    expect(foods[0].name).toBe('Banana, raw');
    expect(foods[0].portions.map((p: { label: string }) => p.label)).toEqual([
      '1 banana', '1 slice', '1 cup', '1 cup, mashed', '1 linear inch',
    ]);
  });

  it('drops "Quantity not specified", which is not a portion', () => {
    expect(foods[0].portions.some((p: { label: string }) => /quantity/i.test(p.label))).toBe(false);
  });

  it('leaves out a food with no nutrients', () => {
    expect(foods).toHaveLength(1);
    expect(skipped).toEqual({ no_energy: 1 });
  });
});

describe('Foundation', () => {
  const { foods, skipped } = mapDataset(fixture('foundation'));

  it('takes energy from the specific Atwater factors when there is no plain energy value', () => {
    expect(foods).toHaveLength(1);
    expect(foods[0].name).toBe('Apples, red delicious, with skin, raw');
    expect(foods[0].kcal).toBe(55.6);
  });

  it('skips the label-law reference amount, which nobody measures out', () => {
    expect(foods[0].portions).toEqual([]);
  });

  it('counts what it left out: an empty entry and a food with no energy (table salt)', () => {
    expect(skipped).toEqual({ empty: 1, no_energy: 1 });
  });
});

describe('mapFood', () => {
  const base = {
    fdcId: 1,
    description: 'Test food',
    foodNutrients: [{ nutrient: { id: 1008 }, amount: 100 }],
  };

  it('refuses energy no food could have', () => {
    expect(mapFood({ ...base, foodNutrients: [{ nutrient: { id: 1008 }, amount: 5000 }] }, 'sr_legacy')).toEqual({
      skip: 'invalid',
    });
  });

  it('ignores negative and missing amounts', () => {
    const { food } = mapFood(
      {
        ...base,
        foodNutrients: [
          { nutrient: { id: 1008 }, amount: 100 },
          { nutrient: { id: 1003 }, amount: -1 },
          { nutrient: { id: 1004 } },
        ],
      },
      'sr_legacy',
    );
    expect(food.protein_g).toBeNull();
    expect(food.fat_g).toBeNull();
  });

  it('shortens a name past 200 characters rather than failing the import', () => {
    const { food } = mapFood({ ...base, description: 'x'.repeat(300) }, 'survey');
    expect(food.name).toHaveLength(200);
    expect(food.name.endsWith('…')).toBe(true);
  });

  it('needs an id and a name', () => {
    expect(mapFood({ ...base, fdcId: undefined }, 'survey')).toEqual({ skip: 'invalid' });
    expect(mapFood({ ...base, description: ' ' }, 'survey')).toEqual({ skip: 'invalid' });
  });
});

describe('portionLabel', () => {
  it('names a measured unit with its modifier', () => {
    expect(portionLabel({ amount: 2, measureUnit: { name: 'tablespoon' }, modifier: '', gramWeight: 33.9 })).toBe(
      '2 tablespoon',
    );
    expect(portionLabel({ amount: 1, measureUnit: { name: 'cup' }, modifier: 'chopped', gramWeight: 160 })).toBe(
      '1 cup, chopped',
    );
  });

  it('rejects portions with no weight, and Survey modifier codes', () => {
    expect(portionLabel({ amount: 1, modifier: 'cup', gramWeight: 0 })).toBeNull();
    expect(portionLabel({ amount: 1, modifier: '10205', measureUnit: { name: 'undetermined' }, gramWeight: 150 })).toBeNull();
  });
});

it('refuses a file that is not a FoodData Central download', () => {
  expect(() => mapDataset({ BrandedFoods: [] })).toThrow(/Not a FoodData Central download/);
});
