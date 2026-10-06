// The app's real save arguments (a simulated 5K turned into an rpc_save_run
// call by src/domain/running/save.ts; see __tests__/runningSaveContract.test.ts)
// are accepted by the database and come back intact.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const input = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'save-run-5k.json'), 'utf8'),
);

const db = await freshDb();
const runner = await createUser(db, 'runner@example.com');

const names = Object.keys(input);
const sql = `select rpc_save_run(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as id`;
const values = names.map((k) => {
  const v = input[k];
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : k === 'p_splits' ? JSON.stringify(v) : v;
});

await asUser(db, runner, async () => {
  const err = await errorOf(() => db.query(sql, values));
  check('the database accepts what the app sends for a recorded 5K', err === null, err);

  const { rows } = await db.query(`select * from rpc_get_run($1)`, [input.p_id]);
  const run = rows[0];
  check('the run comes back', !!run, rows.length);
  check('the route comes back point for point', run?.polyline === input.p_polyline);
  check('every point keeps its time', JSON.stringify(run?.times) === JSON.stringify(input.p_times));
  check('altitudes survive within a centimetre', run?.alts?.every((a, i) => Math.abs(a - input.p_alts[i]) < 0.01));
  check('splits come back as sent', JSON.stringify(run?.splits) === JSON.stringify(input.p_splits));
  const sorted = (o) => JSON.stringify(Object.entries(o ?? {}).sort());
  check('best efforts come back as sent', sorted(run?.best_efforts) === sorted(input.p_best_efforts), run?.best_efforts);
  check('distance and times are stored exactly', run?.distance_m === input.p_distance_m &&
    run?.moving_seconds === input.p_moving_seconds && run?.elapsed_seconds === input.p_elapsed_seconds);

  const { rows: act } = await db.query(`select kind, distance, distance_unit, duration_seconds from activities where id = $1`, [input.p_id]);
  check('it shows up as a run in the activity log, in km', act[0]?.kind === 'run' && act[0]?.distance_unit === 'km' &&
    Math.abs(act[0]?.distance - input.p_distance_m / 1000) < 0.01 && act[0]?.duration_seconds === input.p_moving_seconds, act[0]);

  const replay = await errorOf(() => db.query(sql, values));
  check('a replayed save from the offline queue is harmless', replay === null, replay);
  const { rows: count } = await db.query(`select count(*)::int n from runs`);
  check('and creates no duplicate', count[0].n === 1, count[0]);
});

done();
