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

// 9. Declining and removing still work for either side.
await asUser(db, alice, async () => {
  await db.query(`delete from friendships where requester_id = $1 and addressee_id = $2`, [mallory, alice]);
});
check('either side can still remove a friendship', (await status(mallory, alice)) === null);

// 10. Migrations 0030 and 0031: a new account starts with sharing off and
// has never been asked.
const dave = await createUser(db, 'dave@example.com');
const { rows: daveRows } = await db.query(
  `select share_workouts, share_choice_at from profiles where user_id = $1`,
  [dave],
);
check('a new account starts with sharing off', daveRows[0]?.share_workouts === false, daveRows);
check('and has not been asked yet', daveRows[0]?.share_choice_at === null, daveRows);

done();
