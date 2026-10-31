// Saved meals and recipes (migration 0027): saved with their items in one
// call, saving again replaces the items, and nobody can save over someone
// else's meal or recipe, or turn another food into a recipe.
import { asAnon, asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

const { rows: [oats] } = await db.query(
  `insert into foods (source, source_ref, name, kcal, carbs_g, protein_g) values ('usda', '173904', 'Oats', 379, 67.7, 13.2) returning id`,
);
const item = (over = {}) => ({
  food_id: oats.id, source: 'usda', name: 'Oats', amount: 1, unit: '1 cup', grams: 81, kcal: 307, carbs_g: 54.8, protein_g: 10.7,
  ...over,
});
const call = (sql, params) => db.query(sql, params);
const MEAL = '8a1e1f00-0000-4000-8000-000000000001';
const RECIPE = '8a1e1f00-0000-4000-8000-000000000002';

// --- Saved meals -------------------------------------------------------------------
await asUser(db, alice, async () => {
  const saved = await call(`select rpc_save_meal($1, $2, $3::jsonb) as id`, [MEAL, '  Usual breakfast ', JSON.stringify([
    item(), item({ food_id: null, source: 'quick', name: 'Coffee with milk', unit: 'entry', grams: null, kcal: 40 }),
  ])]);
  check('a meal saves with its foods, in order', saved.rows[0].id === MEAL);
  const items = (await call(`select name, position, user_id from saved_meal_items where saved_meal_id = $1 order by position`, [MEAL])).rows;
  check('both foods, in the order given, as hers', items.length === 2 && items[1].name === 'Coffee with milk'
    && items.every((i) => i.user_id === alice), items);
  check('the name is trimmed', (await call(`select name from saved_meals where id = $1`, [MEAL])).rows[0].name === 'Usual breakfast');

  await call(`select rpc_save_meal($1, $2, $3::jsonb)`, [MEAL, 'Breakfast', JSON.stringify([item({ amount: 2, kcal: 614 })])]);
  const again = (await call(`select amount from saved_meal_items where saved_meal_id = $1`, [MEAL])).rows;
  check('saving again replaces its foods', again.length === 1 && again[0].amount === 2, again);

  const empty = await errorOf(() => call(`select rpc_save_meal($1, 'Nothing', '[]'::jsonb)`, ['8a1e1f00-0000-4000-8000-000000000009']));
  check('a meal needs at least one food', empty != null && /at least one food/.test(empty), empty);
});

await asUser(db, bob, async () => {
  const takeover = await errorOf(() =>
    call(`select rpc_save_meal($1, 'Mine now', $2::jsonb)`, [MEAL, JSON.stringify([item()])]));
  check('someone else cannot save over her meal', takeover != null, takeover);
});
const still = (await call(`select name, user_id from saved_meals where id = $1`, [MEAL])).rows[0];
check('which is still hers, as it was', still.user_id === alice && still.name === 'Breakfast', still);
const anonMeal = await asAnon(db, () => errorOf(() => call(`select rpc_save_meal($1, 'x', $2::jsonb)`, [MEAL, JSON.stringify([item()])])));
check('signed-out callers cannot save meals', anonMeal != null && /permission denied/.test(anonMeal), anonMeal);

// --- Recipes ---------------------------------------------------------------------
const recipe = (over = {}) => ({
  id: RECIPE, name: 'Overnight oats', servings: 2, serving_g: 150, kcal: 330, carbs_g: 45, protein_g: 14, ...over,
});
await asUser(db, alice, async () => {
  const saved = await call(`select rpc_save_recipe($1::jsonb, $2::jsonb) as id`, [
    JSON.stringify(recipe()),
    JSON.stringify([item(), item({ food_id: null, name: 'Milk, 2%', unit: '1 cup', grams: 244, kcal: 122 })]),
  ]);
  check('a recipe saves as one of her foods', saved.rows[0].id === RECIPE);
  const food = (await call(`select owner_id, source, basis, serving_label, servings from foods where id = $1`, [RECIPE])).rows[0];
  check('per serving, with its servings', food.owner_id === alice && food.source === 'recipe' && food.basis === 'serving'
    && food.serving_label === '1 serving' && food.servings === 2, food);
  check('with both ingredients', Number((await call(`select count(*) as n from recipe_items where recipe_id = $1`, [RECIPE])).rows[0].n) === 2);

  await call(`select rpc_save_recipe($1::jsonb, $2::jsonb)`, [JSON.stringify(recipe({ servings: 4, kcal: 165 })), JSON.stringify([item()])]);
  const after = (await call(`select servings, kcal from foods where id = $1`, [RECIPE])).rows[0];
  const items = Number((await call(`select count(*) as n from recipe_items where recipe_id = $1`, [RECIPE])).rows[0].n);
  check('saving again updates it and replaces the ingredients', after.servings === 4 && after.kcal === 165 && items === 1, { after, items });

  const { rows: [bar] } = await call(
    `insert into foods (owner_id, source, name, basis, serving_label, kcal) values ($1, 'user', 'Protein bar', 'serving', '1 bar', 210) returning id`,
    [alice],
  );
  const convert = await errorOf(() => call(`select rpc_save_recipe($1::jsonb, $2::jsonb)`, [
    JSON.stringify(recipe({ id: bar.id })), JSON.stringify([item()]),
  ]));
  check('another kind of food cannot be turned into a recipe', convert != null && /isn't a recipe/.test(convert), convert);
  const noItems = await errorOf(() => call(`select rpc_save_recipe($1::jsonb, '[]'::jsonb)`, [JSON.stringify(recipe())]));
  check('a recipe needs an ingredient', noItems != null && /at least one ingredient/.test(noItems), noItems);
});

await asUser(db, bob, async () => {
  const takeover = await errorOf(() => call(`select rpc_save_recipe($1::jsonb, $2::jsonb)`, [
    JSON.stringify(recipe({ name: 'Bob’s oats' })), JSON.stringify([item()]),
  ]));
  check('someone else cannot save over her recipe', takeover != null, takeover);
  check('or see its ingredients', Number((await call(`select count(*) as n from recipe_items`)).rows[0].n) === 0);
});
const name = (await call(`select name, owner_id from foods where id = $1`, [RECIPE])).rows[0];
check('which is still hers', name.owner_id === alice && name.name === 'Overnight oats', name);

done();
