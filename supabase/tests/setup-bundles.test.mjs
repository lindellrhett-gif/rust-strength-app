// The paste-in setup files for a fresh project (npm run db:bundle): each part
// must succeed on its own inside ONE transaction, the way the Supabase SQL
// editor runs it, and together they must match applying the migrations
// one by one.
import { createRequire } from 'node:module';

import { check, done, freshDb, stubDb } from './harness.mjs';

const require = createRequire(import.meta.url);
const { buildParts, render } = require('../../scripts/build-dev-sql.js');

const parts = buildParts();
check('there are at least two parts (enum values need their own transaction)', parts.length >= 2, parts.length);

const db = await stubDb();
for (const [i, part] of parts.entries()) {
  const sql = render(part, i, parts.length);
  let error = null;
  try {
    await db.exec(`begin;\n${sql}\ncommit;`);
  } catch (e) {
    error = e.message;
    await db.exec('rollback').catch(() => {});
  }
  check(`part ${i + 1} runs as one transaction (${part.map((f) => f.name).join(', ')})`, error === null, error);
  await db.exec(`set search_path = "$user", public, extensions`);
}

const TABLES = `select table_name from information_schema.tables where table_schema = 'public' order by 1`;
const FUNCTIONS = `select routine_name from information_schema.routines where routine_schema = 'public' order by 1`;
const EXERCISES = `select count(*)::int n from exercises where user_id is null`;

const reference = await freshDb();
const [t1, t2] = [(await db.query(TABLES)).rows, (await reference.query(TABLES)).rows];
check('the parts create the same tables as the migrations', JSON.stringify(t1) === JSON.stringify(t2), {
  parts: t1.length,
  migrations: t2.length,
});
const [f1, f2] = [(await db.query(FUNCTIONS)).rows, (await reference.query(FUNCTIONS)).rows];
check('the parts create the same functions as the migrations', JSON.stringify(f1) === JSON.stringify(f2), {
  parts: f1.length,
  migrations: f2.length,
});
const [e1, e2] = [(await db.query(EXERCISES)).rows[0].n, (await reference.query(EXERCISES)).rows[0].n];
check('the parts seed the same exercise catalog', e1 === e2 && e1 > 100, { parts: e1, migrations: e2 });

done();
