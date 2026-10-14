// Daily steps shared by choice, the running and steps leaderboards, the totals
// behind the new trophies, featured trophies, your own run outline in the
// feed (0024), and no rest days in the past (0025).
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
    `select ${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')})`,
    names.map((k) => (JSONB.has(k) ? JSON.stringify(args[k]) : args[k])),
  );
};
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const syncSteps = (days) => db.query(`select rpc_sync_daily_steps($1::jsonb) as n`, [JSON.stringify(days)]);

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');
const carol = await createUser(db, 'carol@example.com');
await db.query(`insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [alice, bob]);

// --- A run, its outline in your own feed ---------------------------------
const runId = base.p_id;
await asUser(db, alice, () => call('rpc_save_run', { ...base, p_performed_at: new Date().toISOString() }));
const ownFeed = await asUser(db, alice, () => db.query(`select * from rpc_friend_feed(30, null)`));
const ownPost = ownFeed.rows.find((r) => r.subject_id === runId);
check('your own run shows its outline in your feed, with the map kept private', !!ownPost?.route_preview, ownPost);
const bobFeed = await asUser(db, bob, () => db.query(`select * from rpc_friend_feed(30, null)`));
const bobSees = bobFeed.rows.find((r) => r.subject_id === runId);
check('a friend sees the run but not its map', !!bobSees && bobSees.route_preview == null, bobSees);
check('each post carries its author’s featured trophies', Array.isArray(bobSees?.featured_trophies), bobSees);

// --- Daily steps ---------------------------------------------------------
check(
  'steps can’t be shared until sharing is on',
  /not being shared/.test(await errorOf(() => asUser(db, alice, () => syncSteps([{ day: day(0), steps: 5000 }])))),
);
await asUser(db, alice, () => db.query(`select rpc_set_share_steps(true)`));
const saved = await asUser(db, alice, () =>
  syncSteps([
    { day: day(0), steps: 6000 },
    { day: day(-1), steps: 9000 },
  ]),
);
check('once on, a week of daily totals can be shared', saved.rows[0].n === 2, saved.rows);
await asUser(db, alice, () => syncSteps([{ day: day(0), steps: 4000 }]));
const kept = await db.query(`select steps from daily_steps where user_id = $1 and day = $2`, [alice, day(0)]);
check('a day’s total never goes down', kept.rows[0].steps === 6000, kept.rows);
check(
  'only the last week can be shared',
  /last week/.test(await errorOf(() => asUser(db, alice, () => syncSteps([{ day: day(-20), steps: 100 }])))),
);
check(
  'an impossible day is refused',
  /not believable/.test(await errorOf(() => asUser(db, alice, () => syncSteps([{ day: day(0), steps: 250000 }])))),
);
const carolReads = await asUser(db, carol, () => db.query(`select * from daily_steps`));
check('nobody else can read the totals themselves', carolReads.rows.length === 0, carolReads.rows);

// --- Leaderboards --------------------------------------------------------
const board = await asUser(db, bob, () => db.query(`select * from rpc_friend_leaderboard(null, current_date)`));
const aliceRow = board.rows.find((r) => r.user_id === alice);
const bobRow = board.rows.find((r) => r.user_id === bob);
check('the steps board adds up a friend’s shared days', Number(aliceRow?.steps) === 15000, aliceRow);
check('someone not sharing has no steps, so is left off that board', bobRow?.steps == null, bobRow);
check(
  'the distance board counts the run',
  Math.abs(Number(aliceRow?.run_distance_m) - base.p_distance_m) < 1,
  aliceRow,
);
const lastWeek = await asUser(db, bob, () =>
  db.query(`select * from rpc_friend_leaderboard(now() - interval '7 days', current_date)`),
);
check(
  'and only for the period asked for',
  Number(lastWeek.rows.find((r) => r.user_id === alice)?.steps) === 15000,
  lastWeek.rows,
);

// --- Reactions and trophy totals -----------------------------------------
await asUser(db, bob, () =>
  db.query(`insert into feed_reactions (subject_type, subject_id, user_id, reaction) values ('activity', $1, $2, 'fire')`, [runId, bob]),
);
await asUser(db, alice, () =>
  db.query(`insert into feed_reactions (subject_type, subject_id, user_id, reaction) values ('activity', $1, $2, 'strong')`, [runId, alice]),
).catch(() => undefined);
const totals = await asUser(db, alice, () => db.query(`select * from rpc_my_trophy_totals()`));
const t = totals.rows[0];
check('your trophy totals count a friend’s reaction, but not your own', Number(t.reactions_received) === 1, t);
check('they include your shared steps and run distance', Number(t.steps_total) === 15000 && Math.abs(t.run_distance_m - base.p_distance_m) < 1, t);
check(
  'nobody can count someone else’s reactions directly',
  /permission denied/.test(await errorOf(() => asUser(db, bob, () => db.query(`select reactions_received($1)`, [alice])))),
);

const stats = await asUser(db, bob, () => db.query(`select * from rpc_friend_stats($1, current_date)`, [alice]));
const s = stats.rows[0];
check(
  'a friend’s stats include their run distance, shared steps and reactions',
  Math.abs(s.run_distance_m - base.p_distance_m) < 1 && Number(s.steps_total) === 15000 && Number(s.reactions_received) === 1,
  s,
);
const bobStats = await asUser(db, alice, () => db.query(`select * from rpc_friend_stats($1, current_date)`, [bob]));
check('and no steps at all for a friend who doesn’t share', bobStats.rows[0].steps_total == null, bobStats.rows[0]);

// --- Featured trophies ---------------------------------------------------
await asUser(db, alice, () =>
  db.query(`update profiles set featured_trophies = $1 where user_id = $2`, [['distance-run:gold', 'friends:wood'], alice]),
);
const shown = await asUser(db, bob, () => db.query(`select featured_trophies from rpc_friend_stats($1, current_date)`, [alice]));
check('two trophies can be shown by your name', shown.rows[0].featured_trophies.length === 2, shown.rows);
check(
  'not three',
  /featured_trophies_shape/.test(
    await errorOf(() =>
      asUser(db, alice, () =>
        db.query(`update profiles set featured_trophies = $1 where user_id = $2`, [['a:gold', 'b:gold', 'c:gold'], alice]),
      ),
    ),
  ),
);
check(
  'and only real tiers',
  /featured_trophies_shape/.test(
    await errorOf(() =>
      asUser(db, alice, () => db.query(`update profiles set featured_trophies = $1 where user_id = $2`, [['bench:mythic'], alice])),
    ),
  ),
);
const feedAgain = await asUser(db, bob, () => db.query(`select * from rpc_friend_feed(30, null)`));
check(
  'a friend’s post shows them',
  feedAgain.rows.find((r) => r.subject_id === runId)?.featured_trophies?.join(',') === 'distance-run:gold,friends:wood',
  feedAgain.rows,
);

// --- Turning sharing off -------------------------------------------------
await asUser(db, alice, () => db.query(`select rpc_set_share_steps(false)`));
const left = await db.query(`select count(*)::int as n from daily_steps where user_id = $1`, [alice]);
check('turning sharing off deletes the totals already shared', left.rows[0].n === 0, left.rows);
const boardAfter = await asUser(db, bob, () => db.query(`select * from rpc_friend_leaderboard(null, current_date)`));
check('and takes you off the steps board', boardAfter.rows.find((r) => r.user_id === alice)?.steps == null, boardAfter.rows);

// --- Export --------------------------------------------------------------
await asUser(db, alice, () => db.query(`select rpc_set_share_steps(true)`));
await asUser(db, alice, () => syncSteps([{ day: day(0), steps: 1234 }]));
const exported = await asUser(db, alice, () => db.query(`select rpc_export_my_data() as d`));
check('Download my data includes the shared daily steps', exported.rows[0].d.daily_steps?.[0]?.steps === 1234, exported.rows[0].d.daily_steps);

// --- Rest days (0025) ----------------------------------------------------
check(
  'a rest day can’t be added for a day that has passed',
  /not a day that has passed/.test(
    await errorOf(() => asUser(db, alice, () => db.query(`insert into rest_days (user_id, rest_date) values ($1, $2)`, [alice, day(-3)]))),
  ),
);
await asUser(db, alice, () => db.query(`insert into rest_days (user_id, rest_date) values ($1, $2)`, [alice, day(1)]));
check('one for a day ahead is fine', true);
await db.exec('alter table rest_days disable trigger rest_days_not_in_past');
await db.query(`insert into rest_days (user_id, rest_date) values ($1, $2)`, [alice, day(-5)]);
await db.exec('alter table rest_days enable trigger rest_days_not_in_past');
await asUser(db, alice, () => db.query(`delete from rest_days where user_id = $1 and rest_date = $2`, [alice, day(-5)]));
const gone = await db.query(`select count(*)::int as n from rest_days where user_id = $1 and rest_date = $2`, [alice, day(-5)]);
check('an old rest day can still be removed', gone.rows[0].n === 0, gone.rows);

done();
