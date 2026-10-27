// Server-side running totals (migration 0019): what the AI coach will read.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asAnon, asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const save = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'save-run-5k.json'), 'utf8'),
);
const JSONB = new Set(['p_splits', 'p_best_efforts']);
const names = Object.keys(save);

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

const summary = async (start, end) =>
  (await db.query(`select * from rpc_running_summary($1, $2)`, [start, end])).rows[0];

await asUser(db, alice, async () => {
  await db.query(
    `select rpc_save_run(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')})`,
    names.map((k) => (JSONB.has(k) ? JSON.stringify(save[k]) : save[k])),
  );
  // A run logged by hand before running existed: 2 miles in 20 minutes.
  await db.query(
    `insert into activities (user_id, kind, name, performed_at, duration_seconds, distance, distance_unit)
     values ($1, 'run', 'Old run', $2, 1200, 2, 'mi')`,
    [alice, save.p_performed_at],
  );
  // And one long before the window.
  await db.query(
    `insert into activities (user_id, kind, performed_at, duration_seconds, distance, distance_unit)
     values ($1, 'run', '2020-01-01T10:00:00Z', 3600, 10, 'km')`,
    [alice],
  );

  const day = new Date(save.p_performed_at);
  const start = new Date(day.getTime() - 86_400_000).toISOString();
  const end = new Date(day.getTime() + 86_400_000).toISOString();
  const s = await summary(start, end);
  check('counts the recorded run and the hand-logged one, not the old one', s.runs === 2, s);
  check('adds their distance in metres, converting miles',
    Math.abs(s.distance_m - (save.p_distance_m + 2 * 1609.344)) < 0.01, s.distance_m);
  check('adds their moving time', Number(s.moving_seconds) === save.p_moving_seconds + 1200, s.moving_seconds);
  check('knows the longest', Math.abs(s.longest_m - save.p_distance_m) < 0.01, s.longest_m);

  const empty = await summary('2019-01-01T00:00:00Z', '2019-02-01T00:00:00Z');
  check('an empty span is all zeros, not nothing', empty.runs === 0 && empty.distance_m === 0, empty);
});

await asUser(db, bob, async () => {
  const s = await summary('2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z');
  check('bob sees none of alice’s running', s.runs === 0, s);
});

await asAnon(db, async () => {
  const e = await errorOf(() => summary('2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z'));
  check('signed out, there is no summary at all', e != null, e);
});

done();
