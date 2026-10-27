// "Download my data" includes everything running stores (migration 0023),
// and deleting an account removes it all.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUser, check, createUser, done, freshDb } from './harness.mjs';

const base = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'save-run-5k.json'), 'utf8'),
);
const JSONB = new Set(['p_splits', 'p_best_efforts']);
const call = (fn, args) => {
  const names = Object.keys(args);
  return db.query(
    `select ${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as v`,
    names.map((k) => (JSONB.has(k) ? JSON.stringify(args[k]) : args[k])),
  );
};

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

await asUser(db, alice, async () => {
  await call('rpc_save_run', base);
  await call('rpc_add_privacy_zone', { p_lat: 47.9, p_lon: -97.0, p_radius_m: 300, p_label: 'Home' });
  await call('rpc_save_route', { p_activity_id: base.p_id, p_name: 'Lakeside loop' });
  await db.query(`insert into run_preferences (user_id, weekly_goal_m) values ($1, 20000)`, [alice]);

  const { rows } = await db.query(`select rpc_export_my_data() as data`);
  const data = rows[0].data;
  check('the export has her run', data.runs?.length === 1 && data.runs[0].activity_id === base.p_id, data.runs?.length);
  const route = data.runs[0].route;
  check('with its route as GeoJSON, every point kept',
    route?.type === 'LineString' && route.coordinates.length === base.p_times.length, route?.type);
  check('each point with its altitude', route.coordinates[5].length === 3);
  check('and its time alongside', JSON.stringify(data.runs[0].route_times) === JSON.stringify(base.p_times));
  check('her best efforts', data.run_best_efforts?.length === Object.keys(base.p_best_efforts).length);
  check('her privacy zone, readable', data.run_privacy_zones?.[0]?.label === 'Home' && data.run_privacy_zones[0].lat === 47.9,
    data.run_privacy_zones);
  check('her saved route', data.saved_routes?.[0]?.name === 'Lakeside loop' && data.saved_routes[0].route?.type === 'LineString');
  check('and her running settings', data.run_preferences?.weekly_goal_m === 20000);
  check('everything from before is still there', Array.isArray(data.activities) && data.activities.length === 1 && data.account != null);
});

await asUser(db, bob, async () => {
  const { rows } = await db.query(`select rpc_export_my_data() as data`);
  check('bob’s export has none of it', rows[0].data.runs.length === 0 && rows[0].data.run_privacy_zones.length === 0);
});

await asUser(db, alice, async () => {
  await db.query(`select rpc_delete_my_account()`);
});
const left = await db.query(
  `select (select count(*) from runs) + (select count(*) from run_best_efforts) + (select count(*) from run_privacy_zones)
        + (select count(*) from saved_routes) + (select count(*) from run_preferences) as n`,
);
check('deleting her account removes all of her running data', Number(left.rows[0].n) === 0, left.rows[0]);

done();
