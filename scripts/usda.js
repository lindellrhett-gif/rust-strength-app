/**
 * Turns USDA FoodData Central downloads into rows for the `foods` and
 * `food_portions` tables (migration 0027). Pure: no files, no network.
 *
 * Three datasets, all generic foods with household portions, all public
 * domain (CC0); USDA asks that FoodData Central be credited as the source:
 *   Foundation    {"FoundationFoods": [...]}   analytical data, few foods
 *   SR Legacy     {"SRLegacyFoods": [...]}     the old Standard Reference
 *   Survey FNDDS  {"SurveyFoods": [...]}       foods as people report eating them
 *
 * Every value is per 100 g. Nutrients are matched by FoodData Central's
 * nutrient id, which is stable across datasets, not by name or number.
 */

/** Label nutrients: column name, then the ids to try in order. */
const NUTRIENTS = {
  // Foundation foods mostly give energy from Atwater factors instead of 1008.
  // The specific factors are the more accurate of the two.
  kcal: [1008, 2048, 2047],
  fat_g: [1004],
  sat_fat_g: [1258],
  trans_fat_g: [1257],
  cholesterol_mg: [1253],
  sodium_mg: [1093],
  carbs_g: [1005],
  fiber_g: [1079],
  // "Total Sugars" (SR Legacy, Survey) and "Sugars, Total" (Foundation).
  sugars_g: [2000, 1063],
  added_sugars_g: [1235],
  protein_g: [1003],
  vitamin_d_mcg: [1114],
  calcium_mg: [1087],
  iron_mg: [1089],
  potassium_mg: [1092],
};

/**
 * A few more that diaries commonly show, kept in `foods.extra`. Not the
 * hundred-odd USDA can list: the free database plan has 500 MB in all.
 */
const EXTRA = {
  mono_fat_g: 1292,
  poly_fat_g: 1293,
  vitamin_a_mcg: 1106,
  vitamin_c_mg: 1162,
  magnesium_mg: 1090,
  zinc_mg: 1095,
  vitamin_b12_mcg: 1178,
  caffeine_mg: 1057,
  alcohol_g: 1018,
};

const DATASETS = {
  FoundationFoods: 'foundation',
  SRLegacyFoods: 'sr_legacy',
  SurveyFoods: 'survey',
};

/** Pure fat is about 900 kcal per 100 g; anything well past that is an error. */
const MAX_KCAL_PER_100G = 1000;

const NAME_MAX = 200;
const LABEL_MAX = 80;
const MAX_PORTION_G = 10000;

/** 1 → "1", 0.5 → "0.5", 1.25 → "1.25". */
function formatAmount(n) {
  return String(Math.round(n * 1000) / 1000);
}

function amountsById(food) {
  const byId = new Map();
  for (const entry of food.foodNutrients || []) {
    const id = entry && entry.nutrient && entry.nutrient.id;
    const amount = entry && entry.amount;
    if (typeof id === 'number' && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) {
      if (!byId.has(id)) byId.set(id, amount);
    }
  }
  return byId;
}

/**
 * A portion's label as people read it: "1 cup", "2 tablespoon",
 * "1 cup, sliced". Null for portions that aren't usable.
 */
function portionLabel(portion) {
  if (!portion || !(portion.gramWeight > 0) || portion.gramWeight > MAX_PORTION_G) return null;
  const description = (portion.portionDescription || '').trim();
  if (description) {
    // Survey foods list "Quantity not specified" alongside the real portions.
    return /quantity not specified/i.test(description) ? null : description;
  }
  const unit = portion.measureUnit && portion.measureUnit.name;
  const amount = typeof portion.amount === 'number' && portion.amount > 0 ? formatAmount(portion.amount) : '1';
  const modifier = (portion.modifier || '').trim();
  // RACC is the label-law reference amount, not something people measure out.
  if (unit === 'RACC') return null;
  if (unit && unit !== 'undetermined') {
    return modifier ? `${amount} ${unit}, ${modifier}` : `${amount} ${unit}`;
  }
  // SR Legacy keeps the whole measure in the modifier: "cup, sliced", "jar".
  // Survey modifiers are numeric codes, never labels.
  if (!modifier || /^\d+$/.test(modifier)) return null;
  return `${amount} ${modifier}`;
}

function portionsOf(food) {
  const seen = new Set();
  const out = [];
  const sorted = [...(food.foodPortions || [])].sort(
    (a, b) => (a && a.sequenceNumber != null ? a.sequenceNumber : 99) - (b && b.sequenceNumber != null ? b.sequenceNumber : 99),
  );
  for (const portion of sorted) {
    const raw = portionLabel(portion);
    if (!raw) continue;
    const label = raw.length > LABEL_MAX ? `${raw.slice(0, LABEL_MAX - 1).trimEnd()}…` : raw;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, grams: Math.round(portion.gramWeight * 100) / 100 });
  }
  return out;
}

/**
 * One FoodData Central food as a `foods` row with its portions, or
 * `{ skip: reason }` when it can't be used.
 */
function mapFood(food, dataset) {
  if (!food || typeof food !== 'object') return { skip: 'empty' };
  const name = typeof food.description === 'string' ? food.description.trim() : '';
  if (!name || !Number.isInteger(food.fdcId)) return { skip: 'invalid' };

  const byId = amountsById(food);
  const row = {
    source_ref: String(food.fdcId),
    name: name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1).trimEnd()}…` : name,
  };
  for (const [column, ids] of Object.entries(NUTRIENTS)) {
    const id = ids.find((i) => byId.has(i));
    row[column] = id === undefined ? null : Math.round(byId.get(id) * 1000) / 1000;
  }
  if (row.kcal == null) return { skip: 'no_energy' };
  if (row.kcal > MAX_KCAL_PER_100G) return { skip: 'invalid' };

  const extra = { dataset };
  for (const [key, id] of Object.entries(EXTRA)) {
    if (byId.has(id)) extra[key] = Math.round(byId.get(id) * 1000) / 1000;
  }
  row.extra = extra;
  row.portions = portionsOf(food);
  return { food: row };
}

/**
 * A whole download (the parsed JSON) as rows, with a count of what was left
 * out and why.
 */
function mapDataset(json) {
  const key = Object.keys(DATASETS).find((k) => json && Array.isArray(json[k]));
  if (!key) {
    throw new Error(`Not a FoodData Central download: expected one of ${Object.keys(DATASETS).join(', ')}.`);
  }
  const dataset = DATASETS[key];
  const foods = [];
  const skipped = {};
  for (const raw of json[key]) {
    const result = mapFood(raw, dataset);
    if (result.food) foods.push(result.food);
    else skipped[result.skip] = (skipped[result.skip] || 0) + 1;
  }
  return { dataset, foods, skipped };
}

module.exports = { NUTRIENTS, EXTRA, mapFood, mapDataset, portionLabel };
