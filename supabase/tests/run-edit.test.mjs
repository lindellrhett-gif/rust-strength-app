// Editing a saved run (migration 0018): its details, and trimming its start
// and end. The trim is the app's own (crop-run-5k.json, written by
// __tests__/runningSaveContract.test.ts from the same 5K the save contract
// uses), so the app and the database can't drift apart.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const save = JSON.parse(readFileSync(join(FIXTURES, 'save-run-5k.json'), 'utf8'));
const crop = JSON.parse(readFileSync(join(FIXTURES, 'crop-run-5k.json'), 'utf8'));

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

// Splits and best efforts are jsonb; the route arrays are real Postgres arrays.
const JSONB = new Set(['p_splits', 'p_best_efforts']);
const call = (fn, args) => {
  const names = Object.keys(args);
  return db.query(
    `select ${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')})`,
    names.map((k) => (JSONB.has(k) ? JSON.stringify(args[k]) : args[k])),
  );
};
const getRun = async () => (await db.query(`select * from rpc_get_run($1)`, [save.p_id])).rows[0];

await asUser(db, alice, async () => {
  const err = await errorOf(() => call('rpc_save_run', save));
  check('alice saves the recorded 5K', err === null, err);
});

// --- Details ----------------------------------------------------------------
await asUser(db, alice, async () => {
  const err = await errorOf(() =>
    call('rpc_update_run_details', {
      p_activity_id: save.p_id, p_name: '  Lakeside loop ', p_note: 'Windy on the bridge', p_effort: 7,
    }),
  );
  check('alice renames her run, adds a note and an effort', err === null, err);
  const run = await getRun();
  check('the new title, note and effort come back, trimmed of spaces',
    run.name === 'Lakeside loop' && run.note === 'Windy on the bridge' && run.effort === 7, run);
  check('leaving the map setting out keeps it as it was', run.map_visibility === 'private');

  await call('rpc_update_run_details', {
    p_activity_id: save.p_id, p_name: '', p_note: null, p_effort: null, p_map_visibility: 'friends',
  });
  const cleared = await getRun();
  check('an empty title and no effort clear them', cleared.name === null && cleared.effort === null, cleared);
  check('the map can be shared with friends', cleared.map_visibility === 'friends');

  for (const [label, args, pattern] of [
    ['refuses effort outside 1-10', { p_effort: 11 }, /Effort/],
    ['refuses a very long title', { p_name: 'x'.repeat(81) }, /80 characters/],
    ['refuses an unknown map setting', { p_map_visibility: 'everyone' }, /Map visibility/],
  ]) {
    const e = await errorOf(() =>
      call('rpc_update_run_details', { p_activity_id: save.p_id, p_name: null, p_note: null, p_effort: null, ...args }),
    );
    check(label, e != null && pattern.test(e), e);
  }
});

await asUser(db, bob, async () => {
  const e = await errorOf(() =>
    call('rpc_update_run_details', { p_activity_id: save.p_id, p_name: 'Mine now', p_note: null, p_effort: null }),
  );
  check('bob can’t edit alice’s run', e != null && /not found/.test(e), e);
  const e2 = await errorOf(() => call('rpc_crop_run', crop));
  check('bob can’t trim alice’s run', e2 != null && /not found/.test(e2), e2);
});

// --- Trimming -----------------------------------------------------------------
await asUser(db, alice, async () => {
  const before = (await db.query(`select performed_at from activities where id = $1`, [save.p_id])).rows[0];
  const startShift = save.p_times[crop.p_from - 1];

  const wrong = await errorOf(() => call('rpc_crop_run', { ...crop, p_distance_m: crop.p_distance_m + 50 }));
  check('refuses a trimmed distance that doesn’t match the line', wrong != null && /does not match/.test(wrong), wrong);
  const tooFast = await errorOf(() => call('rpc_crop_run', { ...crop, p_moving_seconds: crop.p_moving_seconds - 30 }));
  check('refuses a moving time that doesn’t match', tooFast != null && /does not match/.test(tooFast), tooFast);
  const tiny = await errorOf(() => call('rpc_crop_run', { ...crop, p_from: 10, p_to: 10 }));
  check('refuses to keep a single point', tiny != null && /two points/.test(tiny), tiny);

  const err = await errorOf(() => call('rpc_crop_run', crop));
  check('alice trims the first and last 500 m', err === null, err);

  const run = await getRun();
  const kept = crop.p_to - crop.p_from + 1;
  check('the route keeps exactly the points in between', run.times.length === kept && run.distances.length === kept);
  check('times, distances and moving times start again from 0',
    run.times[0] === 0 && run.distances[0] === 0 && run.moving_times[0] === 0, run.times.slice(0, 3));
  check('the totals are the trimmed run’s',
    run.distance_m === crop.p_distance_m && run.moving_seconds === crop.p_moving_seconds &&
    run.elapsed_seconds === crop.p_elapsed_seconds, run);
  const sorted = (o) => JSON.stringify(Object.entries(o ?? {}).sort());
  check('best efforts are the trimmed run’s', sorted(run.best_efforts) === sorted(crop.p_best_efforts), run.best_efforts);
  check('splits are the trimmed run’s', JSON.stringify(run.splits) === JSON.stringify(crop.p_splits));

  const act = (await db.query(
    `select performed_at, duration_seconds, distance, steps, calories from activities where id = $1`, [save.p_id],
  )).rows[0];
  const shifted = (new Date(act.performed_at) - new Date(before.performed_at)) / 1000;
  check('the run now starts where the kept part starts', Math.abs(shifted - startShift) < 1, { shifted, startShift });
  check('the activity log shows the trimmed distance and time',
    act.duration_seconds === crop.p_moving_seconds && Math.abs(act.distance - crop.p_distance_m / 1000) < 0.01 &&
    act.steps === crop.p_steps && act.calories === crop.p_calories, act);

  // A typed-in run has no route to trim.
  const manualId = '11111111-2222-4333-8444-555555555555';
  await call('rpc_save_run', {
    p_id: manualId, p_performed_at: save.p_performed_at, p_source: 'treadmill', p_distance_m: 5000,
    p_moving_seconds: 1500, p_elapsed_seconds: 1500, p_distance_unit: 'km',
  });
  const e = await errorOf(() => call('rpc_crop_run', { ...crop, p_activity_id: manualId }));
  check('a treadmill run can’t be trimmed', e != null && /can't be trimmed|can’t be trimmed|be trimmed/.test(e), e);
});

done();
