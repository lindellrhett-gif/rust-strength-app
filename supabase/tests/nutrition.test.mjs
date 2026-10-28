// The food diary (migration 0027): the shared USDA catalog is read-only,
// everything you log is yours alone, entries keep their own numbers, search
// works on word starts, weigh-ins update the profile, and "Download my data"
// and deleting an account cover all of it.
import { asAnon, asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

/** Insert a row from an object, returning the inserted row. */
const insert = async (table, row) => {
  const cols = Object.keys(row);
  const { rows } = await db.query(
    `insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    cols.map((c) => row[c]),
  );
  return rows[0];
};
const count = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].n);

// The catalog, as the import script writes it (the service role skips RLS;
// so does the test's own superuser connection).
const chicken = await insert('foods', {
  source: 'usda', source_ref: '171477', name: 'Chicken, broiler, breast, meat only, roasted',
  basis: '100g', kcal: 165, protein_g: 31, fat_g: 3.6, carbs_g: 0,
});
const banana = await insert('foods', {
  source: 'usda', source_ref: '173944', name: 'Bananas, raw', basis: '100g',
  kcal: 89, carbs_g: 22.8, fiber_g: 2.6, sugars_g: 12.2, protein_g: 1.1, fat_g: 0.3, potassium_mg: 358,
});
await insert('food_portions', { food_id: banana.id, label: '1 medium (7" to 7-7/8" long)', grams: 118 });

const ownFood = (owner, extra = {}) => ({
  owner_id: owner, source: 'user', name: 'Protein bar', brand: 'Home', basis: 'serving',
  serving_label: '1 bar', kcal: 210, protein_g: 20, ...extra,
});
const entry = (user, extra = {}) => ({
  user_id: user, day: '2026-10-28', meal: 0, source: 'usda', food_id: banana.id,
  name: 'Bananas, raw', amount: 1, unit: '1 medium', grams: 118, kcal: 105, carbs_g: 26.9, ...extra,
});

// --- 1. The shared catalog -----------------------------------------------------
let alicesBar;
await asUser(db, alice, async () => {
  check('signed in, you can read the catalog', (await count(`select count(*) as n from foods where owner_id is null`)) === 2);
  check('and its portions', (await count(`select count(*) as n from food_portions where food_id = $1`, [banana.id])) === 1);

  const shared = await errorOf(() => insert('foods', { ...ownFood(null), source: 'usda' }));
  check('you cannot add to the catalog', shared != null && /row-level security/.test(shared), shared);
  await db.query(`update foods set kcal = 1 where id = $1`, [chicken.id]);
  await db.query(`delete from foods where id = $1`, [chicken.id]);
  const portion = await errorOf(() => insert('food_portions', { food_id: chicken.id, label: '1 breast', grams: 172 }));
  check('or add a portion to a catalog food', portion != null && /row-level security/.test(portion), portion);

  alicesBar = await insert('foods', ownFood(alice));
  check('you can add your own food', alicesBar?.owner_id === alice);
});
const untouched = await db.query(`select kcal from foods where id = $1`, [chicken.id]);
check('nor change or delete a catalog food', untouched.rows[0]?.kcal === 165, untouched.rows);

const anonRead = await asAnon(db, () => errorOf(() => db.query(`select * from foods`)));
check('signed-out callers cannot read foods at all', anonRead != null && /permission denied/.test(anonRead), anonRead);
const anonSearch = await asAnon(db, () => errorOf(() => db.query(`select * from rpc_search_foods('banana')`)));
check('or search them', anonSearch != null && /permission denied/.test(anonSearch), anonSearch);

const ownerless = await errorOf(() => insert('foods', { ...ownFood(null) }));
check('a food that is not USDA must have an owner', ownerless != null && /foods_shared_is_usda/.test(ownerless), ownerless);

// --- 2. Your own foods and recipes are yours -----------------------------------
let recipe;
await asUser(db, alice, async () => {
  recipe = await insert('foods', {
    owner_id: alice, source: 'recipe', name: 'Banana oat bake', basis: 'serving', serving_label: '1 serving',
    servings: 4, kcal: 240, protein_g: 9,
  });
  await insert('recipe_items', {
    recipe_id: recipe.id, position: 0, food_id: banana.id, name: 'Bananas, raw', amount: 2, unit: '1 medium',
    grams: 236, kcal: 210,
  });
  await insert('recipe_items', {
    recipe_id: recipe.id, position: 1, food_id: alicesBar.id, name: 'Protein bar', amount: 1, unit: '1 bar',
    kcal: 210, protein_g: 20,
  });
  const notRecipe = await errorOf(() =>
    insert('recipe_items', { recipe_id: alicesBar.id, name: 'Oats', amount: 50, unit: 'g', grams: 50, kcal: 190 }));
  check('ingredients only go on a recipe', notRecipe != null && /row-level security/.test(notRecipe), notRecipe);
});

await asUser(db, bob, async () => {
  check('someone else cannot see your foods',
    (await count(`select count(*) as n from foods where owner_id is not null`)) === 0);
  check('or your recipe’s ingredients', (await count(`select count(*) as n from recipe_items`)) === 0);
  await db.query(`update foods set kcal = 1 where id = $1`, [alicesBar.id]);
  const theirs = await errorOf(() => insert('diary_entries', entry(bob, { food_id: alicesBar.id, source: 'user' })));
  check('or log your private food', theirs != null && /row-level security/.test(theirs), theirs);
  const asAlice = await errorOf(() => insert('diary_entries', entry(alice)));
  check('or write a diary entry as you', asAlice != null && /row-level security/.test(asAlice), asAlice);
  const searched = await db.query(`select name from rpc_search_foods('protein')`);
  check('or find your foods in search', searched.rows.length === 0, searched.rows);
});
const bar = await db.query(`select kcal from foods where id = $1`, [alicesBar.id]);
check('or change them', bar.rows[0]?.kcal === 210, bar.rows);

// --- 3. Search -----------------------------------------------------------------
await asUser(db, alice, async () => {
  const names = async (q) => (await db.query(`select name from rpc_search_foods($1)`, [q])).rows.map((r) => r.name);
  check('word starts match: "chick bre" finds chicken breast',
    JSON.stringify(await names('chick bre')) === JSON.stringify([chicken.name]), await names('chick bre'));
  check('case and punctuation do not matter', (await names('BANANAS!!')).includes('Bananas, raw'));
  check('plural and singular both match', (await names('banana')).includes('Bananas, raw'), await names('banana'));
  check('the brand counts too', (await names('home')).includes('Protein bar'), await names('home'));
  await insert('foods', ownFood(alice, { name: 'Chicken salad wrap', brand: null, serving_label: '1 wrap' }));
  const both = await names('chicken');
  check('your own foods come first', both[0] === 'Chicken salad wrap' && both.length === 2, both);
  check('nothing to search for returns nothing', (await names('   ')).length === 0 && (await names('%%')).length === 0);
  check('only stop words returns nothing, without an error', (await names('the and')).length === 0);
});

// --- 4. The diary --------------------------------------------------------------
const entryId = '6f9619ff-8b86-4d11-b42d-00c04fc964ff';
await asUser(db, alice, async () => {
  await insert('diary_entries', entry(alice, { id: entryId }));
  const replay = await errorOf(() => insert('diary_entries', entry(alice, { id: entryId })));
  check('a replayed entry hits its own id instead of logging twice', replay != null && /duplicate key/.test(replay), replay);
  await insert('diary_entries', entry(alice, { meal: 2, food_id: alicesBar.id, source: 'user', name: 'Protein bar',
    unit: '1 bar', grams: null, kcal: 210, protein_g: 20, carbs_g: null }));
  await insert('diary_entries', entry(alice, { meal: 3, food_id: null, source: 'quick', name: 'Quick add',
    unit: 'entry', grams: null, kcal: 300, carbs_g: null }));

  for (const [label, bad] of [
    ['a seventh meal', { meal: 6 }],
    ['negative calories', { kcal: -5 }],
    ['an amount of zero', { amount: 0 }],
    ['a barcode with letters', { barcode: '12345abc' }],
    ['a day in 1999', { day: '1999-12-31' }],
  ]) {
    const err = await errorOf(() => insert('diary_entries', entry(alice, bad)));
    check(`the diary refuses ${label}`, err != null && /violates check constraint/.test(err), err);
  }

  const day = await db.query(
    `select count(*)::int as n, sum(kcal)::int as kcal from diary_entries where day = '2026-10-28'`);
  check('the day adds up from the entries alone', day.rows[0].n === 3 && day.rows[0].kcal === 615, day.rows);

  await db.query(`delete from foods where id = $1`, [alicesBar.id]);
  const kept = await db.query(`select food_id, kcal, protein_g from diary_entries where name = 'Protein bar'`);
  check('deleting a food keeps the entry and its numbers',
    kept.rows.length === 1 && kept.rows[0].food_id === null && kept.rows[0].kcal === 210 && kept.rows[0].protein_g === 20,
    kept.rows);
  const recipeKept = await db.query(
    `select food_id, kcal from recipe_items where recipe_id = $1 order by position`, [recipe.id]);
  check('a recipe keeps an ingredient, and its numbers, when that food goes',
    recipeKept.rows.length === 2 && recipeKept.rows[1].food_id === null && recipeKept.rows[1].kcal === 210,
    recipeKept.rows);

  const meal = await insert('saved_meals', { user_id: alice, name: 'Usual breakfast' });
  await insert('saved_meal_items', { saved_meal_id: meal.id, user_id: alice, position: 0, food_id: banana.id,
    source: 'usda', name: 'Bananas, raw', amount: 1, unit: '1 medium', grams: 118, kcal: 105 });
  await insert('diary_days', { user_id: alice, day: '2026-10-28', note: 'Long run day', completed_at: new Date().toISOString() });
  await insert('water_logs', { user_id: alice, day: '2026-10-28', ml: 500 });
  const flood = await errorOf(() => insert('water_logs', { user_id: alice, day: '2026-10-28', ml: 9000 }));
  check('9 litres in one go is refused', flood != null && /violates check constraint/.test(flood), flood);
});

await asUser(db, bob, async () => {
  const seen = await count(
    `select (select count(*) from diary_entries) + (select count(*) from saved_meals)
          + (select count(*) from saved_meal_items) + (select count(*) from diary_days)
          + (select count(*) from water_logs) as n`);
  check('nobody else can see your diary, meals, notes or water', seen === 0, seen);
  await db.query(`delete from diary_entries`);
});
check('or delete it', (await count(`select count(*) as n from diary_entries where user_id = $1`, [alice])) === 3);

// --- 5. Weigh-ins update the profile, in its unit ------------------------------
const bodyweight = async (user) =>
  (await db.query(`select body_weight from profiles where user_id = $1`, [user])).rows[0].body_weight;
await asUser(db, alice, async () => {
  await insert('body_weights', { user_id: alice, measured_on: '2026-10-28', kg: 80 });
  check('a weigh-in becomes the profile bodyweight, in lb', (await bodyweight(alice)) === 176.4, await bodyweight(alice));
  await insert('body_weights', { user_id: alice, measured_on: '2026-10-01', kg: 90 });
  check('an older weigh-in does not replace a newer one', (await bodyweight(alice)) === 176.4, await bodyweight(alice));
  const twice = await errorOf(() => insert('body_weights', { user_id: alice, measured_on: '2026-10-28', kg: 79 }));
  check('one weigh-in a day', twice != null && /duplicate key/.test(twice), twice);
  await db.query(`delete from body_weights where measured_on = '2026-10-28'`);
  check('deleting the latest goes back to the one before', (await bodyweight(alice)) === 198.4, await bodyweight(alice));
  const light = await errorOf(() => insert('body_weights', { user_id: alice, measured_on: '2026-10-02', kg: 12 }));
  check('12 kg is refused, as in run calories', light != null && /violates check constraint/.test(light), light);
});
await db.query(`update profiles set unit = 'kg' where user_id = $1`, [bob]);
await asUser(db, bob, async () => {
  await insert('body_weights', { user_id: bob, measured_on: '2026-10-28', kg: 70.25 });
  check('and in kg for someone who uses kg', (await bodyweight(bob)) === 70.3, await bodyweight(bob));
});

// --- 6. Goals by date, and settings --------------------------------------------
await asUser(db, alice, async () => {
  await insert('nutrition_goals', { user_id: alice, starts_on: '2026-10-01', kcal: 2000, protein_g: 150 });
  await insert('nutrition_goals', { user_id: alice, starts_on: '2026-10-15', kcal: 1800, protein_g: 150,
    targets: JSON.stringify({ fiber_g: 30 }) });
  const goalOn = async (day) => (await db.query(
    `select kcal from nutrition_goals where starts_on <= $1 order by starts_on desc limit 1`, [day])).rows[0]?.kcal;
  check('a past day keeps the goal it had', (await goalOn('2026-10-10')) === 2000);
  check('and a later day gets the new one', (await goalOn('2026-10-20')) === 1800);
  check('before any goal there is none', (await goalOn('2026-09-01')) === undefined);

  const settings = await insert('nutrition_settings', { user_id: alice });
  check('settings start as four meals in kcal, adding exercise back',
    settings.meal_names.join() === 'Breakfast,Lunch,Dinner,Snacks' && settings.energy_unit === 'kcal' && settings.add_exercise,
    settings);
  const seven = await errorOf(() => db.query(
    `update nutrition_settings set meal_names = array['a','b','c','d','e','f','g'] where user_id = $1`, [alice]));
  check('no more than six meals', seven != null && /violates check constraint/.test(seven), seven);
});

// --- 7. Download my data, then delete the account ------------------------------
await asUser(db, alice, async () => {
  const { rows } = await db.query(`select rpc_export_my_data() as data`);
  const data = rows[0].data;
  const n = data.nutrition;
  check('the export has a nutrition section', n != null && typeof n === 'object');
  check('with her diary entries', n.diary_entries?.length === 3, n.diary_entries?.length);
  check('her own foods and recipe, not the catalog',
    n.foods?.length === 2 && n.foods.every((f) => f.owner_id === alice) && n.recipe_items?.length === 2, n.foods);
  check('without the search index', n.foods.every((f) => !('search' in f)));
  check('her saved meal with its items', n.saved_meals?.[0]?.name === 'Usual breakfast' && n.saved_meals[0].items.length === 1);
  check('her notes, water, weigh-ins, goals and settings',
    n.diary_days?.length === 1 && n.water_logs?.length === 1 && n.body_weights?.length === 1
      && n.goals?.length === 2 && n.settings?.user_id === alice, n);
  check('and everything from before is still there',
    Array.isArray(data.runs) && 'subscription' in data && data.account != null, Object.keys(data));
});
await asUser(db, bob, async () => {
  const { rows } = await db.query(`select rpc_export_my_data() as data`);
  const n = rows[0].data.nutrition;
  check('bob’s export has none of hers', n.diary_entries.length === 0 && n.foods.length === 0 && n.body_weights.length === 1);
});

await asUser(db, alice, async () => {
  await db.query(`select rpc_delete_my_account()`);
});
const left = await count(
  `select (select count(*) from foods where owner_id is not null) + (select count(*) from recipe_items)
        + (select count(*) from diary_entries) + (select count(*) from saved_meals)
        + (select count(*) from saved_meal_items) + (select count(*) from diary_days)
        + (select count(*) from water_logs) + (select count(*) from body_weights where user_id = $1)
        + (select count(*) from nutrition_goals) + (select count(*) from nutrition_settings) as n`,
  [alice],
);
check('deleting her account removes all of her nutrition data', left === 0, left);
check('the catalog stays', (await count(`select count(*) as n from foods where source = 'usda'`)) === 2);
check('and so does bob’s weigh-in', (await count(`select count(*) as n from body_weights where user_id = $1`, [bob])) === 1);

done();
