// Migration 0035: a friend's sessions for the grid on their profile, by the same
// rules as the feed, and the unit each post's volume is in.
import { asAnon, asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');
const carol = await createUser(db, 'carol@example.com');
const dan = await createUser(db, 'dan@example.com');

const befriend = (a, b) =>
  db.query(`insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [a, b]);
await befriend(alice, bob);
await befriend(alice, carol);
await befriend(alice, dan);
await db.query(`update profiles set share_workouts = true`);
await db.query(`update profiles set unit = 'kg' where user_id = $1`, [bob]);

const workout = async (owner, name, startedAt = '2026-11-01T10:00:00Z') => {
  const { rows } = await db.query(
    `insert into workouts (user_id, name, started_at, ended_at)
     values ($1, $2, $3::timestamptz, $3::timestamptz + interval '1 hour') returning id`,
    [owner, name, startedAt],
  );
  return rows[0].id;
};
const activity = async (owner, shared = true) => {
  const { rows } = await db.query(
    `insert into activities (user_id, kind, duration_seconds, share_to_feed) values ($1, 'run', 1800, $2) returning id`,
    [owner, shared],
  );
  return rows[0].id;
};

const bobsPush = await workout(bob, 'Push', '2026-11-03T10:00:00Z');
const bobsPull = await workout(bob, 'Pull', '2026-11-02T10:00:00Z');
const bobsLegs = await workout(bob, 'Legs', '2026-11-01T10:00:00Z');
const bobsShared = await activity(bob);
const bobsHidden = await activity(bob, false);
const carolsPush = await workout(carol, 'Carol push');
const dansPush = await workout(dan, 'Dan push');
await workout(alice, 'Alice push');

const posts = async (target, args = '') =>
  (await db.query(`select * from rpc_friend_posts($1${args})`, [target])).rows;
const ids = (rows) => rows.map((r) => r.subject_id);

// --- Only signed-in people -------------------------------------------------
const anon = await asAnon(db, () => errorOf(() => db.query(`select * from rpc_friend_posts($1)`, [bob])));
check('signed-out callers cannot run rpc_friend_posts', anon != null && /permission denied/.test(anon), anon);

const helper = await asUser(db, alice, () =>
  errorOf(() => db.query(`select * from private.feed_posts(30, null, $1)`, [bob])),
);
check('nobody can call the shared helper directly', helper != null && /permission denied/.test(helper), helper);

// --- One person's sessions -------------------------------------------------
await asUser(db, alice, async () => {
  const rows = await posts(bob);
  check('alice sees bob’s sessions', ids(rows).includes(bobsPush) && ids(rows).includes(bobsShared), ids(rows));
  check('and only bob’s', rows.every((r) => r.user_id === bob), rows.map((r) => r.user_id));
  check('not a run he kept off the feed', !ids(rows).includes(bobsHidden));
  check('newest first', rows.every((r, i) => i === 0 || r.occurred_at <= rows[i - 1].occurred_at));
  check('with the unit he logs in', rows.every((r) => r.unit === 'kg'), rows.map((r) => r.unit));

  const limited = await posts(bob, `, 2`);
  check('the limit is respected', limited.length === 2, limited.length);
  const older = await posts(bob, `, 30, '2026-11-03T00:00:00Z'`);
  check('and so is before', ids(older).includes(bobsPull) && !ids(older).includes(bobsPush), ids(older));

  const none = (await db.query(`select * from rpc_friend_posts(null)`)).rows;
  check('no target returns nothing, not the whole feed', none.length === 0, none.length);
});

// --- The same answer as the feed -------------------------------------------
await asUser(db, alice, async () => {
  const feed = (await db.query(`select * from rpc_friend_feed(100)`)).rows.filter((r) => r.user_id === bob);
  const direct = await posts(bob, `, 100`);
  check(
    'a friend’s sessions match what the feed shows for them',
    JSON.stringify(direct) === JSON.stringify(feed),
    { feed: ids(feed), direct: ids(direct) },
  );
  const everyone = (await db.query(`select * from rpc_friend_feed(100)`)).rows;
  check('the feed still covers everyone', new Set(everyone.map((r) => r.user_id)).size === 4);
  check('and carries the unit too', everyone.every((r) => r.unit === 'lb' || r.unit === 'kg'));
});

// --- Who can't see them ----------------------------------------------------
await asUser(db, bob, async () => {
  const rows = await posts(carol);
  check('someone who isn’t your friend shows nothing', rows.length === 0, ids(rows));
  check('even if you share a friend', !ids(rows).includes(carolsPush));
});

await db.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [bob, dan]);
await asUser(db, bob, async () => {
  const rows = await posts(dan);
  check('a pending request shows nothing', rows.length === 0, ids(rows));
  check('not even the session itself', !ids(rows).includes(dansPush));
});

await db.query(`update profiles set share_workouts = false where user_id = $1`, [carol]);
await asUser(db, alice, async () => {
  check('turning sharing off hides them straight away', (await posts(carol)).length === 0);
});
await db.query(`update profiles set share_workouts = true where user_id = $1`, [carol]);

// Blocking ends the friendship (0032), which would hide the posts by itself and
// prove nothing about the feed's own check. So the block lands with that trigger
// off, to test the check on its own, in both directions.
const hiddenByBlock = async (blocker, blocked, label) => {
  await db.query(`alter table user_blocks disable trigger user_blocks_teardown`);
  await db.query(`insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [blocker, blocked]);
  await db.query(`alter table user_blocks enable trigger user_blocks_teardown`);
  await asUser(db, alice, async () => {
    check(`${label}: nothing shows`, (await posts(carol)).length === 0);
    const feed = (await db.query(`select user_id from rpc_friend_feed(100)`)).rows;
    check(`${label}: nor in the feed`, !feed.some((r) => r.user_id === carol));
  });
  await db.query(`delete from user_blocks where blocker_id = $1 and blocked_id = $2`, [blocker, blocked]);
  await asUser(db, alice, async () => {
    check(`${label}: and they come back once it is lifted`, (await posts(carol)).length > 0);
  });
};
await hiddenByBlock(carol, alice, 'someone who blocked you');
await hiddenByBlock(alice, carol, 'someone you blocked');

