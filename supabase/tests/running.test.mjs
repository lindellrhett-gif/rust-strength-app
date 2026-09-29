// Migration 0015: saving and reading runs, validation, and isolation between users.
import { randomUUID } from 'node:crypto';
import {
  asAnon,
  asUser,
  check,
  createUser,
  done,
  encodePolyline,
  errorOf,
  freshDb,
  straightRoute,
} from './harness.mjs';

const db = await freshDb();
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

const HOME = { lat: 47.9253, lon: -97.0329 };
// 501 points 10 m apart: a 5 km straight line.
const pts = straightRoute(HOME, 501, 10);
const polyline = encodePolyline(pts);
const times = pts.map((_, i) => i * 3); // 3 s per 10 m
const alts = pts.map((_, i) => 250 + (i % 50) / 10);

const SAVE = `select rpc_save_run(
  p_id => $1, p_performed_at => $2, p_source => $3, p_distance_m => $4,
  p_moving_seconds => $5, p_elapsed_seconds => $6, p_distance_unit => $7,
  p_name => $8, p_note => $9, p_elevation_gain_m => $10, p_elevation_loss_m => $11,
  p_calories => $12, p_effort => $13, p_splits => $14, p_polyline => $15,
  p_alts => $16, p_times => $17, p_best_efforts => $18, p_map_visibility => $19
) as id`;

function gpsRun(overrides = {}) {
  return {
    id: randomUUID(),
    performedAt: '2026-09-26T13:00:00Z',
    source: 'gps',
    distanceM: 4990,
    moving: 1500,
    elapsed: 1560,
    unit: 'mi',
    name: 'Morning run',
    note: null,
    gain: 12,
    loss: 11,
    calories: 350,
    effort: 6,
    splits: JSON.stringify([[480, 3, 1609.344], [482, -2, 1609.344], [481, 0, 1609.344], [57, 1, 161.968]]),
    polyline,
    alts,
    times,
    efforts: JSON.stringify({ mile: 470 }),
    map: 'private',
    ...overrides,
  };
}

const save = (r) =>
  db.query(SAVE, [
    r.id, r.performedAt, r.source, r.distanceM, r.moving, r.elapsed, r.unit, r.name, r.note,
    r.gain, r.loss, r.calories, r.effort, r.splits, r.polyline, r.alts, r.times, r.efforts, r.map,
  ]);

// --- Saving and reading back -----------------------------------------------
const run = gpsRun();
await asUser(db, alice, async () => {
  const { rows } = await save(run);
  check('alice saves a recorded run', rows[0].id === run.id, rows);

  const again = await save(run);
  check('replaying the same save returns the same run', again.rows[0].id === run.id);
  const { rows: count } = await db.query(`select count(*)::int n from activities where id = $1`, [run.id]);
  check('the replay made no duplicate', count[0].n === 1, count);

  const { rows: act } = await db.query(`select kind, distance, distance_unit, duration_seconds, calories, name from activities where id = $1`, [run.id]);
  check('the activity is a run, in miles, timed by moving time',
    act[0].kind === 'run' && act[0].distance_unit === 'mi' && Math.abs(act[0].distance - 3.1) < 0.01 &&
    act[0].duration_seconds === 1500 && act[0].calories === 350 && act[0].name === 'Morning run', act[0]);

  const { rows: got } = await db.query(`select * from rpc_get_run($1)`, [run.id]);
  const g = got[0];
  check('the route comes back as the same polyline', g.polyline === polyline, g.polyline?.slice(0, 40));
  check('times come back point for point', JSON.stringify(g.times) === JSON.stringify(times));
  check('altitudes come back point for point',
    g.alts.length === alts.length && g.alts.every((a, i) => Math.abs(a - alts[i]) < 0.01));
  check('best efforts come back', g.best_efforts.mile === 470, g.best_efforts);
  check('run fields come back', g.source === 'gps' && g.moving_seconds === 1500 && g.elapsed_seconds === 1560 &&
    g.effort === 6 && g.has_elevation === true && g.map_visibility === 'private', g);

  const { rows: geom } = await db.query(
    `select ST_NPoints(route) n, ST_SRID(route) srid, GeometryType(route) t, round(ST_Length(route::geography)) len from runs where activity_id = $1`,
    [run.id],
  );
  check('stored as one LineStringZM row in WGS 84', geom[0].n === 501 && geom[0].srid === 4326 && /LINESTRING/.test(geom[0].t), geom[0]);
  check('the stored line is 5 km long, within the test helper 1%', Math.abs(Number(geom[0].len) - 5000) < 50, geom[0].len);
});

// --- A manual run ----------------------------------------------------------
await asUser(db, alice, async () => {
  const manual = gpsRun({ id: randomUUID(), source: 'treadmill', polyline: null, alts: null, times: null, distanceM: 8000, moving: 2700, elapsed: 2700, efforts: '{}' });
  const err = await errorOf(() => save(manual));
  check('a treadmill run saves with no route', err === null, err);
});

