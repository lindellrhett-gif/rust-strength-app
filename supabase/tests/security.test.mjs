// Migration 0016: signed-out callers can't reach the API functions, friendship
// questions only work about yourself, and nothing legitimate broke.
import { asAnon, asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');
const carol = await createUser(db, 'carol@example.com');
const dave = await createUser(db, 'dave@example.com');

// Alice and Bob are friends; Carol and Dave are friends; nobody else is.
await db.query(
  `insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted'), ($3, $4, 'accepted')`,
  [alice, bob, carol, dave],
);
// Search only finds people who chose a username (migration 0007).
await db.query(`update profiles set username = 'alice_lifts', username_chosen = true where user_id = $1`, [alice]);
await db.query(`update profiles set username = 'bob_runs', username_chosen = true where user_id = $1`, [bob]);

// A finished workout and an activity for Bob and for Carol.
const post = async (owner) => {
  const { rows: w } = await db.query(
    `insert into workouts (user_id, started_at, ended_at) values ($1, now() - interval '1 hour', now()) returning id`,
    [owner],
  );
  const { rows: a } = await db.query(
    `insert into activities (user_id, kind, duration_seconds) values ($1, 'run', 1800) returning id`,
    [owner],
  );
  return { workout: w[0].id, activity: a[0].id };
};
const bobs = await post(bob);
const carols = await post(carol);

// --- 1. Signed-out callers -------------------------------------------------
const anonCalls = {
  rpc_friend_feed: `select * from rpc_friend_feed()`,
  rpc_friend_leaderboard: `select * from rpc_friend_leaderboard()`,
  rpc_friend_stats: `select * from rpc_friend_stats('${bob}')`,
  rpc_friend_prs: `select * from rpc_friend_prs('${bob}')`,
  rpc_search_users: `select * from rpc_search_users('al')`,
  rpc_export_my_data: `select rpc_export_my_data()`,
  rpc_delete_my_account: `select rpc_delete_my_account()`,
  are_friends: `select are_friends('${alice}', '${bob}')`,
  feed_subject_owner: `select feed_subject_owner('activity', '${bobs.activity}')`,
  can_react_to: `select can_react_to('activity', '${bobs.activity}')`,
  rpc_get_run: `select rpc_get_run('${bobs.activity}')`,
};
for (const [name, sql] of Object.entries(anonCalls)) {
  const err = await asAnon(db, () => errorOf(() => db.query(sql)));
  check(`signed-out callers cannot run ${name}`, err != null && /permission denied/.test(err), err);
}

// --- 2. Signed-in use still works --------------------------------------------
await asUser(db, alice, async () => {
  const search = await db.query(`select username from rpc_search_users('ali')`);
  check('friend search still works', search.rows.length === 0, search.rows); // excludes yourself
  const searchBob = await db.query(`select username from rpc_search_users('bob')`);
  check('friend search finds other people', searchBob.rows.length === 1 && searchBob.rows[0].username === 'bob_runs', searchBob.rows);

  const stats = await db.query(`select * from rpc_friend_stats($1)`, [bob]);
  check("a friend's stats still load", stats.rows.length === 1, stats.rows.length);

  const strangerStats = await errorOf(() => db.query(`select * from rpc_friend_stats($1)`, [carol]));
  check("a stranger's stats are still refused", strangerStats != null, strangerStats);

  const feed = await db.query(`select subject_id from rpc_friend_feed()`);
  const ids = feed.rows.map((r) => r.subject_id);
  check("the feed still shows a friend's posts", ids.includes(bobs.workout) && ids.includes(bobs.activity), ids);
  check("the feed still hides a stranger's posts", !ids.includes(carols.workout), ids);

  const board = await db.query(`select user_id from rpc_friend_leaderboard()`);
  check('the leaderboard still lists you and your friends', board.rows.length === 2, board.rows);

  const react = await errorOf(() =>
    db.query(`insert into feed_reactions (subject_type, subject_id, user_id, reaction) values ('activity', $1, $2, 'fire')`, [
      bobs.activity,
      alice,
    ]),
  );
  check("you can still react to a friend's post", react === null, react);
  const reactStranger = await errorOf(() =>
    db.query(`insert into feed_reactions (subject_type, subject_id, user_id, reaction) values ('activity', $1, $2, 'fire')`, [
      carols.activity,
      alice,
    ]),
  );
  check("you still can't react to a stranger's post", reactStranger != null, reactStranger);

  const exported = await errorOf(() => db.query(`select rpc_export_my_data()`));
  check('exporting your data still works', exported === null, exported);
});

// --- 3. Friendship questions only about yourself -------------------------------
await asUser(db, alice, async () => {
  const mine = await db.query(`select are_friends($1, $2) f`, [alice, bob]);
  check('you can still ask about your own friendship', mine.rows[0].f === true, mine.rows[0]);
  const theirs = await db.query(`select are_friends($1, $2) f`, [carol, dave]);
  check("you can no longer learn whether two other people are friends", theirs.rows[0].f === false, theirs.rows[0]);

  const friendOwner = await db.query(`select feed_subject_owner('activity', $1) o`, [bobs.activity]);
  check("a friend's post still names its owner", friendOwner.rows[0].o === bob, friendOwner.rows[0]);
  const strangerOwner = await db.query(`select feed_subject_owner('activity', $1) o`, [carols.activity]);
  check("a stranger's post no longer names its owner", strangerOwner.rows[0].o === null, strangerOwner.rows[0]);

  const profiles = await db.query(`select user_id from profiles order by user_id`);
  const seen = profiles.rows.map((r) => r.user_id);
  check('profiles RLS still shows you and your friend only', seen.length === 2 && seen.includes(bob), seen);
});

// --- 4. Triggers still fire without EXECUTE on their functions ------------------
const eve = await createUser(db, 'eve@example.com');
const { rows: eveProfile } = await db.query(`select count(*)::int n from profiles where user_id = $1`, [eve]);
check('sign-up still creates a profile', eveProfile[0].n === 1, eveProfile[0]);

await asUser(db, bob, async () => {
  await db.query(`delete from activities where id = $1`, [bobs.activity]);
});
const { rows: left } = await db.query(`select count(*)::int n from feed_reactions where subject_id = $1`, [bobs.activity]);
check("deleting a post still clears its reactions (trigger ran as a signed-in user)", left[0].n === 0, left[0]);

// --- 5. Fixed search paths -------------------------------------------------------
const { rows: open } = await db.query(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
    and p.proname like any (array['rpc\\_%', 'run\\_%', 'are\\_friends', 'feed\\_subject\\_owner', 'can\\_react\\_to', 'handle\\_new\\_user', 'cleanup\\_%'])
  order by 1`);
check('every app function has a fixed search_path', open.length === 0, open.map((r) => r.proname));

done();
