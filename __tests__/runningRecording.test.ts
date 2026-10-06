import {
  CHUNK_SIZE,
  META_KEY,
  chunkKey,
  createRunStore,
  type KeyValueStorage,
  type NewRun,
} from '../src/domain/running/activeRunStore';
import { parseRunRow, type RunRow } from '../src/domain/running/detail';
import { gpsQuality, regionAround, regionForPoints, routeSegments } from '../src/domain/running/display';
import { filterFixes } from '../src/domain/running/filter';
import { offset } from '../src/domain/running/geo';
import { accessMessage, locationAccess } from '../src/domain/running/permission';
import { encodePolyline } from '../src/domain/running/polyline';
import { initialRecorder, reduceRecorder } from '../src/domain/running/recorder';
import { buildSaveRunInput, defaultRunName, MIN_SAVE_DISTANCE_M, unsavableReason } from '../src/domain/running/save';
import { cadence, plausibleSteps } from '../src/domain/running/steps';
import { summarizeRun } from '../src/domain/running/summarize';
import type { CleanFix, GpsFix } from '../src/domain/running/types';
import { hasFeature } from '../src/domain/entitlements';

const HOME = { lat: 47.9253, lon: -97.0329 };
const T0 = Date.UTC(2026, 8, 26, 13);

function memoryStorage(): KeyValueStorage & { data: Map<string, string>; failNextSet?: boolean } {
  const data = new Map<string, string>();
  const store: KeyValueStorage & { data: Map<string, string>; failNextSet?: boolean } = {
    data,
    async getItem(k) {
      return data.has(k) ? data.get(k)! : null;
    },
    async setItem(k, v) {
      if (store.failNextSet) {
        store.failNextSet = false;
        throw new Error('disk full');
      }
      data.set(k, v);
    },
    async removeItem(k) {
      data.delete(k);
    },
  };
  return store;
}

const recording = reduceRecorder(initialRecorder, { type: 'start', now: T0, countdownSeconds: 0 });
const newRun = (overrides: Partial<NewRun> = {}): NewRun => ({
  runId: 'run-1',
  recorder: recording,
  unit: 'mi',
  autoPause: true,
  bodyweightKg: 80,
  mapVisibility: 'private',
  ...overrides,
});

function fixesFrom(start: number, n: number, speed = 3) {
  return Array.from({ length: n }, (_, i) => {
    const p = offset(HOME, (start + i) * 2 * speed, 90);
    return { lat: p.lat, lon: p.lon, alt: 250, t: T0 + (start + i) * 2000, accuracy: 5 };
  });
}

