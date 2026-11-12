// Migration 0036: rpc_friend_stats gains the unit a friend logs in, as its last
// column, and nothing an older app reads moves or changes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MIGRATIONS, asAnon, asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const MIGRATION = readFileSync(join(MIGRATIONS, '0036_friend_stats_unit.sql'), 'utf8');
const TODAY = '2026-11-08';

// Everything up to the migration before this one, so its effect can be compared.
const db = await freshDb({ upTo: 35 });
const kira = await createUser(db, 'kira@example.com'); // logs in kg
const liam = await createUser(db, 'liam@example.com'); // logs in lb
const sam = await createUser(db, 'sam@example.com'); // nobody's friend
const pia = await createUser(db, 'pia@example.com'); // only a pending request
const bea = await createUser(db, 'bea@example.com'); // kira blocked them

await db.query(`update profiles set unit = 'kg' where user_id = $1`, [kira]);
await db.query(`update profiles set unit = 'lb' where user_id in ($1, $2, $3, $4)`, [liam, sam, pia, bea]);
await db.query(
  `insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted'), ($1, $3, 'accepted')`,
  [kira, liam, bea],
);
await db.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [pia, kira]);

const { rows: exerciseRows } = await db.query(
  `select id, name from exercises where lower(name) in ('barbell bench press', 'barbell back squat')`,
);
const exercise = (name) => exerciseRows.find((e) => e.name.toLowerCase() === name).id;
const bench = exercise('barbell bench press');
const squat = exercise('barbell back squat');

