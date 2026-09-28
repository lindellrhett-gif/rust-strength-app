#!/usr/bin/env node
/**
 * Writes the simulated runs the GPS pipeline is tested against, into
 * __tests__/fixtures/gpx/. Deterministic: the same seed gives the same files,
 * so they can be regenerated and diffed.
 *
 *   node scripts/make-gpx-fixtures.js
 *
 * Each file is a known "true" run with realistic GPS noise layered on top.
 * The truth (distance, moving time, climb) is recorded in fixtures.json so
 * the tests compare what the pipeline recovers against what really happened.
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '__tests__', 'fixtures', 'gpx');
const EARTH_RADIUS_M = 6_371_008.8;
const RAD = Math.PI / 180;
const START = { lat: 47.9253, lon: -97.0329 }; // Grand Forks, ND
const T0 = Date.parse('2026-09-26T13:00:00Z');
const FIX_EVERY_S = 2;

// Mulberry32: small, seedable, good enough for noise.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

function offset(from, metres, bearingDeg) {
  const d = metres / EARTH_RADIUS_M;
  const brg = bearingDeg * RAD;
  const lat1 = from.lat * RAD;
  const lon1 = from.lon * RAD;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
  const lon2 =
    lon1 +
    Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 / RAD, lon: lon2 / RAD };
}

/**
 * Plays a list of legs and returns fixes plus the truth.
 *   { move: metres, speed, bearing? }  running or walking, fixes every 2 s
 *   { stop: seconds }                  standing still, GPS still reporting
 *   { gap: seconds, speed }            moving with no fixes (a tunnel)
 *   { pause: true, jump?: metres }     manual pause: new segment, optionally
 *                                      somewhere else
 *   { teleport: metres }               GPS reappears somewhere impossible
 */
function simulate({ seed, legs, noise = 1.5, accuracy = [5, 8], altitude = () => 256, altNoise = 1.5 }) {
  const rand = rng(seed);
  let pos = { ...START };
  let t = 0;
  let seg = 0;
  let along = 0; // true distance run, for the altitude profile
  let moving = 0;
  const truth = { distanceM: 0, movingSeconds: 0, elapsedSeconds: 0 };
  const fixes = [];

  const emit = (extra = {}) => {
    const e = offset(pos, Math.abs(gaussian(rand)) * noise, rand() * 360);
    fixes.push({
      lat: e.lat,
      lon: e.lon,
      ele: altitude(along) + gaussian(rand) * altNoise,
      t,
      hdop: (accuracy[0] + rand() * (accuracy[1] - accuracy[0])) / 5,
      seg,
      ...extra,
    });
  };

  emit();
  for (const leg of legs) {
    if (leg.move != null) {
      const steps = Math.round(leg.move / (leg.speed * FIX_EVERY_S));
      const stepM = leg.move / steps;
      for (let i = 0; i < steps; i += 1) {
        pos = offset(pos, stepM, leg.bearing ?? 90);
        along += stepM;
        t += stepM / leg.speed;
        moving += stepM / leg.speed;
        emit();
      }
      truth.distanceM += leg.move;
    } else if (leg.stop != null) {
      for (let s = FIX_EVERY_S; s <= leg.stop; s += FIX_EVERY_S) {
        t += FIX_EVERY_S;
        emit();
      }
    } else if (leg.gap != null) {
      const metres = leg.gap * leg.speed;
      pos = offset(pos, metres, leg.bearing ?? 90);
      along += metres;
      t += leg.gap;
      moving += leg.gap;
      truth.distanceM += metres;
    } else if (leg.pause) {
      t += leg.seconds ?? 120;
      if (leg.jump) pos = offset(pos, leg.jump, 0);
      seg += 1;
      emit();
    } else if (leg.teleport != null) {
      t += leg.after ?? 30;
      pos = offset(pos, leg.teleport, 0);
      emit();
    }
  }
  truth.movingSeconds = Math.round(moving);
  truth.elapsedSeconds = Math.round(t);
  return { fixes, truth };
}

