// Runs the project's real migrations inside PGlite (Postgres compiled to
// WebAssembly, with PostGIS) behind just enough of a Supabase stub to satisfy
// them, then offers helpers for acting as a signed-in user under RLS.
//
// No Docker or Supabase CLI needed. Supabase runs a different Postgres build
// and much more machinery, so this proves the SQL logic and the RLS policies,
// not the deployment: still apply migrations to the dev project first.
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUPABASE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATIONS = join(SUPABASE_DIR, 'migrations');
export const SEED = join(SUPABASE_DIR, 'seed.sql');

/** The seed ran right after migration 0002 in production, so it does here too. */
export const SEED_AFTER = 2;

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to current_user;

create schema auth;
create schema extensions;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema extensions grant all on functions to anon, authenticated, service_role;
`;

/** Supabase's database search_path. */
const SEARCH_PATH = `set search_path = "$user", public, extensions`;

/** Migration files in order, as { number, name, path }. */
export function migrationFiles() {
  return readdirSync(MIGRATIONS)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((name) => ({ number: Number(name.slice(0, 4)), name, path: join(MIGRATIONS, name) }));
}

/** An empty database with the Supabase stub, before any migration. */
export async function stubDb() {
  const db = new PGlite({ extensions: { postgis } });
  await db.exec(SUPABASE_STUB);
  await db.exec(SEARCH_PATH);
  return db;
}

/** A database with every migration (up to `upTo`) and the seed applied. */
export async function freshDb({ upTo = Infinity } = {}) {
  const db = await stubDb();
  for (const m of migrationFiles()) {
    if (m.number > upTo) break;
    try {
      await db.exec(readFileSync(m.path, 'utf8'));
      await db.exec(SEARCH_PATH);
      if (m.number === SEED_AFTER) await db.exec(readFileSync(SEED, 'utf8'));
    } catch (e) {
      throw new Error(`migration ${m.name} failed: ${e.message}`);
    }
  }
  return db;
}

export async function createUser(db, email) {
  const { rows } = await db.query(`insert into auth.users (email) values ($1) returning id`, [email]);
  return rows[0].id;
}

/** Run fn with the connection acting as a signed-in user, RLS enforced. */
export async function asUser(db, userId, fn) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

/** Run fn as a signed-out caller. */
export async function asAnon(db, fn) {
  await db.exec(`set role anon`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
  }
}

/** Resolves to the error message, or null if fn succeeded. */
export async function errorOf(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
}

// Google polyline encoding: the same algorithm as src/domain/running/polyline.ts.
function encodeValue(value) {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

export function encodePolyline(points) {
  let prevLat = 0;
  let prevLon = 0;
  let out = '';
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lon = Math.round(p.lon * 1e5);
    out += encodeValue(lat - prevLat) + encodeValue(lon - prevLon);
    prevLat = lat;
    prevLon = lon;
  }
  return out;
}

/**
 * A straight route east: n points, about `step` metres apart. Uses a flat
 * metres-per-degree figure, so lengths are good to about half a percent.
 */
export function straightRoute(start, n, step) {
  const perDegree = 111_320 * Math.cos((start.lat * Math.PI) / 180);
  return Array.from({ length: n }, (_, i) => ({ lat: start.lat, lon: start.lon + (i * step) / perDegree }));
}

let failures = 0;
export function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `\n      got: ${JSON.stringify(detail)}`}`);
  if (!ok) failures += 1;
}

export function done() {
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exitCode = failures ? 1 : 0;
}
