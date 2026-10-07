// Streaks count every activity, not only workouts (migration 0020).
import { check, createUser, done, freshDb } from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const today = '2026-10-07';
const at = (date) => `${date}T15:00:00Z`;

// As the database owner: streak_stats is only called by the server's own RPCs.
const streak = async (user) => (await db.query(`select * from streak_stats($1, $2::date)`, [user, today])).rows[0];
const activity = (date, kind = 'run') =>
  db.query(
    `insert into activities (user_id, kind, performed_at, duration_seconds, distance, distance_unit)
     values ($1, $2, $3, 1800, 5, 'km')`,
    [alice, kind, at(date)],
  );

// Runs alone, three days in a row up to today.
await activity('2026-10-05');
await activity('2026-10-06');
await activity('2026-10-07');
let s = await streak(alice);
check('three days of running in a row is a three-day streak', s.current_streak === 3, s);

// A workout four days ago, and a rest day five days ago with a basketball game before it.
await db.query(
  `insert into workouts (user_id, started_at, ended_at) values ($1, $2, $3)`,
  [alice, at('2026-10-04'), `2026-10-04T16:00:00Z`],
);
await db.query(`insert into rest_days (user_id, rest_date) values ($1, '2026-10-03')`, [alice]);
await activity('2026-10-02', 'basketball');
s = await streak(alice);
check('workouts and any activity count together, and a rest day bridges without counting',
  s.current_streak === 5 && s.best_streak === 5, s);
check('consistency counts every covered day in the last 30', s.consistency_30 === Math.round((100 * 6) / 30), s);

// A gap breaks it.
const bob = await createUser(db, 'bob@example.com');
await db.query(
  `insert into activities (user_id, kind, performed_at, duration_seconds) values ($1, 'walk', $2, 1200)`,
  [bob, at('2026-10-04')],
);
s = await streak(bob);
check('a lone activity days ago is no current streak, but is a best of one', s.current_streak === 0 && s.best_streak === 1, s);

done();