// --- Validation --------------------------------------------------------------
const rejects = async (label, overrides, pattern) => {
  const err = await asUser(db, alice, () => errorOf(() => save(gpsRun({ id: randomUUID(), ...overrides }))));
  check(label, err != null && (!pattern || pattern.test(err)), err);
};
await rejects('refuses more distance than the route', { distanceM: 9000, moving: 2700, elapsed: 2700 }, /longer than the route/);
await rejects('refuses times that do not start at 0', { times: times.map((t) => t + 5) }, /start at 0/);
await rejects('refuses times that go backwards', { times: times.map((t, i) => (i === 100 ? 1 : t)) }, /backwards/);
await rejects('refuses a time count that does not match', { times: times.slice(1) }, /needs a time/);
await rejects('refuses altitudes that do not match', { alts: alts.slice(3) }, /altitudes/);
await rejects('refuses a garbled route', { polyline: '_p~iF~ps|U_' }, /could not be read|2 to 20000|needs a time/);
await rejects('refuses a recorded run with no route', { polyline: null }, /needs its route/);
await rejects('refuses a route on a typed-in run', { source: 'manual' }, /Only a recorded run/);
await rejects('refuses an impossible pace', { distanceM: 4990, moving: 500, elapsed: 600, times: times.map((t) => Math.floor(t / 4)) }, /check|constraint/i);
await rejects('refuses effort outside 1–10', { effort: 11 }, /Effort/);
await rejects('refuses a 10K best effort on a 5K run', { efforts: JSON.stringify({ '10k': 3000 }) }, /does not fit/);
await rejects('refuses an unknown best effort', { efforts: JSON.stringify({ '3k': 600 }) }, /Unknown best effort/);
await rejects('refuses a best effort faster than possible', { efforts: JSON.stringify({ mile: 100 }) }, /does not fit/);
await rejects('refuses a very long title', { name: 'x'.repeat(81) }, /80 characters/);
await rejects('refuses an unknown map setting', { map: 'everyone' }, /Map visibility/);
await rejects('refuses a future date', { performedAt: '2030-01-01T00:00:00Z' }, /believable/);
await rejects('refuses an elapsed time shorter than moving', { elapsed: 1000, times: times.map((t) => Math.floor(t / 2)) }, /check|constraint/i);

// --- Isolation -----------------------------------------------------------------
await asUser(db, bob, async () => {
  const { rows } = await db.query(`select * from rpc_get_run($1)`, [run.id]);
  check("bob cannot read alice's run through the RPC", rows.length === 0, rows.length);
  const { rows: direct } = await db.query(`select count(*)::int n from runs`);
  check("bob sees none of alice's run rows", direct[0].n === 0, direct[0]);
  const { rows: eff } = await db.query(`select count(*)::int n from run_best_efforts`);
  check("bob sees none of alice's best efforts", eff[0].n === 0, eff[0]);

  const err = await errorOf(() =>
    db.query(
      `insert into runs (activity_id, user_id, source, distance_m, moving_seconds, elapsed_seconds) values ($1, $2, 'manual', 5000, 1500, 1500)`,
      [run.id, bob],
    ),
  );
  check("bob cannot hang a run row off alice's activity", err != null, err);

  const err2 = await errorOf(() =>
    db.query(`insert into run_best_efforts (activity_id, user_id, effort_key, seconds) values ($1, $2, 'mile', 300)`, [run.id, bob]),
  );
  check("bob cannot add a best effort to alice's run", err2 != null, err2);

  const replay = await errorOf(() => save({ ...gpsRun(), id: run.id }));
  check("bob cannot reuse alice's run id", replay != null && /already in use/.test(replay), replay);

  const upd = await db.query(`update runs set effort = 1 where activity_id = $1`, [run.id]);
  check("bob's update of alice's run touches nothing", upd.affectedRows === 0, upd.affectedRows);
});

await asAnon(db, async () => {
  const err = await errorOf(() => save(gpsRun({ id: randomUUID() })));
  check('signed-out callers cannot save a run', err != null, err);
});

// --- Privacy zones -------------------------------------------------------------
await asUser(db, alice, async () => {
  for (let i = 0; i < 10; i += 1) {
    await db.query(`insert into run_privacy_zones (user_id, label, center, radius_m) values ($1, $2, ST_MakePoint(-97.03, 47.92)::geography, 400)`, [alice, `zone ${i}`]);
  }
  const err = await errorOf(() =>
    db.query(`insert into run_privacy_zones (user_id, center, radius_m) values ($1, ST_MakePoint(-97.03, 47.92)::geography, 400)`, [alice]),
  );
  check('an eleventh privacy zone is refused', err != null && /10 privacy zones/.test(err), err);
  const small = await errorOf(() =>
    db.query(`insert into run_privacy_zones (user_id, center, radius_m) values ($1, ST_MakePoint(-97.03, 47.92)::geography, 50)`, [alice]),
  );
  check('a zone smaller than 200 m is refused', small != null, small);
});
await asUser(db, bob, async () => {
  const { rows } = await db.query(`select count(*)::int n from run_privacy_zones`);
  check("bob cannot see alice's privacy zones", rows[0].n === 0, rows[0]);
  const err = await errorOf(() =>
    db.query(`insert into run_privacy_zones (user_id, center, radius_m) values ($1, ST_MakePoint(-97.03, 47.92)::geography, 400)`, [alice]),
  );
  check('bob cannot create a zone for alice', err != null, err);
});

// --- Preferences ---------------------------------------------------------------
await asUser(db, alice, async () => {
  await db.query(`insert into run_preferences (user_id) values ($1)`, [alice]);
  const { rows } = await db.query(`select auto_pause, audio_cues, share_default, map_default from run_preferences`);
  check('preferences default to auto-pause on, cues on, feed on, map private',
    rows[0].auto_pause && rows[0].audio_cues && rows[0].share_default && rows[0].map_default === 'private', rows[0]);
});

// --- Deleting ------------------------------------------------------------------
await asUser(db, alice, async () => {
  await db.query(`delete from activities where id = $1`, [run.id]);
  const { rows } = await db.query(
    `select (select count(*) from runs where activity_id = $1)::int r, (select count(*) from run_best_efforts where activity_id = $1)::int e`,
    [run.id],
  );
  check('deleting the activity removes the run and its best efforts', rows[0].r === 0 && rows[0].e === 0, rows[0]);
});

done();