const session = async (owner, startedAt, sets) => {
  const { rows } = await db.query(
    `insert into workouts (user_id, started_at, ended_at)
     values ($1, $2::timestamptz, $2::timestamptz + interval '1 hour') returning id`,
    [owner, startedAt],
  );
  for (const [i, s] of sets.entries()) {
    await db.query(
      `insert into sets (user_id, workout_id, exercise_id, weight, reps, is_warmup, e1rm, order_index)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [owner, rows[0].id, s.exercise, s.weight, s.reps, s.warmup ?? false, s.e1rm ?? 0, i],
    );
  }
};

// A warm-up counts in the total on the lifter's own phone too.
await session(kira, '2026-11-01T10:00:00Z', [
  { exercise: bench, weight: 40, reps: 10, warmup: true },
  { exercise: bench, weight: 102.5, reps: 5, e1rm: 119 },
  { exercise: squat, weight: 140, reps: 3, e1rm: 154 },
]);
await session(liam, '2026-11-02T10:00:00Z', [{ exercise: bench, weight: 225, reps: 5, e1rm: 262 }]);
await db.query(`insert into activities (user_id, kind, duration_seconds) values ($1, 'run', 1800)`, [kira]);

const statsOf = (viewer, target) =>
  asUser(db, viewer, () => db.query(`select * from rpc_friend_stats($1, $2::date)`, [target, TODAY]));
const prsOf = (viewer, target) =>
  asUser(db, viewer, () => db.query(`select * from rpc_friend_prs($1) order by exercise_name`, [target]));

/** Columns and values as an older app gets them today. */
const before = (await statsOf(liam, kira)).rows[0];
const prsBefore = (await prsOf(liam, kira)).rows;
check('before the migration there is no unit', !('unit' in before), Object.keys(before));

await db.exec(MIGRATION);

// --- The new column ---------------------------------------------------------
const after = (await statsOf(liam, kira)).rows[0];
const afterKeys = Object.keys(after);
check('unit is the very last column', afterKeys.at(-1) === 'unit', afterKeys);
check(
  'every other column stays in its place',
  JSON.stringify(afterKeys.slice(0, -1)) === JSON.stringify(Object.keys(before)),
  afterKeys,
);
const { unit: _unit, ...withoutUnit } = after;
check(
  'and every value an older app reads is unchanged',
  JSON.stringify(withoutUnit) === JSON.stringify(before),
  { before, after },
);

const declared = await db.query(`
  select pg_get_function_result(p.oid) as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'rpc_friend_stats'`);
check('there is only one rpc_friend_stats', declared.rows.length === 1, declared.rows);
check('declared at the end as text', /featured_trophies text\[\], unit text\)$/.test(declared.rows[0].result), declared.rows[0]);

check('a kg lifter’s stats say kg', after.unit === 'kg', after.unit);
check('an lb lifter’s stats say lb', (await statsOf(kira, liam)).rows[0].unit === 'lb');
check('your own stats carry your unit', (await statsOf(kira, kira)).rows[0].unit === 'kg');

// --- The numbers stay in the lifter's own unit --------------------------------
const kirasVolume = 40 * 10 + 102.5 * 5 + 140 * 3;
check('the total is still stored figures, not converted', after.total_volume === kirasVolume, after.total_volume);

const own = await asUser(db, kira, () =>
  db.query(`select volume from v_all_time_totals where user_id = $1`, [kira]),
);
check('the same total their own phone reads', own.rows[0].volume === after.total_volume, {
  own: own.rows[0].volume,
  friend: after.total_volume,
});

const ownBests = await asUser(db, kira, () =>
  db.query(`select exercise_name, best_weight, best_e1rm from v_exercise_prs where user_id = $1 order by exercise_name`, [kira]),
);
const friendBests = (await prsOf(liam, kira)).rows;
check(
  'and the same bests, in the same unit as the column',
  JSON.stringify(ownBests.rows.map((r) => [r.exercise_name, r.best_weight, r.best_e1rm])) ===
    JSON.stringify(friendBests.map((r) => [r.exercise_name, r.best_weight, r.best_e1rm])),
  { own: ownBests.rows, friend: friendBests },
);

// --- rpc_friend_prs is untouched ---------------------------------------------
check('rpc_friend_prs gives the same answer as before', JSON.stringify(friendBests) === JSON.stringify(prsBefore));
check(
  'with the same columns, none added',
  Object.keys(friendBests[0]).join() === 'exercise_name,best_weight,best_reps,best_e1rm',
  Object.keys(friendBests[0]),
);

// --- It follows the profile -------------------------------------------------
await db.query(`update profiles set unit = 'lb' where user_id = $1`, [kira]);
check('switching unit shows up straight away', (await statsOf(liam, kira)).rows[0].unit === 'lb');
await db.query(`update profiles set unit = 'kg' where user_id = $1`, [kira]);

// --- Nothing new is shared ----------------------------------------------------
const board = await asUser(db, liam, () => db.query(`select user_id, unit from rpc_friend_leaderboard(null, $1::date)`, [TODAY]));
check(
  'a friend could already read this from the leaderboard',
  board.rows.find((r) => r.user_id === kira)?.unit === 'kg',
  board.rows,
);

// --- Who can call it, after the drop and again after a second run ------------
const callers = async (label) => {
  const anon = await asAnon(db, () => errorOf(() => db.query(`select * from rpc_friend_stats($1)`, [kira])));
  check(`${label}: signed-out callers are refused`, anon != null && /permission denied/.test(anon), anon);

  const stranger = await asUser(db, sam, () => errorOf(() => db.query(`select * from rpc_friend_stats($1)`, [kira])));
  check(`${label}: a stranger is refused`, stranger != null && /not friends/.test(stranger), stranger);

  const pending = await asUser(db, pia, () => errorOf(() => db.query(`select * from rpc_friend_stats($1)`, [kira])));
  check(`${label}: a pending request is refused`, pending != null && /not friends/.test(pending), pending);

  const { rows } = await db.query(`
    select has_function_privilege('anon', p.oid, 'execute') as anon,
           has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
           has_function_privilege('service_role', p.oid, 'execute') as service_role,
           p.prosecdef as definer,
           p.proconfig as config,
           p.provolatile as volatility
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rpc_friend_stats'`);
  const f = rows[0];
  check(`${label}: anon has no execute, authenticated does`, !f.anon && f.authenticated && f.service_role, f);
  check(`${label}: runs as owner with a fixed search_path`, f.definer && f.config?.join() === 'search_path=public', f);
  check(`${label}: still stable`, f.volatility === 's', f);
};
await callers('first run');

const firstRun = (await statsOf(liam, kira)).rows[0];
const secondRunError = await errorOf(() => db.exec(MIGRATION));
check('running the migration again does not fail', secondRunError === null, secondRunError);
await callers('second run');
check(
  'and changes nothing',
  JSON.stringify((await statsOf(liam, kira)).rows[0]) === JSON.stringify(firstRun),
);

// A block ends the friendship (0032), and with it the stats.
await db.query(`insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [kira, bea]);
const blocked = await asUser(db, bea, () => errorOf(() => db.query(`select * from rpc_friend_stats($1)`, [kira])));
check('someone blocked is refused', blocked != null && /not friends/.test(blocked), blocked);

done();
