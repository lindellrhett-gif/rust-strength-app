// Migrations 0032 to 0034: friendships can't be forced, self-accepted,
// rewritten or sent across a block, and nobody can read another person's
// profile row (it used to expose their bodyweight).
import { asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');
const carol = await createUser(db, 'carol@example.com');
const mallory = await createUser(db, 'mallory@example.com');

await db.query(`update profiles set body_weight = 61.5 where user_id = $1`, [alice]);

const status = async (a, b) => {
  const { rows } = await db.query(
    `select status from friendships
      where (requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1)`,
    [a, b],
  );
  return rows[0]?.status ?? null;
};

// 1. A request can't be created already accepted.
await asUser(db, mallory, async () => {
  const err = await errorOf(() =>
    db.query(`insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [mallory, alice]),
  );
  check('an accepted friendship cannot be inserted', err !== null, err);
});
check('so mallory is not alice’s friend', (await status(mallory, alice)) === null);

// 2. A request can't be sent as somebody else, or to yourself.
await asUser(db, mallory, async () => {
  const asOther = await errorOf(() =>
    db.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [bob, alice]),
  );
  check('a request cannot be sent as someone else', asOther !== null, asOther);
});

// 3. The requester can't accept their own request.
await asUser(db, mallory, async () => {
  await db.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [mallory, alice]);
  await db.query(`update friendships set status = 'accepted' where requester_id = $1 and addressee_id = $2`, [mallory, alice]);
});
check('the requester cannot accept their own request', (await status(mallory, alice)) === 'pending');

// 4. The addressee can't move the friendship onto someone else.
await asUser(db, alice, async () => {
  const err = await errorOf(() =>
    db.query(`update friendships set requester_id = $1 where requester_id = $2 and addressee_id = $3`, [carol, mallory, alice]),
  );
  check('who a friendship is between cannot be changed', err !== null, err);
});

// 5. A pending request no longer opens the profile row.
await asUser(db, mallory, async () => {
  const { rows } = await db.query(`select body_weight from profiles where user_id = $1`, [alice]);
  check('a pending request cannot read alice’s bodyweight', rows.length === 0, rows);
  const names = await db.query(`select * from rpc_profile_names($1::uuid[])`, [[alice]]);
  check('but can read her name', names.rows.length === 1 && names.rows[0].username !== undefined, names.rows);
  check('and only her name', !('body_weight' in (names.rows[0] ?? {})));
});

// 6. The app's own flow still works: alice accepts, and the names still load.
await asUser(db, alice, async () => {
  await db.query(
    `update friendships set status = 'accepted', responded_at = now() where requester_id = $1 and addressee_id = $2`,
    [mallory, alice],
  );
});
check('the addressee can accept', (await status(mallory, alice)) === 'accepted');
await asUser(db, mallory, async () => {
  const { rows } = await db.query(`select body_weight from profiles where user_id = $1`, [alice]);
  check('an accepted friend cannot read alice’s bodyweight either', rows.length === 0, rows);
  const own = await db.query(`select user_id from profiles where user_id = $1`, [mallory]);
  check('everyone still reads their own profile', own.rows.length === 1);
});

// 7. No names for strangers.
await asUser(db, carol, async () => {
  const { rows } = await db.query(`select * from rpc_profile_names($1::uuid[])`, [[alice]]);
  check('a stranger gets no names', rows.length === 0, rows);
});

// 8. Blocks stop requests in both directions.
await asUser(db, bob, async () => {
  await db.query(`insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [bob, carol]);
});
await asUser(db, carol, async () => {
  const err = await errorOf(() =>
    db.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [carol, bob]),
  );
  check('someone blocked cannot send a request to the blocker', err !== null, err);
});
await asUser(db, bob, async () => {
  const err = await errorOf(() =>
    db.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [bob, carol]),
  );
  check('nor can the blocker send one to them', err !== null, err);
});
await asUser(db, alice, async () => {
  const { rows } = await db.query(`select private.blocked_either_way($1, $2) b`, [bob, carol]);
  check('nobody can ask about blocks between two other people', rows[0].b === false, rows[0]);
});
const exposed = await db.query(
  `select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname = 'blocked_either_way'`,
);
check('the block check is not in the schema the API exposes', exposed.rows[0].n === 0, exposed.rows[0]);

