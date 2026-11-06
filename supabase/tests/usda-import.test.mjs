// Loading the USDA catalog (migration 0027, scripts/import-usda.js): rows
// from the real fixtures go in through import_usda_foods, a second load
// updates rather than duplicates, and only the service role can run it.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asAnon, asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const require = createRequire(import.meta.url);
const { mapDataset } = require('../../scripts/usda.js');

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '__tests__', 'fixtures', 'usda');
const rows = ['sr_legacy', 'survey', 'foundation'].flatMap(
  (name) => mapDataset(JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'))).foods,
);

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');

const asService = async (fn) => {
  await db.exec(`set role service_role`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
  }
};
const load = (foods) => db.query(`select import_usda_foods($1::jsonb) as n`, [JSON.stringify(foods)]);

const first = await asService(() => load(rows));
check('the service role loads every food', first.rows[0].n === rows.length, first.rows[0]);
const banana = (await db.query(`select * from foods where source_ref = '173944'`)).rows[0];
check('as a shared USDA food per 100 g', banana?.source === 'usda' && banana.owner_id === null && banana.basis === '100g'
  && banana.kcal === 89, banana);
const portions = await db.query(`select label, grams from food_portions where food_id = $1 order by position`, [banana.id]);
check('with its portions in order', portions.rows.length === 8 && portions.rows[0].label === '1 cup, mashed', portions.rows);

// Alice logs it; then the catalog is loaded again with a corrected value.
await asUser(db, alice, async () => {
  await db.query(
    `insert into diary_entries (user_id, day, meal, food_id, source, name, amount, unit, grams, kcal)
     values ($1, '2026-10-28', 0, $2, 'usda', 'Bananas, raw', 1, '1 medium', 118, 105)`,
    [alice, banana.id],
  );
});
const corrected = rows.map((r) =>
  r.source_ref === '173944' ? { ...r, kcal: 90, portions: r.portions.slice(0, 2) } : r);
await asService(() => load(corrected));
const after = (await db.query(`select id, kcal from foods where source_ref = '173944'`)).rows;
check('loading again updates the food instead of adding a second', after.length === 1 && after[0].kcal === 90, after);
check('and keeps its id, so diary entries still point at it', after[0].id === banana.id);
const portionsAfter = await db.query(`select count(*)::int as n from food_portions where food_id = $1`, [banana.id]);
check('its portions are replaced, not added to', portionsAfter.rows[0].n === 2, portionsAfter.rows);
const entry = (await db.query(`select food_id, kcal from diary_entries`)).rows[0];
check('the logged entry keeps the number it was logged with', entry.food_id === banana.id && entry.kcal === 105, entry);
check('nothing else was duplicated', Number((await db.query(`select count(*) as n from foods`)).rows[0].n) === rows.length);

const asAlice = await asUser(db, alice, () => errorOf(() => load(rows)));
check('a signed-in user cannot load the catalog', asAlice != null && /permission denied/.test(asAlice), asAlice);
const asNobody = await asAnon(db, () => errorOf(() => load(rows)));
check('nor can a signed-out caller', asNobody != null && /permission denied/.test(asNobody), asNobody);
const noId = await asService(() => errorOf(() => load([{ ...rows[0], source_ref: 'abc' }])));
check('a row without a USDA id is refused', noId != null && /FoodData Central id/.test(noId), noId);

done();
