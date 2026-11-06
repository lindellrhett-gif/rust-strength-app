// A new profile starts in the weight unit the app sends at sign-up
// (migration 0028), and in pounds when it sends none or anything else.
import { check, done, freshDb } from './harness.mjs';

const db = await freshDb();

async function signUp(email, meta) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify(meta)],
  );
  const profile = await db.query(`select unit, terms_version from profiles where user_id = $1`, [rows[0].id]);
  return profile.rows[0];
}

const metric = await signUp('metric@example.com', { terms_version: '1.6.0', age_confirmed: true, unit: 'kg' });
check('a phone set to metric starts the profile in kilograms', metric?.unit === 'kg', metric);
check('and the consent is still stamped beside it', metric?.terms_version === '1.6.0', metric);

const us = await signUp('us@example.com', { terms_version: '1.6.0', age_confirmed: true, unit: 'lb' });
check('a US phone starts in pounds', us?.unit === 'lb', us);

const older = await signUp('older@example.com', { terms_version: '1.5.0', age_confirmed: true });
check('version 1.1 sends no unit and still gets pounds', older?.unit === 'lb', older);

const junk = await signUp('junk@example.com', { unit: 'stone' });
check('an unknown unit falls back to pounds instead of failing the sign-up', junk?.unit === 'lb', junk);

done();
