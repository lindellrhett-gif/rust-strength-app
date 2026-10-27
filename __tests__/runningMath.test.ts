import { bestEffort, bestEfforts, personalRecords } from '../src/domain/running/bestEfforts';
import { estimateCalories, RUN_SPEED_MPS } from '../src/domain/running/calories';
import {
  elevationTotals,
  fillAltitudes,
  smoothAltitudes,
} from '../src/domain/running/elevation';
import { filterFixes, MAX_ACCURACY_M, stillRadius } from '../src/domain/running/filter';
import { haversine, isValidCoord, offset } from '../src/domain/running/geo';
import { parseGpx } from '../src/domain/running/gpx';
import { runningLoad } from '../src/domain/running/load';
import { decodePolyline, encodePolyline } from '../src/domain/running/polyline';
import { computeSplits } from '../src/domain/running/splits';
import { routePayload } from '../src/domain/running/summarize';
import { atDistance, buildTrack } from '../src/domain/running/track';
import type { GpsFix, TrackPoint } from '../src/domain/running/types';
import {
  formatDistance,
  formatElevation,
  formatPace,
  paceSeconds,
  runUnitFor,
  toKilograms,
} from '../src/domain/running/units';
import { validateRun } from '../src/domain/running/validate';

const HOME = { lat: 47.9253, lon: -97.0329 };
const T0 = Date.UTC(2026, 8, 26, 13);

/** A straight run east: one fix every `every` seconds at `speed` m/s. */
function straight(metres: number, speed: number, every = 2, extra: Partial<GpsFix> = {}): GpsFix[] {
  const n = Math.round(metres / (speed * every));
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = offset(HOME, i * speed * every, 90);
    return { lat: p.lat, lon: p.lon, alt: null, t: T0 + i * every * 1000, accuracy: 5, seg: 0, ...extra };
  });
}

/** An evenly paced track: `metres` long, `secondsPerKm` pace, a point every 10 m. */
function evenTrack(metres: number, secondsPerKm: number): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let d = 0; d <= metres + 1e-9; d += 10) {
    const mt = (d / 1000) * secondsPerKm;
    out.push({ lat: 0, lon: 0, alt: null, t: T0 + mt * 1000, d, mt });
  }
  return out;
}

describe('geo', () => {
  it('measures a known distance', () => {
    // One degree of latitude is about 111.2 km.
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -1);
  });

  it('round-trips an offset', () => {
    const p = offset(HOME, 1234, 37);
    expect(haversine(HOME, p)).toBeCloseTo(1234, 3);
  });

  it('rejects impossible and null-island coordinates', () => {
    expect(isValidCoord({ lat: 91, lon: 0 })).toBe(false);
    expect(isValidCoord({ lat: 0, lon: 181 })).toBe(false);
    expect(isValidCoord({ lat: 0, lon: 0 })).toBe(false);
    expect(isValidCoord({ lat: NaN, lon: 1 })).toBe(false);
    expect(isValidCoord(HOME)).toBe(true);
  });
});