describe('active run store', () => {
  it('starts empty and loads nothing from an empty disk', async () => {
    const store = createRunStore(memoryStorage());
    expect(await store.load()).toBeNull();
    expect(store.current()).toBeNull();
  });

  it('keeps fixes only while recording, stamped with the segment', async () => {
    const store = createRunStore(memoryStorage());
    await store.start(newRun({ recorder: reduceRecorder(initialRecorder, { type: 'start', now: T0 }) }));
    // During the countdown nothing counts.
    expect(await store.append(fixesFrom(0, 3))).toBe(0);
    await store.setRecorder(recording);
    expect(await store.append(fixesFrom(0, 3))).toBe(3);
    await store.setRecorder(reduceRecorder(recording, { type: 'pause', now: T0 + 10_000 }));
    expect(await store.append(fixesFrom(3, 2))).toBe(0);
    const paused = store.current()!.meta.recorder;
    await store.setRecorder(reduceRecorder(paused, { type: 'resume', now: T0 + 20_000 }));
    expect(await store.append(fixesFrom(10, 2))).toBe(2);
    expect(store.current()!.fixes.map((f) => f.seg)).toEqual([0, 0, 0, 1, 1]);
  });

  it('drops fixes older than the start of recording', async () => {
    const store = createRunStore(memoryStorage());
    await store.start(newRun({ recorder: reduceRecorder(initialRecorder, { type: 'start', now: T0 + 4000, countdownSeconds: 0 }) }));
    expect(await store.append(fixesFrom(0, 4))).toBe(2);
  });

  it('survives the app being killed: a fresh store reads the run back', async () => {
    const disk = memoryStorage();
    const first = createRunStore(disk);
    await first.start(newRun());
    await first.append(fixesFrom(0, CHUNK_SIZE + 37));
    await first.append(fixesFrom(CHUNK_SIZE + 37, 10));

    const second = createRunStore(disk);
    const restored = await second.load();
    expect(restored?.meta.runId).toBe('run-1');
    expect(restored?.fixes).toHaveLength(CHUNK_SIZE + 47);
    expect(restored?.meta.recorder).toEqual(recording);
    expect(disk.data.has(chunkKey(1))).toBe(true);
  });

  it('loses at most the newest batch when the app dies between writes', async () => {
    const disk = memoryStorage();
    const store = createRunStore(disk);
    await store.start(newRun());
    await store.append(fixesFrom(0, 5));
    // The chunk lands, then the meta write fails as if the app was killed.
    const realSet = disk.setItem.bind(disk);
    disk.setItem = async (k, v) => {
      if (k === META_KEY) throw new Error('killed');
      return realSet(k, v);
    };
    await expect(store.append(fixesFrom(5, 5))).rejects.toThrow('killed');

    const restored = await createRunStore({ ...disk, setItem: realSet }).load();
    expect(restored?.fixes).toHaveLength(5);
  });

  it('starts clean after a damaged record', async () => {
    const disk = memoryStorage();
    disk.data.set(META_KEY, '{not json');
    expect(await createRunStore(disk).load()).toBeNull();
  });

  it('clears only the run it was asked to', async () => {
    const disk = memoryStorage();
    const store = createRunStore(disk);
    await store.start(newRun());
    await store.append(fixesFrom(0, 3));
    await store.clear('some-other-run');
    expect(store.current()).not.toBeNull();
    await store.clear('run-1');
    expect(store.current()).toBeNull();
    expect(disk.data.size).toBe(0);
  });

  it('tells subscribers about changes', async () => {
    const store = createRunStore(memoryStorage());
    const seen: (string | null)[] = [];
    const off = store.subscribe((r) => seen.push(r?.meta.recorder.status ?? null));
    await store.load();
    await store.start(newRun());
    await store.setRecorder(reduceRecorder(recording, { type: 'pause', now: T0 + 1000 }));
    off();
    await store.clear();
    expect(seen).toEqual([null, 'recording', 'paused']);
  });

  it('never interleaves concurrent writes', async () => {
    const store = createRunStore(memoryStorage());
    await store.start(newRun());
    await Promise.all([store.append(fixesFrom(0, 3)), store.append(fixesFrom(3, 3)), store.append(fixesFrom(6, 3))]);
    const ts = store.current()!.fixes.map((f) => f.t);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
    expect(ts).toHaveLength(9);
  });
});