function toGpx(name, fixes) {
  const bySeg = new Map();
  for (const f of fixes) {
    if (!bySeg.has(f.seg)) bySeg.set(f.seg, []);
    bySeg.get(f.seg).push(f);
  }
  const segs = [...bySeg.values()]
    .map(
      (list) =>
        '    <trkseg>\n' +
        list
          .map(
            (f) =>
              `      <trkpt lat="${f.lat.toFixed(7)}" lon="${f.lon.toFixed(7)}">` +
              `<ele>${f.ele.toFixed(1)}</ele>` +
              `<time>${new Date(T0 + f.t * 1000).toISOString()}</time>` +
              `<hdop>${f.hdop.toFixed(2)}</hdop></trkpt>`,
          )
          .join('\n') +
        '\n    </trkseg>',
    )
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="Rust Strength test fixtures" xmlns="http://www.topografix.com/GPX/1/1">\n' +
    `  <trk>\n    <name>${name}</name>\n${segs}\n  </trk>\n</gpx>\n`
  );
}

const hill = (along) => {
  // Flat, then 30 m up over 1 km, then back down over 1 km, then flat.
  if (along < 500) return 250;
  if (along < 1500) return 250 + ((along - 500) / 1000) * 30;
  if (along < 2500) return 280 - ((along - 1500) / 1000) * 30;
  return 250;
};

const SCENARIOS = {
  'steady-5k': { seed: 1, legs: [{ move: 5000, speed: 3.0 }] },
  tunnel: {
    seed: 2,
    legs: [{ move: 1400, speed: 3.0 }, { gap: 60, speed: 3.0 }, { move: 1420, speed: 3.0 }],
  },
  stoplight: {
    seed: 3,
    legs: [{ move: 1500, speed: 3.0 }, { stop: 45 }, { move: 1500, speed: 3.0, bearing: 0 }],
  },
  'jittery-start': { seed: 4, legs: [{ move: 2000, speed: 3.0 }] },
  spike: { seed: 5, legs: [{ move: 2000, speed: 3.0 }] },
  'walk-breaks': {
    seed: 6,
    legs: [1, 2, 3, 4].flatMap(() => [
      { move: 400, speed: 3.2 },
      { move: 200, speed: 1.3 },
    ]),
  },
  hill: { seed: 7, legs: [{ move: 3000, speed: 2.8 }], altitude: hill, altNoise: 1.0 },
  paused: {
    seed: 8,
    legs: [{ move: 1000, speed: 3.0 }, { pause: true, seconds: 180, jump: 500 }, { move: 1000, speed: 3.0 }],
  },
  'signal-jump': {
    seed: 9,
    legs: [{ move: 1500, speed: 3.0 }, { teleport: 2000, after: 30 }, { move: 1500, speed: 3.0 }],
  },
};

fs.mkdirSync(OUT, { recursive: true });
const truths = {};
for (const [name, spec] of Object.entries(SCENARIOS)) {
  const { fixes, truth } = simulate(spec);

  if (name === 'jittery-start') {
    // Before the phone settles: vague fixes scattered tens of metres around.
    const rand = rng(40);
    const vague = Array.from({ length: 8 }, (_, i) => {
      const p = offset(START, 20 + rand() * 40, rand() * 360);
      return { ...fixes[0], lat: p.lat, lon: p.lon, t: -16 + i * 2, hdop: (40 + rand() * 40) / 5 };
    });
    fixes.unshift(...vague);
    truth.elapsedSeconds += 16;
  }
  if (name === 'spike') {
    // One fix 300 m off the route, and later two in a row 250 m off.
    const one = Math.floor(fixes.length * 0.3);
    const two = Math.floor(fixes.length * 0.7);
    Object.assign(fixes[one], offset(fixes[one], 300, 0));
    for (const i of [two, two + 1]) Object.assign(fixes[i], offset(fixes[i], 250, 180));
  }

  fs.writeFileSync(path.join(OUT, `${name}.gpx`), toGpx(name, fixes));
  truths[name] = truth;
}
truths.hill.elevationGainM = 30;
truths.hill.elevationLossM = 30;
fs.writeFileSync(path.join(OUT, 'fixtures.json'), JSON.stringify(truths, null, 2) + '\n');
console.log(`Wrote ${Object.keys(SCENARIOS).length} GPX fixtures to ${path.relative(process.cwd(), OUT)}`);
