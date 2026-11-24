// Migration 0038: sets only on your own workouts, the feed counting only the
// owner's sets, and server-side checks on the names friends see.
import { asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const mallory = await createUser(db, 'mallory@example.com');
await db.query(`insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [alice, mallory]);
await db.query(`update profiles set share_workouts = true`);

const { rows: lib } = await db.query(`select id from exercises where user_id is null and lower(name) = 'barbell bench press'`);
const bench = lib[0].id;

const { rows: w } = await db.query(
  `insert into workouts (user_id, name, started_at, ended_at) values ($1, 'Push', now() - interval '1 hour', now()) returning id`,
  [alice],
);
const alicesWorkout = w[0].id;
await db.query(
  `insert into sets (user_id, workout_id, exercise_id, weight, reps, e1rm) values ($1, $2, $3, 100, 5, 116)`,
  [alice, alicesWorkout, bench],
);

const { rows: myEx } = await db.query(
  `insert into exercises (user_id, name, muscle_group) values ($1, 'Anything I like', 'chest') returning id`,
  [mallory],
);
const mallorysExercise = myEx[0].id;
const { rows: aliceEx } = await db.query(
  `insert into exercises (user_id, name, muscle_group) values ($1, 'Alice private move', 'chest') returning id`,
  [alice],
);
const alicesExercise = aliceEx[0].id;
const { rows: mw } = await db.query(
  `insert into workouts (user_id, started_at, ended_at) values ($1, now() - interval '2 hour', now() - interval '1 hour') returning id`,
  [mallory],
);
const mallorysWorkout = mw[0].id;

const rlsError = (err) => err != null && /row-level security/.test(err);

// --- 1. Writing into someone else's workout ------------------------------
await asUser(db, mallory, async () => {
  const set = await errorOf(() =>
    db.query(
      `insert into sets (user_id, workout_id, exercise_id, weight, reps, e1rm) values ($1, $2, $3, 999, 99, 5000)`,
      [mallory, alicesWorkout, mallorysExercise],
    ),
  );
  check('a friend cannot add a set to your workout', rlsError(set), set);

  const we = await errorOf(() =>
    db.query(`insert into workout_exercises (user_id, workout_id, exercise_id) values ($1, $2, $3)`, [
      mallory,
      alicesWorkout,
      bench,
    ]),
  );
  check('nor an exercise to it', rlsError(we), we);

  const foreignExercise = await errorOf(() =>
    db.query(`insert into sets (user_id, workout_id, exercise_id, weight, reps) values ($1, $2, $3, 50, 5)`, [
      mallory,
      mallorysWorkout,
      alicesExercise,
    ]),
  );
  check('nor use your private exercise in their own workout', rlsError(foreignExercise), foreignExercise);

  const own = await errorOf(() =>
    db.query(
      `insert into sets (user_id, workout_id, exercise_id, weight, reps) values ($1, $2, $3, 50, 5), ($1, $2, $4, 20, 10)`,
      [mallory, mallorysWorkout, bench, mallorysExercise],
    ),
  );
  check('their own sets, with library and own exercises, still save', own == null, own);

  const { rows: mine } = await db.query(`select id from sets where workout_id = $1 limit 1`, [mallorysWorkout]);
  const move = await errorOf(() => db.query(`update sets set workout_id = $1 where id = $2`, [alicesWorkout, mine[0].id]));
  check('and cannot be moved onto your workout', rlsError(move), move);
});

// --- 2. The feed counts only the owner's own sets --------------------------
// A row like the ones the old policy let through, written as the database owner.
await db.query(
  `insert into sets (user_id, workout_id, exercise_id, weight, reps, e1rm) values ($1, $2, $3, 999, 99, 5000)`,
  [mallory, alicesWorkout, mallorysExercise],
);
await asUser(db, mallory, async () => {
  const { rows } = await db.query(`select * from rpc_friend_feed() where subject_id = $1`, [alicesWorkout]);
  const post = rows[0];
  check('alice’s post is in the feed', post != null, rows);
  check('with only her own volume', post.volume === 500, post.volume);
  check('and her own set count', post.total_sets === 1, post.total_sets);
  check('and none of the other exercise names', !post.exercise_names.includes('Anything I like'), post.exercise_names);
});

// --- 3. Names --------------------------------------------------------------
await asUser(db, mallory, async () => {
  const set = (fields) =>
    errorOf(() => db.query(`update profiles set ${fields} where user_id = $1`, [mallory]));

  for (const bad of ['RustStrength', 'rust_strength', 'ruststrength_team', 'bluestem_dev', 'support', 'admin_bob', 'official', 'a', 'has space', 'x'.repeat(21), 'émile']) {
    const err = await set(`username = '${bad}', username_chosen = true`);
    check(`username "${bad.slice(0, 22)}" is refused`, err != null && /check constraint/.test(err), err);
  }
  for (const good of ['badminton_fan', 'helpful_hank', 'modern_lifter', 'lift_heavy_20']) {
    const err = await set(`username = '${good}', username_chosen = true`);
    check(`username "${good}" is allowed`, err == null, err);
  }

  const longName = await set(`display_name = '${'y'.repeat(41)}'`);
  check('a display name over 40 characters is refused', longName != null && /check constraint/.test(longName), longName);
  const control = await set(`display_name = E'Bob\\nAdmin'`);
  check('as is one with a line break in it', control != null && /check constraint/.test(control), control);
  check('a normal display name is fine', (await set(`display_name = 'Mallory M'`)) == null);

  const exName = await errorOf(() =>
    db.query(`insert into exercises (user_id, name, muscle_group) values ($1, $2, 'chest')`, [mallory, 'z'.repeat(81)]),
  );
  check('an exercise name over 80 characters is refused', exName != null && /check constraint/.test(exName), exName);
  const wName = await errorOf(() => db.query(`update workouts set name = $1 where id = $2`, ['w'.repeat(61), mallorysWorkout]));
  check('a workout name over 60 characters is refused', wName != null && /check constraint/.test(wName), wName);
});

// New accounts still get their random starting name.
const fresh = await createUser(db, 'newbie@example.com');
const { rows: p } = await db.query(`select username, username_chosen from profiles where user_id = $1`, [fresh]);
check('a new account still gets its random name', /^lifter_[0-9a-f]{6}$/.test(p[0].username) && !p[0].username_chosen, p[0]);

done();
