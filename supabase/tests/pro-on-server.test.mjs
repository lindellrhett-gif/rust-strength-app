// Migration 0039: saving to the food diary needs Pro on the server, while
// reading, deleting and downloading what you logged stay open.
import { asUser, check, createUser, done, errorOf, freshDb, givePro } from './harness.mjs';

const db = await freshDb();
const paid = await createUser(db, 'paid@example.com');
const free = await createUser(db, 'free@example.com');
const lapsed = await createUser(db, 'lapsed@example.com');
await givePro(db, paid);
await givePro(db, lapsed);

const entry = (user, name) =>
  db.query(
    `insert into diary_entries (user_id, day, meal, source, name, amount, unit, grams, kcal)
     values ($1, '2026-11-20', 0, 'quick', $2, 1, 'serving', 100, 200) returning id`,
    [user, name],
  );
const rls = (err) => err != null && /row-level security/.test(err);

await asUser(db, paid, async () => {
  check('a Pro account can log food', (await errorOf(() => entry(paid, 'Oats'))) == null);
  const water = await errorOf(() => db.query(`insert into water_logs (user_id, day, ml) values ($1, '2026-11-20', 250)`, [paid]));
  check('and water', water == null, water);
});

await asUser(db, free, async () => {
  check('an account without Pro cannot log food', rls(await errorOf(() => entry(free, 'Oats'))));
  const food = await errorOf(() =>
    db.query(`insert into foods (owner_id, source, name, basis, kcal) values ($1, 'custom', 'My bar', 'serving', 200)`, [free]),
  );
  check('nor make a food', rls(food), food);
  const settings = await errorOf(() => db.query(`insert into nutrition_settings (user_id, net_carbs) values ($1, true)`, [free]));
  check('nor save diary settings', rls(settings), settings);
  const weigh = await errorOf(() =>
    db.query(`insert into body_weights (user_id, kg, measured_on) values ($1, 80, '2026-11-20')`, [free]),
  );
  check('nor a weigh-in', rls(weigh), weigh);
  // Everything else in the app is free.
  const workout = await errorOf(() =>
    db.query(`insert into workouts (user_id, started_at) values ($1, now())`, [free]),
  );
  check('but can still train', workout == null, workout);
});

// Pro ends with entries already logged.
const { rows: logged } = await asUser(db, lapsed, () => entry(lapsed, 'Eggs'));
await db.query(`update subscriptions set pro_active = false where user_id = $1`, [lapsed]);
await asUser(db, lapsed, async () => {
  const { rows } = await db.query(`select name from diary_entries`);
  check('after Pro ends you still see what you logged', rows.length === 1 && rows[0].name === 'Eggs', rows);
  const edit = await errorOf(() => db.query(`update diary_entries set name = 'Toast' where id = $1`, [logged[0].id]));
  check('but cannot change it', rls(edit), edit);
  check('or add more', rls(await errorOf(() => entry(lapsed, 'Toast'))));
  const { rows: exported } = await db.query(`select rpc_export_my_data() as data`);
  check('you can still download it', JSON.stringify(exported[0].data).includes('Eggs'));
  const del = await errorOf(() => db.query(`delete from diary_entries where id = $1`, [logged[0].id]));
  check('and delete it', del == null, del);
  const { rows: left } = await db.query(`select count(*)::int as n from diary_entries`);
  check('which removes it', left[0].n === 0, left);
});

// Nobody can ask about someone else's Pro.
await asUser(db, free, async () => {
  const err = await errorOf(() => db.query(`select has_pro($1)`, [paid]));
  check('has_pro stays out of reach', err != null && /permission denied/.test(err), err);
  const { rows } = await db.query(`select private.i_have_pro() as pro`);
  check('the policy helper only answers for you', rows[0].pro === false, rows);
});

done();
