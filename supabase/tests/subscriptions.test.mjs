// Rust Strength Pro's server mirror (0026): only the webhook writes it, each
// person reads only their own row, has_pro is for server code only and
// treats a lapsed expiry as not Pro, and the export and account deletion
// cover it.
import { asAnon, asUser, check, createUser, done, errorOf, freshDb } from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

// What the webhook does, with the service role (here, the superuser).
const mirror = (user, active, expires) =>
  db.query(
    `insert into subscriptions (user_id, pro_active, product_id, period_type, store, expires_at, will_renew)
     values ($1, $2, 'pro_yearly', 'NORMAL', 'APP_STORE', $3, true)
     on conflict (user_id) do update set pro_active = excluded.pro_active, expires_at = excluded.expires_at`,
    [user, active, expires],
  );
await mirror(alice, true, future);

// --- Who can read and write ---------------------------------------------
const own = await asUser(db, alice, () => db.query(`select * from subscriptions`));
check('you can read your own subscription', own.rows.length === 1 && own.rows[0].user_id === alice, own.rows);
const theirs = await asUser(db, bob, () => db.query(`select * from subscriptions`));
check('nobody else can read it', theirs.rows.length === 0, theirs.rows);

check(
  'you can’t make yourself Pro',
  !!(await errorOf(() =>
    asUser(db, bob, () =>
      db.query(`insert into subscriptions (user_id, pro_active, expires_at) values ($1, true, $2)`, [bob, future]),
    ),
  )),
);
check(
  'you can’t extend your own subscription',
  !!(await errorOf(() =>
    asUser(db, alice, () => db.query(`update subscriptions set expires_at = now() + interval '10 years'`)),
  )),
);
const afterTamper = await db.query(`select expires_at from subscriptions where user_id = $1`, [alice]);
check('and the row is unchanged', new Date(afterTamper.rows[0].expires_at).toISOString() === future, afterTamper.rows);

// --- has_pro --------------------------------------------------------------
const hasPro = async (user) => (await db.query(`select has_pro($1) as pro`, [user])).rows[0].pro;
check('has_pro is true for an active subscription', (await hasPro(alice)) === true);
check('and false with no subscription', (await hasPro(bob)) === false);
await mirror(alice, true, past);
check('a lapsed expiry is not Pro even if a webhook was missed', (await hasPro(alice)) === false);
await mirror(alice, true, future);
check(
  'has_pro can’t be called from the app',
  !!(await errorOf(() => asUser(db, bob, () => db.query(`select has_pro($1)`, [alice])))) &&
    !!(await errorOf(() => asAnon(db, () => db.query(`select has_pro($1)`, [alice])))),
);

// --- Export and deletion ---------------------------------------------------
const exported = await asUser(db, alice, () => db.query(`select rpc_export_my_data() as data`));
check('the export includes the subscription', exported.rows[0].data.subscription?.product_id === 'pro_yearly');
const bobExport = await asUser(db, bob, () => db.query(`select rpc_export_my_data() as data`));
check('and is empty for someone without one', bobExport.rows[0].data.subscription == null);

await asUser(db, alice, () => db.query(`select rpc_delete_my_account()`));
const left = await db.query(`select count(*)::int as n from subscriptions where user_id = $1`, [alice]);
check('deleting the account deletes the subscription row', left.rows[0].n === 0, left.rows);

done();
