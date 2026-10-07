// Sharing runs with friends (migration 0021): the feed choice, maps shared
// only on request and always trimmed, and privacy zones nobody else can read.
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

function decodePolyline(str) {
  const points = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lon += next();
    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return points;
}
const metres = (a, b) => {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');
const carol = await createUser(db, 'carol@example.com');
await db.query(`insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [alice, bob]);

const route = decodePolyline(base.p_polyline);
const start = route[0];
const finish = route[route.length - 1];
const feedPost = async (id) =>
  (await db.query(`select * from rpc_friend_feed(50)`)).rows.find((r) => r.subject_id === id);

await asUser(db, alice, async () => {
  const err = await errorOf(() => call('rpc_save_run', base));
  check('alice saves a run', err === null, err);

  // Home is where the run starts.
  const bad = await errorOf(() => call('rpc_add_privacy_zone', { p_lat: start.lat, p_lon: start.lon, p_radius_m: 150, p_label: 'Home' }));
  check('a privacy zone is at least 200 m', bad != null && /200 to 1000/.test(bad), bad);
  const added = await errorOf(() => call('rpc_add_privacy_zone', { p_lat: start.lat, p_lon: start.lon, p_radius_m: 400, p_label: 'Home' }));
  check('alice adds a 400 m zone around home', added === null, added);
  const { rows: zones } = await db.query(`select * from rpc_my_privacy_zones()`);
  check('she sees it with its place and size',
    zones.length === 1 && zones[0].label === 'Home' && Math.abs(zones[0].lat - start.lat) < 1e-6 && zones[0].radius_m === 400, zones);
});

await asUser(db, bob, async () => {
  const { rows } = await db.query(`select * from rpc_my_privacy_zones()`);
  check('bob can’t see alice’s privacy zones', rows.length === 0, rows);
  const { rows: raw } = await db.query(`select * from run_privacy_zones`);
  check('not even by reading the table', raw.length === 0, raw);
  const direct = await errorOf(() => db.query(`select run_shared_route($1)`, [base.p_id]));
  check('bob can’t ask for a route directly', direct != null && /permission/.test(direct), direct);

  const post = await feedPost(base.p_id);
  check('alice’s run is in bob’s feed', post != null && post.activity_kind === 'run');
  check('with stats only: no map until she shares it', post?.route_preview == null, post?.route_preview);
});

await asUser(db, alice, async () => {
  await call('rpc_update_run_details', {
    p_activity_id: base.p_id, p_name: base.p_name, p_note: null, p_effort: null, p_map_visibility: 'friends',
  });
});

await asUser(db, bob, async () => {
  const post = await feedPost(base.p_id);
  check('once she shares the map, bob gets an outline', typeof post?.route_preview === 'string');
  const shown = decodePolyline(post.route_preview);
  check('the outline is simplified to fewer points than the route', shown.length > 1 && shown.length < route.length,
    { shown: shown.length, route: route.length });
  const closestToHome = Math.min(...shown.map((p) => metres(p, start)));
  check('nothing within her 400 m home zone is shown', closestToHome >= 395, closestToHome);
  const closestToFinish = Math.min(...shown.map((p) => metres(p, finish)));
  check('and at least the last 200 m are hidden too', closestToFinish >= 150, closestToFinish);
});

await asUser(db, carol, async () => {
  const post = await feedPost(base.p_id);
  check('someone who isn’t her friend sees nothing', post == null);
});

await asUser(db, alice, async () => {
  await call('rpc_update_run_details', {
    p_activity_id: base.p_id, p_name: base.p_name, p_note: null, p_effort: null, p_share_to_feed: false,
  });
  const { rows } = await db.query(`select share_to_feed from rpc_get_run($1)`, [base.p_id]);
  check('the feed choice comes back with the run', rows[0]?.share_to_feed === false, rows[0]);
  const own = await feedPost(base.p_id);
  check('a run kept off the feed is still in her own', own != null);

  // New runs follow her default.
  await db.query(
    `insert into run_preferences (user_id, share_default) values ($1, false)
     on conflict (user_id) do update set share_default = false`,
    [alice],
  );
  const second = { ...base, p_id: '7a0b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', p_performed_at: '2026-09-27T13:00:00.000Z' };
  await call('rpc_save_run', second);
  const { rows: act } = await db.query(`select share_to_feed from activities where id = $1`, [second.p_id]);
  check('with "share new runs" off, a new run starts off the feed', act[0]?.share_to_feed === false, act[0]);

  const { rows: zones } = await db.query(`select id from rpc_my_privacy_zones()`);
  await call('rpc_remove_privacy_zone', { p_id: zones[0].id });
  const { rows: after } = await db.query(`select * from rpc_my_privacy_zones()`);
  check('she can remove her zone', after.length === 0, after);
});

await asUser(db, bob, async () => {
  const post = await feedPost(base.p_id);
  check('once she keeps it off the feed, bob no longer sees it', post == null);
});

done();