describe('saving a recording', () => {
  const finished = reduceRecorder(recording, { type: 'finish', now: T0 + 600_000 });
  const fixes: GpsFix[] = fixesFrom(0, 300).map((f) => ({ ...f, seg: 0 }));

  it('names runs by time of day', () => {
    expect(defaultRunName(new Date(2026, 8, 26, 6))).toBe('Morning run');
    expect(defaultRunName(new Date(2026, 8, 26, 12))).toBe('Lunch run');
    expect(defaultRunName(new Date(2026, 8, 26, 15))).toBe('Afternoon run');
    expect(defaultRunName(new Date(2026, 8, 26, 19))).toBe('Evening run');
    expect(defaultRunName(new Date(2026, 8, 26, 23))).toBe('Night run');
    expect(defaultRunName(new Date(2026, 8, 26, 2))).toBe('Night run');
  });

  it('builds exactly what rpc_save_run takes', () => {
    const summary = summarizeRun(fixes, finished, { autoPause: true, unit: 'mi', bodyweightKg: 80 });
    const input = buildSaveRunInput(summary, { runId: 'run-1', startedAt: T0, unit: 'mi', mapVisibility: 'private' });
    expect(input).toMatchObject({
      p_id: 'run-1',
      p_performed_at: new Date(T0).toISOString(),
      p_source: 'gps',
      p_distance_unit: 'mi',
      p_map_visibility: 'private',
      p_effort: null,
      p_note: null,
    });
    expect(input.p_distance_m).toBeGreaterThan(1700);
    expect(input.p_elapsed_seconds).toBeGreaterThanOrEqual(input.p_moving_seconds);
    expect(input.p_times![0]).toBe(0);
    expect(input.p_times).toHaveLength(input.p_alts!.length);
    expect(input.p_splits.length).toBeGreaterThanOrEqual(1);
    expect(input.p_splits[0]).toHaveLength(3);
    expect(input.p_best_efforts.mile).toBeGreaterThan(0);
    expect(input.p_calories).toBeGreaterThan(0);
    expect(input.p_steps).toBeNull();
  });

  it('saves the steps the phone counted, unless they are impossible', () => {
    const summary = summarizeRun(fixes, finished, { autoPause: true, unit: 'mi', bodyweightKg: 80 });
    const meta = { runId: 'run-1', startedAt: T0, unit: 'mi' as const, mapVisibility: 'private' as const };
    expect(buildSaveRunInput(summary, { ...meta, steps: 1712.4 }).p_steps).toBe(1712);
    expect(buildSaveRunInput(summary, { ...meta, steps: 10_000_000 }).p_steps).toBeNull();
  });

  it('refuses to save a run too short to be real', () => {
    const tiny = summarizeRun(fixes.slice(0, 3), finished, { autoPause: true, unit: 'mi', bodyweightKg: 80 });
    expect(tiny.distanceM).toBeLessThan(MIN_SAVE_DISTANCE_M);
    expect(unsavableReason(tiny)).toBe('too-short');
    expect(() => buildSaveRunInput(tiny, { runId: 'r', startedAt: T0, unit: 'mi', mapVisibility: 'private' })).toThrow();
  });
});

describe('steps and cadence', () => {
  it('works out cadence from moving time', () => {
    expect(cadence(3400, 20 * 60)).toBe(170);
    expect(cadence(null, 1200)).toBeNull();
    expect(cadence(0, 1200)).toBeNull();
    expect(cadence(50, 20)).toBeNull(); // too short to say
    expect(cadence(100_000, 60)).toBeNull(); // nobody takes 100,000 steps a minute
  });

  it('only saves step counts that are possible in the time', () => {
    expect(plausibleSteps(4200.6, 1500)).toBe(4201);
    expect(plausibleSteps(1500 * 5, 1500)).toBe(7500);
    expect(plausibleSteps(1500 * 5 + 1, 1500)).toBeNull();
    expect(plausibleSteps(-3, 1500)).toBeNull();
    expect(plausibleSteps(undefined, 1500)).toBeNull();
    expect(plausibleSteps(Number.NaN, 1500)).toBeNull();
  });
});

describe('location permission', () => {
  it('maps the phone’s answer to what the screen does', () => {
    expect(locationAccess({ status: 'granted', ios: { accuracy: 'full' } }, true)).toBe('granted');
    expect(locationAccess({ status: 'granted', ios: { accuracy: 'reduced' } }, true)).toBe('approximate');
    expect(locationAccess({ status: 'undetermined' }, true)).toBe('undetermined');
    expect(locationAccess({ status: 'denied', canAskAgain: false }, true)).toBe('denied');
    expect(locationAccess({ status: 'denied', canAskAgain: true }, true)).toBe('undetermined');
    expect(locationAccess({ status: 'granted' }, false)).toBe('services-off');
  });

  it('explains every blocked state, and stays quiet otherwise', () => {
    expect(accessMessage('granted')).toBeNull();
    expect(accessMessage('undetermined')).toBeNull();
    expect(accessMessage('approximate')?.title).toMatch(/Precise Location/);
    expect(accessMessage('denied')?.settings).toBe(true);
    expect(accessMessage('services-off')?.settings).toBe(false);
  });
});