// 9. Declining and removing still work for either side.
await asUser(db, alice, async () => {
  await db.query(`delete from friendships where requester_id = $1 and addressee_id = $2`, [mallory, alice]);
});
check('either side can still remove a friendship', (await status(mallory, alice)) === null);

// 9b. The server stamps when a request was accepted, whatever the client sends.
const erin = await createUser(db, 'erin@example.com');
const frank = await createUser(db, 'frank@example.com');
await asUser(db, erin, async () => {
  await db.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [erin, frank]);
});
await asUser(db, frank, async () => {
  await db.query(
    `update friendships set status = 'accepted', responded_at = '1970-01-01' where requester_id = $1 and addressee_id = $2`,
    [erin, frank],
  );
});
const stamped = await db.query(
  `select responded_at > now() - interval '1 hour' recent from friendships where requester_id = $1 and addressee_id = $2`,
  [erin, frank],
);
check('the accept time is the server’s, not the client’s', stamped.rows[0]?.recent === true, stamped.rows[0]);

// 9c. A block written straight into user_blocks still ends the friendship.
await asUser(db, frank, async () => {
  await db.query(`insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [frank, erin]);
});
check('any block removes the friendship', (await status(erin, frank)) === null);

// 9d. A pending request can't be accepted across a block.
const gus = await createUser(db, 'gus@example.com');
const hana = await createUser(db, 'hana@example.com');
await asUser(db, gus, async () => {
  await db.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [gus, hana]);
});
// The block lands without its teardown, as a race could leave it.
await db.query(`alter table user_blocks disable trigger user_blocks_teardown`);
await db.query(`insert into user_blocks (blocker_id, blocked_id) values ($1, $2)`, [gus, hana]);
await db.query(`alter table user_blocks enable trigger user_blocks_teardown`);
await asUser(db, hana, async () => {
  const err = await errorOf(() =>
    db.query(`update friendships set status = 'accepted' where requester_id = $1 and addressee_id = $2`, [gus, hana]),
  );
  check('a request cannot be accepted across a block', err !== null, err);
});
check('so it stays pending', (await status(gus, hana)) === 'pending');

// 10. Migrations 0030 and 0031: a new account starts with sharing off and
// has never been asked.
const dave = await createUser(db, 'dave@example.com');
const { rows: daveRows } = await db.query(
  `select share_workouts, share_choice_at from profiles where user_id = $1`,
  [dave],
);
check('a new account starts with sharing off', daveRows[0]?.share_workouts === false, daveRows);
check('and has not been asked yet', daveRows[0]?.share_choice_at === null, daveRows);

// 11. The state that goes live first: 0032 and 0033 without 0034, with the 1.1
// app still reading friends' names straight from profiles.
const mid = await freshDb({ upTo: 33 });
const ann = await createUser(mid, 'ann@example.com');
const ben = await createUser(mid, 'ben@example.com');
const names1_1 = (who, other) =>
  asUser(mid, who, () =>
    mid.query(`select user_id, username, display_name from profiles where user_id = any($1::uuid[])`, [[other]]),
  );
await asUser(mid, ann, () =>
  mid.query(`insert into friendships (requester_id, addressee_id) values ($1, $2)`, [ann, ben]),
);
check('before 0034, 1.1 still reads a pending friend’s name', (await names1_1(ann, ben)).rows.length === 1);
check('both ways', (await names1_1(ben, ann)).rows.length === 1);
// postgrest-js sends an accept as an update of just these two columns.
const accept = (who) =>
  asUser(mid, who, () =>
    mid.query(
      `update friendships set status = b.status, responded_at = b.responded_at
         from (select * from json_populate_recordset(null::friendships, $1::json)) b
        where friendships.requester_id = $2 and friendships.addressee_id = $3`,
      [JSON.stringify([{ status: 'accepted', responded_at: new Date().toISOString() }]), ann, ben],
    ),
  );
check('the requester’s accept, as the app sends it, changes nothing', (await accept(ann)).affectedRows === 0);
check('the addressee’s accept, as the app sends it, works', (await accept(ben)).affectedRows === 1);
check('and 1.1 still reads the accepted friend’s name', (await names1_1(ann, ben)).rows.length === 1);

done();
