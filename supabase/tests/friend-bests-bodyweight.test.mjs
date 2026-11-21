// Migration 0037: a friend's personal bests on bodyweight and assisted exercises
// come back as BW, with no weight or estimated max, and no total a friend sees
// (strength score, volume, a feed post, the leaderboard) counts bodyweight sets.
import { asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const db = await freshDb();
const ana = await createUser(db, 'ana@example.com');
const ben = await createUser(db, 'ben@example.com');
const cy = await createUser(db, 'cy@example.com'); // nobody's friend

await db.query(`insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [ana, ben]);

const { rows: found } = await db.query(
  `select id, lower(name) as name, load_type::text as load_type from exercises
    where lower(name) in ('barbell bench press', 'pull-up', 'assisted pull-up')`,
);
const id = (name) => found.find((e) => e.name === name)?.id;
const bench = id('barbell bench press');
const pullUp = id('pull-up');
const assisted = id('assisted pull-up');
check('the catalog has the exercises this test uses', bench && pullUp && assisted, found);

// A weighted lift someone logged with the BW button, which also counts as bodyweight.
const { rows: custom } = await db.query(
  `insert into exercises (user_id, name, muscle_group, load_type, is_custom)
   values ($1, 'Ring Row', 'back', 'weighted', true) returning id`,
  [ana],
);
const ringRow = custom[0].id;

const { rows: w } = await db.query(
  `insert into workouts (user_id, started_at, ended_at)
   values ($1, now() - interval '2 hours', now() - interval '1 hour') returning id`,
  [ana],
);
const set = (exercise, weight, reps, e1rm, extra = {}) =>
  db.query(
    `insert into sets (user_id, workout_id, exercise_id, weight, reps, e1rm, is_warmup, is_bodyweight, assist_weight, added_weight)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [ana, w[0].id, exercise, weight, reps, e1rm, extra.warmup ?? false, extra.bw ?? false, extra.assist ?? null, extra.added ?? null],
  );

// Ana weighs 82.5. Her pull-ups are bodyweight plus 10, her assisted pull-ups
// bodyweight minus 20, and her ring rows were logged with the BW button.
await set(bench, 100, 5, 116.7);
await set(pullUp, 92.5, 6, 111, { added: 10 });
await set(assisted, 62.5, 8, 79.2, { assist: 20 });
await set(ringRow, 82.5, 12, 115.5, { bw: true });
await set(bench, 60, 10, 0, { warmup: true });

const prs = async (viewer, target) =>
  asUser(db, viewer, async () => (await db.query(`select * from rpc_friend_prs($1)`, [target])).rows);
const byName = (rows, name) => rows.find((r) => r.exercise_name.toLowerCase() === name);

// --- What a friend gets ----------------------------------------------------
const seen = await prs(ben, ana);
const benchRow = byName(seen, 'barbell bench press');
check('a weighted lift still shows its weight', benchRow?.best_weight === 100 && benchRow?.best_e1rm === 116.7, benchRow);
check('and is not marked BW', benchRow?.bodyweight === false, benchRow);

for (const name of ['pull-up', 'assisted pull-up', 'ring row']) {
  const row = byName(seen, name);
  check(`${name}: marked BW`, row?.bodyweight === true, row);
  check(`${name}: no weight`, row?.best_weight === null, row);
  check(`${name}: no estimated max`, row?.best_e1rm === null, row);
  check(`${name}: the reps still come through`, row?.best_reps > 0, row);
}
check(
  'no number anywhere equals her bodyweight, plus or minus',
  !seen.some((r) => [82.5, 92.5, 62.5].includes(r.best_weight)),
  seen,
);

// --- What you get about yourself --------------------------------------------
const mine = await prs(ana, ana);
const myPullUp = byName(mine, 'pull-up');
check('you still see your own pull-up numbers', myPullUp?.best_weight === 92.5 && myPullUp?.best_e1rm === 111, myPullUp);
check('marked BW for you too', myPullUp?.bodyweight === true, myPullUp);

// --- Who can't ask ---------------------------------------------------------
const stranger = await asUser(db, cy, () => errorOf(() => db.query(`select * from rpc_friend_prs($1)`, [ana])));
check('someone who isn’t a friend still gets nothing', stranger != null && /not friends/.test(stranger), stranger);

// --- Totals a friend sees leave bodyweight out -----------------------------
const statsFor = (viewer) =>
  asUser(db, viewer, async () => (await db.query(`select * from rpc_friend_stats($1, current_date)`, [ana])).rows[0]);
const stats = await statsFor(ben);
check(
  'a friend’s strength_score leaves out the exercises shown as BW',
  Math.abs(stats.strength_score - 116.7) < 1e-6,
  { got: stats.strength_score, expected: 116.7 },
);
const own = await statsFor(ana);
const allBests = 116.7 + 111 + 79.2 + 115.5;
check(
  'your own strength_score is every best estimated max, warm-ups left out',
  Math.abs(own.strength_score - allBests) < 1e-6,
  { got: own.strength_score, expected: allBests },
);

// Bench 100 x 5 plus the 60 x 10 warm-up: the only sets a friend's volume counts.
const benchOnly = 100 * 5 + 60 * 10;
const everything = benchOnly + 92.5 * 6 + 62.5 * 8 + 82.5 * 12;
check('a friend’s total_volume leaves out bodyweight sets', stats.total_volume === benchOnly, stats.total_volume);
check('your own total_volume counts every set', own.total_volume === everything, own.total_volume);

// New accounts start with sharing off (0031); Ana shares her sessions.
await db.query(`update profiles set share_workouts = true where user_id = $1`, [ana]);
const feedFor = (viewer) =>
  asUser(db, viewer, async () =>
    (await db.query(`select * from rpc_friend_feed(30, null)`)).rows.find((r) => r.subject_id === w[0].id),
  );
const friendPost = await feedFor(ben);
check('a friend sees the session on the feed', friendPost != null, friendPost);
check('its volume leaves out bodyweight sets (and warm-ups, as before)', friendPost?.volume === 100 * 5, friendPost?.volume);
const ownPost = await feedFor(ana);
check('your own post counts them', ownPost?.volume === 100 * 5 + 92.5 * 6 + 62.5 * 8 + 82.5 * 12, ownPost?.volume);

const boardFor = (viewer) =>
  asUser(db, viewer, async () =>
    (await db.query(`select * from rpc_friend_leaderboard(null, current_date)`)).rows.find((r) => r.user_id === ana),
  );
check('on a friend’s weight-lifted board, bodyweight sets are left out', (await boardFor(ben))?.total_volume === benchOnly);
check('on your own board, they count', (await boardFor(ana))?.total_volume === everything);

check('rpc_friend_stats still carries the unit before it', stats.unit === 'lb' || stats.unit === 'kg', stats.unit);
const columns = Object.keys(stats);
check('strength_score is the last column', columns[columns.length - 1] === 'strength_score', columns);

done();