describe('route display', () => {
  const clean = (n: number, breakAt?: number): CleanFix[] =>
    Array.from({ length: n }, (_, i) => {
      const p = offset(HOME, i * 6, 90);
      return { lat: p.lat, lon: p.lon, alt: null, t: T0 + i * 2000, accuracy: 5, seg: 0, joined: i > 0 && i !== breakAt };
    });

  it('splits the line at pauses and jumps', () => {
    const segs = routeSegments(clean(10, 5));
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveLength(5);
    expect(segs[1]).toHaveLength(5);
  });

  it('thins long routes but keeps both ends', () => {
    const fixes = clean(5000);
    const [seg] = routeSegments(fixes, 500);
    expect(seg.length).toBeLessThanOrEqual(520);
    expect(seg[0]).toEqual({ lat: fixes[0].lat, lon: fixes[0].lon });
    expect(seg[seg.length - 1]).toEqual({ lat: fixes[4999].lat, lon: fixes[4999].lon });
  });

  it('drops one-point stretches and handles the live pipeline output', () => {
    expect(routeSegments(clean(1))).toEqual([]);
    const live = filterFixes(fixesFrom(0, 50).map((f) => ({ ...f, seg: 0 }))).fixes;
    expect(routeSegments(live)).toHaveLength(1);
  });

  it('zooms the live map to a few blocks around the runner, not the whole world', () => {
    const r = regionAround(HOME);
    expect(r.latitude).toBe(HOME.lat);
    // About 600 m of map either way: a fraction of a hundredth of a degree.
    expect(r.latitudeDelta).toBeCloseTo(600 / 111_320, 6);
    expect(r.longitudeDelta).toBeGreaterThan(r.latitudeDelta); // degrees of longitude are shorter up north
    expect(r.longitudeDelta).toBeLessThan(0.01);
  });

  it('fits a route with a margin, but never zooms tighter than a few hundred metres', () => {
    const route = [HOME, offset(HOME, 3000, 90)];
    const r = regionForPoints(route)!;
    expect(r.longitude).toBeCloseTo((route[0].lon + route[1].lon) / 2, 6);
    expect(r.longitudeDelta).toBeCloseTo((route[1].lon - route[0].lon) * 1.3, 6);
    const tiny = regionForPoints([HOME, offset(HOME, 20, 0)])!;
    expect(tiny.latitudeDelta).toBeCloseTo(300 / 111_320, 6);
    expect(regionForPoints([])).toBeNull();
  });

  it('rates GPS by accuracy', () => {
    expect(gpsQuality(null)).toBe('searching');
    expect(gpsQuality(8)).toBe('good');
    expect(gpsQuality(40)).toBe('weak');
  });
});

describe('reading a saved run back', () => {
  const route = [HOME, offset(HOME, 100, 90), offset(HOME, 200, 90)];
  const row: RunRow = {
    id: 'run-1',
    name: '  ',
    note: null,
    performed_at: '2026-09-26T13:00:00Z',
    calories: 300,
    steps: 240,
    distance_unit: 'km',
    source: 'gps',
    distance_m: 200,
    moving_seconds: 70,
    elapsed_seconds: 80,
    elevation_gain_m: 2,
    elevation_loss_m: 1,
    effort: null,
    splits: [[70, 1.5, 200], 'junk', [null, null, 5]],
    has_elevation: true,
    map_visibility: 'private',
    route_id: null,
    polyline: encodePolyline(route),
    alts: [250, 251, 252],
    times: [0, 35, 70],
    best_efforts: { mile: 400, '3k': 9, '5k': 'x' },
  };

  it('unpacks the route, splits and best efforts, ignoring junk', () => {
    const run = parseRunRow(row);
    expect(run.name).toBe('Run');
    expect(run.unit).toBe('km');
    expect(run.route).toHaveLength(3);
    expect(run.route[2]).toMatchObject({ alt: 252, t: 70 });
    expect(run.splits).toEqual([{ seconds: 70, elevationChangeM: 1.5, distanceM: 200 }]);
    expect(run.bestEfforts).toEqual({ mile: 400 });
    expect(run.steps).toBe(240);
  });

  it('copes with a typed-in run and a broken polyline', () => {
    expect(parseRunRow({ ...row, polyline: null }).route).toEqual([]);
    expect(parseRunRow({ ...row, polyline: '_p~iF~ps|U_' }).route).toEqual([]);
    expect(parseRunRow({ ...row, has_elevation: false }).route[0].alt).toBeNull();
  });
});

describe('entitlements', () => {
  it('lets everyone run until there is a subscription', () => {
    expect(hasFeature('running')).toBe(true);
  });
});
