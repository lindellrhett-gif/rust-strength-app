// Saved routes (migration 0022): save a run as a route, run it again, and
// compare attempts. Each person's routes are their own.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

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
const second = '7a0b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const third = '8b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';
let routeId;

await asUser(db, alice, async () => {
  await call('rpc_save_run', base);

  const unnamed = await errorOf(() => call('rpc_save_route', { p_activity_id: base.p_id, p_name: '  ' }));
  check('a route needs a name', unnamed != null && /name/.test(unnamed), unnamed);

  const { rows } = await call('rpc_save_route', { p_activity_id: base.p_id, p_name: ' Lakeside loop ' });
  routeId = rows[0].v;
  check('alice saves her run as a route', typeof routeId === 'string');
  const { rows: run } = await db.query(`select route_id from rpc_get_run($1)`, [base.p_id]);
  check('the run it came from is its first attempt', run[0].route_id === routeId, run[0]);

  // Run it again, faster, following the route.
  await call('rpc_save_run', {
    ...base, p_id: second, p_performed_at: '2026-09-28T13:00:00.000Z', p_route_id: routeId,
    p_moving_seconds: base.p_moving_seconds - 60, p_elapsed_seconds: base.p_elapsed_seconds - 60,
    p_moving_times: base.p_moving_times.map((t) => Math.max(0, Math.min(t, base.p_moving_seconds - 60))),
    p_times: base.p_times.map((t) => Math.min(t, base.p_elapsed_seconds - 60)),
    p_best_efforts: {},
  });
  // And once without choosing it, linked afterwards.
  await call('rpc_save_run', { ...base, p_id: third, p_performed_at: '2026-09-29T13:00:00.000Z' });
  await call('rpc_set_run_route', { p_activity_id: third, p_route_id: routeId });

  const { rows: list } = await db.query(`select * from rpc_saved_routes()`);
  check('her routes list it with three attempts', list.length === 1 && list[0].attempts === 3, list[0]);
  check('and her best time on it', list[0].best_seconds === base.p_moving_seconds - 60, list[0].best_seconds);
  check('with a light outline for the list', typeof list[0].outline === 'string' && list[0].outline.length > 4);

  const { rows: detail } = await db.query(`select * from rpc_saved_route($1)`, [routeId]);
  check('the route keeps the run’s distance and line',
    detail[0].name === 'Lakeside loop' && detail[0].distance_m === base.p_distance_m && detail[0].polyline.length > 100, detail[0]?.name);

  const { rows: attempts } = await db.query(`select * from rpc_route_attempts($1)`, [routeId]);
  check('attempts come fastest first', attempts.length === 3 && attempts[0].activity_id === second, attempts.map((a) => a.activity_id));

  await call('rpc_set_run_route', { p_activity_id: third, p_route_id: null });
  const { rows: after } = await db.query(`select attempts from rpc_saved_routes()`);
  check('a run can be unlinked again', after[0].attempts === 2, after[0]);
});

await asUser(db, bob, async () => {
  const { rows } = await db.query(`select * from rpc_saved_routes()`);
  check('bob sees none of alice’s routes', rows.length === 0, rows);
  const { rows: one } = await db.query(`select * from rpc_saved_route($1)`, [routeId]);
  check('not even by id', one.length === 0, one);
  await call('rpc_save_run', { ...base, p_id: '9c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f' });
  const borrowed = await errorOf(() =>
    call('rpc_save_run', { ...base, p_id: 'ad3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a', p_route_id: routeId }));
  check('bob can’t record a run on alice’s route', borrowed != null && /Route not found/.test(borrowed), borrowed);
  const linked = await errorOf(() =>
    call('rpc_set_run_route', { p_activity_id: '9c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', p_route_id: routeId }));
  check('or link one to it', linked != null && /Route not found/.test(linked), linked);
  await db.query(`delete from saved_routes where id = $1`, [routeId]);
});

await asUser(db, alice, async () => {
  const { rows } = await db.query(`select * from rpc_saved_routes()`);
  check('bob couldn’t delete it either', rows.length === 1, rows);
  await db.query(`delete from saved_routes where id = $1`, [routeId]);
  const { rows: run } = await db.query(`select route_id from rpc_get_run($1)`, [second]);
  check('deleting a route keeps its runs, unlinked', run.length === 1 && run[0].route_id === null, run);
});

done();