describe('polyline', () => {
  it('matches the reference encoding', () => {
    // The worked example from the format's documentation.
    const points = [
      { lat: 38.5, lon: -120.2 },
      { lat: 40.7, lon: -120.95 },
      { lat: 43.252, lon: -126.453 },
    ];
    expect(encodePolyline(points)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(points);
  });

  it('round-trips a run to about a metre', () => {
    const fixes = straight(3000, 3);
    const back = decodePolyline(encodePolyline(fixes));
    expect(back).toHaveLength(fixes.length);
    back.forEach((p, i) => expect(haversine(p, fixes[i])).toBeLessThan(1.2));
  });

  it('refuses malformed text', () => {
    expect(() => decodePolyline('_p~iF~ps|U_')).toThrow();
    expect(() => decodePolyline(' ')).toThrow();
  });
});

describe('units', () => {
  it('follows the weight setting', () => {
    expect(runUnitFor('lb')).toBe('mi');
    expect(runUnitFor('kg')).toBe('km');
  });

  it('formats distance, pace and elevation', () => {
    expect(formatDistance(5000, 'km')).toBe('5.00 km');
    expect(formatDistance(1609.344 * 3.1, 'mi')).toBe('3.10 mi');
    expect(formatDistance(NaN, 'mi')).toBe('0.00 mi');
    expect(formatPace(485, 'mi')).toBe('8:05 /mi');
    expect(formatPace(null, 'km')).toBe('--:-- /km');
    expect(formatPace(3 * 3600, 'km')).toBe('--:-- /km');
    expect(formatElevation(100, 'mi')).toBe('328 ft');
    expect(formatElevation(100, 'km')).toBe('100 m');
  });

  it('only gives a pace once there is distance to measure', () => {
    expect(paceSeconds(5, 10, 'km')).toBeNull();
    expect(paceSeconds(1000, 300, 'km')).toBe(300);
    expect(paceSeconds(1609.344, 480, 'mi')).toBeCloseTo(480);
  });

  it('converts bodyweight to kilograms', () => {
    expect(toKilograms(180, 'lb')).toBeCloseTo(81.65, 2);
    expect(toKilograms(80, 'kg')).toBe(80);
  });
});

describe('filter', () => {
  it('drops vague fixes', () => {
    const fixes = straight(500, 3).map((f, i) => (i % 5 === 0 && i > 0 ? { ...f, accuracy: MAX_ACCURACY_M + 1 } : f));
    const r = filterFixes(fixes);
    expect(r.rejected.inaccurate).toBeGreaterThan(0);
    expect(r.fixes.every((f) => (f.accuracy ?? 0) <= MAX_ACCURACY_M)).toBe(true);
  });

  it('re-anchors when the very first fix was the outlier', () => {
    const fixes = straight(600, 3);
    const bad = offset(fixes[0], 400, 0);
    fixes[0] = { ...fixes[0], ...bad };
    const r = filterFixes(fixes);
    const track = buildTrack(r.fixes, { autoPause: true });
    expect(track[track.length - 1].d).toBeGreaterThan(560);
    expect(track[track.length - 1].d).toBeLessThan(620);
    expect(haversine(r.fixes[0], bad)).toBeGreaterThan(300);
  });

  it('puts out-of-order fixes back in order and drops duplicates', () => {
    const fixes = straight(300, 3);
    const shuffled = [fixes[3], fixes[0], fixes[2], fixes[1], ...fixes.slice(4), fixes[5]];
    const r = filterFixes(shuffled);
    expect(r.rejected.duplicate).toBe(1);
    for (let i = 1; i < r.fixes.length; i += 1) expect(r.fixes[i].t).toBeGreaterThan(r.fixes[i - 1].t);
  });

  it('drops invalid fixes and vague altitudes', () => {
    const fixes = straight(100, 3).map((f) => ({ ...f, alt: 250, altAccuracy: 30 }));
    fixes.push({ ...fixes[0], lat: NaN, t: fixes[0].t + 999_000 });
    const r = filterFixes(fixes);
    expect(r.rejected.invalid).toBe(1);
    expect(r.fixes.every((f) => f.alt == null)).toBe(true);
  });

  it('scales the jitter radius with accuracy, within limits', () => {
    const f = straight(10, 3)[0];
    expect(stillRadius({ ...f, accuracy: 2 }, { ...f, accuracy: 2 })).toBe(3);
    expect(stillRadius({ ...f, accuracy: 8 }, { ...f, accuracy: 4 })).toBe(6);
    expect(stillRadius({ ...f, accuracy: 25 }, f)).toBe(10);
  });

  it('never joins across a manual pause', () => {
    const a = straight(300, 3);
    const b = straight(300, 3).map((f) => ({ ...f, seg: 1, t: f.t + 3_600_000 }));
    const r = filterFixes([...a, ...b]);
    const firstOfB = r.fixes.findIndex((f) => f.seg === 1);
    expect(r.fixes[firstOfB].joined).toBe(false);
  });
});

describe('track', () => {
  it('keeps short slow moments in moving time', () => {
    const fixes = filterFixes(straight(200, 3)).fixes;
    // A 3-second hesitation mid-run: slow, but not a stop.
    const k = 20;
    const slowed = fixes.map((f, i) => (i >= k ? { ...f, t: f.t + 3000 } : f));
    const track = buildTrack(slowed, { autoPause: true });
    expect(track[track.length - 1].mt).toBeCloseTo((slowed[slowed.length - 1].t - slowed[0].t) / 1000, 0);
  });

  it('interpolates position along the track', () => {
    const track = evenTrack(1000, 300);
    expect(atDistance(track, 505)?.mt).toBeCloseTo(151.5, 5);
    expect(atDistance(track, 1001)).toBeNull();
    expect(atDistance([], 0)).toBeNull();
  });
});

describe('splits', () => {
  it('cuts even kilometres and a partial last split', () => {
    const splits = computeSplits(evenTrack(2500, 300), 1000);
    expect(splits.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(splits[0].seconds).toBeCloseTo(300, 5);
    expect(splits[1].seconds).toBeCloseTo(300, 5);
    expect(splits[2]).toMatchObject({ partial: true });
    expect(splits[2].distanceM).toBeCloseTo(500, 5);
    expect(splits[2].seconds).toBeCloseTo(150, 5);
  });

  it('places a boundary between fixes where it was crossed', () => {
    // Points every 10 m, but a mile boundary falls at 1609.344 m.
    const splits = computeSplits(evenTrack(3300, 300), 1609.344);
    expect(splits[0].seconds).toBeCloseTo(1.609344 * 300, 5);
  });

  it('skips a leftover too short to matter, and handles nothing', () => {
    expect(computeSplits(evenTrack(1005, 300), 1000)).toHaveLength(1);
    expect(computeSplits([], 1000)).toEqual([]);
  });

  it('reports elevation change per split', () => {
    const track = evenTrack(2000, 300).map((p) => ({ ...p, alt: 100 + p.d / 100 }));
    const splits = computeSplits(track, 1000);
    expect(splits[0].elevationChangeM).toBeCloseTo(10, 5);
  });
});

describe('elevation', () => {
  it('ignores wobble smaller than the threshold', () => {
    const alts = Array.from({ length: 200 }, (_, i) => ({ alt: 250 + (i % 2 === 0 ? 1.5 : -1.5) }));
    expect(elevationTotals(alts).gainM).toBe(0);
  });

  it('counts a real climb and descent', () => {
    const up = Array.from({ length: 50 }, (_, i) => ({ alt: 200 + i }));
    const down = Array.from({ length: 50 }, (_, i) => ({ alt: 249 - i }));
    const t = elevationTotals([...up, ...down]);
    expect(t.gainM).toBeGreaterThan(44);
    expect(t.lossM).toBeGreaterThan(44);
    expect(t.known).toBe(true);
  });

  it('says so when altitude is unknown', () => {
    expect(elevationTotals([{ alt: null }, { alt: null }])).toEqual({ gainM: 0, lossM: 0, known: false });
  });

  it('smooths without inventing altitudes', () => {
    expect(smoothAltitudes([null, 10, 20, null])).toEqual([null, 15, 15, null]);
  });

  it('fills gaps for storage', () => {
    expect(fillAltitudes([null, 10, null, 30, null])).toEqual([10, 10, 20, 30, 30]);
    expect(fillAltitudes([null, null])).toBeNull();
  });
});

describe('best efforts', () => {
  it('finds a fastest mile inside a longer run', () => {
    // 3 km at 6:00/km, then 2 km at 4:00/km, then 1 km at 6:00/km.
    const pts: TrackPoint[] = [];
    let mt = 0;
    for (let d = 0; d <= 6000; d += 10) {
      pts.push({ lat: 0, lon: 0, alt: null, t: T0, d, mt });
      mt += d < 3000 || d >= 5000 ? 3.6 : 2.4;
    }
    const mile = bestEffort(pts, 1609.344)!;
    expect(mile).toBeGreaterThanOrEqual(Math.round(1.609344 * 240) - 1);
    expect(mile).toBeLessThanOrEqual(Math.round(1.609344 * 240) + 1);
    const five = bestEffort(pts, 5000)!;
    // Best 5K: 1 km at 6:00 then the fast 2 km then the last km, or similar: well under 30:00.
    expect(five).toBeLessThan(1600);
    expect(bestEffort(pts, 10000)).toBeNull();
  });

  it('reports every distance the run covers', () => {
    const e = bestEfforts(evenTrack(11000, 300));
    expect(Object.keys(e).sort()).toEqual(['10k', '5k', 'mile'].sort());
    expect(e['5k']).toBe(1500);
    expect(e['10k']).toBe(3000);
  });

  it('picks personal records across runs', () => {
    const prs = personalRecords([
      { id: 'a', efforts: { mile: 420, '5k': 1500 } },
      { id: 'b', efforts: { mile: 400 } },
    ]);
    expect(prs.mile).toMatchObject({ seconds: 400, run: { id: 'b' } });
    expect(prs['5k']).toMatchObject({ seconds: 1500, run: { id: 'a' } });
    expect(prs.marathon).toBeUndefined();
  });
});

describe('calories', () => {
  it('is about 1 kcal per kg per km when running on the flat', () => {
    const kcal = estimateCalories({ distanceM: 10_000, movingSeconds: 3000, elevationGainM: 0, bodyweightKg: 70 })!;
    expect(kcal).toBeGreaterThan(650);
    expect(kcal).toBeLessThan(800);
  });

  it('uses the walking equation below running speed, and costs more uphill', () => {
    const walk = estimateCalories({ distanceM: 3000, movingSeconds: 3000 / 1.4, elevationGainM: 0, bodyweightKg: 70 })!;
    const run = estimateCalories({
      distanceM: 3000,
      movingSeconds: 3000 / RUN_SPEED_MPS,
      elevationGainM: 0,
      bodyweightKg: 70,
    })!;
    expect(walk).toBeLessThan(run);
    const hilly = estimateCalories({ distanceM: 3000, movingSeconds: 1000, elevationGainM: 100, bodyweightKg: 70 })!;
    const flat = estimateCalories({ distanceM: 3000, movingSeconds: 1000, elevationGainM: 0, bodyweightKg: 70 })!;
    expect(hilly).toBeGreaterThan(flat);
  });

  it('gives no number without a believable bodyweight or any running', () => {
    const base = { distanceM: 5000, movingSeconds: 1500, elevationGainM: 0 };
    expect(estimateCalories({ ...base, bodyweightKg: null })).toBeNull();
    expect(estimateCalories({ ...base, bodyweightKg: 5 })).toBeNull();
    expect(estimateCalories({ ...base, movingSeconds: 0, bodyweightKg: 70 })).toBeNull();
  });
});

describe('validateRun', () => {
  const ok = { distanceM: 5000, movingSeconds: 1500 };

  it('accepts a normal run', () => {
    expect(validateRun({ ...ok, effort: 7, title: 'Morning run', note: '' })).toEqual({ ok: true, error: null });
  });

  it('refuses missing or impossible numbers', () => {
    expect(validateRun({ ...ok, distanceM: 0 }).ok).toBe(false);
    expect(validateRun({ ...ok, distanceM: 500_000 }).ok).toBe(false);
    expect(validateRun({ ...ok, movingSeconds: 0 }).ok).toBe(false);
    expect(validateRun({ ...ok, movingSeconds: 200_000 }).ok).toBe(false);
    expect(validateRun({ ...ok, elapsedSeconds: 1000 }).ok).toBe(false);
    // 5 km in 10 minutes.
    expect(validateRun({ distanceM: 5000, movingSeconds: 600 }).error).toMatch(/world record/);
  });

  it('checks effort and text lengths', () => {
    expect(validateRun({ ...ok, effort: 11 }).ok).toBe(false);
    expect(validateRun({ ...ok, effort: 6.5 }).ok).toBe(false);
    expect(validateRun({ ...ok, title: 'x'.repeat(81) }).ok).toBe(false);
    expect(validateRun({ ...ok, note: 'x'.repeat(2001) }).ok).toBe(false);
  });
});

describe('runningLoad', () => {
  const today = '2026-09-30'; // a Wednesday; the week began Sunday the 27th

  it('summarizes this week, the last seven days and the prior four weeks', () => {
    const load = runningLoad(
      [
        { date: '2026-09-30', distanceM: 5000, movingSeconds: 1500, effort: 8 },
        { date: '2026-09-27', distanceM: 10000, movingSeconds: 3300, effort: 5 },
        { date: '2026-09-25', distanceM: 8000, movingSeconds: 2600, effort: null },
        { date: '2026-09-10', distanceM: 16000, movingSeconds: 5400, effort: 7 },
        { date: '2026-08-01', distanceM: 30000, movingSeconds: 11000, effort: 9 },
      ],
      today,
    );
    expect(load.weekDistanceM).toBe(15000);
    expect(load.last7DaysDistanceM).toBe(23000);
    expect(load.runsLast7Days).toBe(3);
    expect(load.hardRunsLast7Days).toBe(1);
    // Prior four weeks: Aug 30 to Sep 26 held 8 km + 16 km.
    expect(load.fourWeekAverageM).toBe(6000);
    expect(load.longRunsLast28Days.map((r) => r.distanceM)).toEqual([16000, 10000, 8000]);
  });

  it('is all zeros with no runs', () => {
    const load = runningLoad([], today);
    expect(load.weekDistanceM).toBe(0);
    expect(load.longRunsLast28Days).toEqual([]);
  });
});

describe('routePayload', () => {
  it('packs a track into a polyline and parallel arrays', () => {
    const track = buildTrack(filterFixes(straight(300, 3).map((f, i) => ({ ...f, alt: i % 3 ? 250 : null }))).fixes, {
      autoPause: true,
    });
    const payload = routePayload(track)!;
    expect(decodePolyline(payload.polyline)).toHaveLength(track.length);
    expect(payload.times[0]).toBe(0);
    expect(payload.times).toHaveLength(track.length);
    expect(payload.alts).toHaveLength(track.length);
    expect(payload.alts!.every((a) => a === 250)).toBe(true);
    expect(routePayload(track.slice(0, 1))).toBeNull();
  });
});

describe('gpx', () => {
  it('reads segments, elevation, time and hdop', () => {
    const fixes = parseGpx(`<gpx><trk>
      <trkseg><trkpt lat="47.1" lon="-97.1"><ele>250.5</ele><time>2026-09-26T13:00:00Z</time><hdop>1.2</hdop></trkpt>
      <trkpt lat="47.2" lon="-97.2"/></trkseg>
      <trkseg><trkpt lon="-97.3" lat="47.3"><time>2026-09-26T13:05:00Z</time></trkpt></trkseg>
    </trk></gpx>`);
    expect(fixes).toHaveLength(3);
    expect(fixes[0]).toMatchObject({ lat: 47.1, lon: -97.1, alt: 250.5, seg: 0, t: Date.parse('2026-09-26T13:00:00Z') });
    expect(fixes[0].accuracy).toBeCloseTo(6);
    expect(fixes[1]).toMatchObject({ alt: null, accuracy: null, seg: 0 });
    expect(Number.isNaN(fixes[1].t)).toBe(true);
    expect(fixes[2]).toMatchObject({ lat: 47.3, lon: -97.3, seg: 1 });
  });
});
