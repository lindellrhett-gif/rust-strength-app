// Signing in with Google or Apple stores no name or picture (migration 0029):
// only the email address and the ids Supabase matches accounts by.
import { check, done, freshDb } from './harness.mjs';

const db = await freshDb();

// What Supabase Auth writes for a first Google sign-in.
const google = {
  iss: 'https://accounts.google.com',
  sub: '109876543210987654321',
  provider_id: '109876543210987654321',
  email: 'lifter@gmail.com',
  email_verified: true,
  phone_verified: false,
  name: 'Pat Lifter',
  full_name: 'Pat Lifter',
  given_name: 'Pat',
  family_name: 'Lifter',
  picture: 'https://lh3.googleusercontent.com/a/photo',
  avatar_url: 'https://lh3.googleusercontent.com/a/photo',
};

const { rows } = await db.query(
  `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id, raw_user_meta_data`,
  [google.email, JSON.stringify(google)],
);
const user = rows[0];
const meta = user.raw_user_meta_data;
check(
  'the account keeps no name or picture',
  !['name', 'full_name', 'given_name', 'family_name', 'picture', 'avatar_url'].some((k) => k in meta),
  meta,
);
check(
  'but keeps what Supabase matches accounts by',
  meta.sub === google.sub && meta.email === google.email && meta.email_verified === true,
  meta,
);

const identity = await db.query(
  `insert into auth.identities (user_id, provider, provider_id, identity_data)
   values ($1, 'google', $2, $3) returning identity_data`,
  [user.id, google.sub, JSON.stringify(google)],
);
const data = identity.rows[0].identity_data;
check('the identity keeps no name or picture', !('name' in data) && !('picture' in data), data);
check('and keeps its id and email', data.sub === google.sub && data.email === google.email, data);

// Every later sign-in writes the token's claims again.
const again = await db.query(
  `update auth.users set raw_user_meta_data = raw_user_meta_data || $2 where id = $1 returning raw_user_meta_data`,
  [user.id, JSON.stringify({ name: 'Pat Lifter', picture: 'https://lh3.googleusercontent.com/a/new' })],
);
check('a later sign-in adds no name either', !('name' in again.rows[0].raw_user_meta_data), again.rows[0]);

const profile = await db.query(`select username from profiles where user_id = $1`, [user.id]);
check(
  'and the profile still starts with a random handle',
  /^lifter_[0-9a-f]{6}$/.test(profile.rows[0]?.username ?? ''),
  profile.rows[0],
);

// An email sign-up's own metadata goes through untouched.
const email = await db.query(
  `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning raw_user_meta_data`,
  ['email@example.com', JSON.stringify({ terms_version: '1.6.0', age_confirmed: true, unit: 'kg' })],
);
const emailMeta = email.rows[0].raw_user_meta_data;
check(
  'an email sign-up keeps its consent and unit',
  emailMeta.terms_version === '1.6.0' && emailMeta.age_confirmed === true && emailMeta.unit === 'kg',
  emailMeta,
);

done();