// --- Summaries only --------------------------------------------------------
await asUser(db, alice, async () => {
  const [row] = await posts(bob);
  const columns = Object.keys(row).sort().join(',');
  check(
    'exactly the columns of a summary come back, so nothing about single sets or notes',
    columns ===
      'activity_kind,badge_ids,display_name,distance,distance_unit,duration_seconds,exercise_names,' +
        'featured_trophies,my_reaction,name,occurred_at,reaction_counts,record_count,route_preview,' +
        'subject_id,subject_type,total_reps,total_sets,unit,user_id,username,volume',
    columns,
  );
});

// --- Your own ---------------------------------------------------------------
await asUser(db, bob, async () => {
  const rows = await posts(bob);
  check('you can see your own, including runs kept off the feed', ids(rows).includes(bobsHidden), ids(rows));
  check('bob’s last session is there', ids(rows).includes(bobsLegs), ids(rows));
});

// --- The limit ---------------------------------------------------------------
await db.query(
  `insert into workouts (user_id, name, started_at, ended_at)
   select $1, 'Old ' || g, t, t + interval '1 hour'
   from generate_series(1, 101) g, lateral (select timestamptz '2026-01-01' + g * interval '1 day' as t) x`,
  [bob],
);
await asUser(db, alice, async () => {
  check('a huge limit is capped at 100', (await posts(bob, `, 100000`)).length === 100);
  check('a negative limit returns one', (await posts(bob, `, -1`)).length === 1);
  check('so does a limit of zero', (await posts(bob, `, 0`)).length === 1);
});

done();
