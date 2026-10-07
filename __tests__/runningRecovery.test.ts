/**
 * What happens to a run when the app closes in the middle of it: what the
 * app offers when it reopens, where a recovered run is cut off, and the
 * countdown finishing on time with the phone locked.
 */
import {
  createRunStore,
  META_KEY,
  type ActiveRun,
  type KeyValueStorage,
  type NewRun,
} from '../src/domain/running/activeRunStore';
import { lastRecordedBefore, prepareFinish, recoveryFor } from '../src/domain/running/finish';
import { offset } from '../src/domain/running/geo';
import { initialRecorder, reduceRecorder, type RecorderState } from '../src/domain/running/recorder';
import type { GpsFix } from '../src/domain/running/types';

const HOME = { lat: 47.9253, lon: -97.0329 };
const T0 = Date.UTC(2026, 9, 7, 13);

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(k) {
      return data.has(k) ? data.get(k)! : null;
    },
    async setItem(k, v) {
      data.set(k, v);
    },
    async removeItem(k) {
      data.delete(k);
    },
  };
}

const recording = reduceRecorder(initialRecorder, { type: 'start', now: T0, countdownSeconds: 0 });

/** A run at 3 m/s, one fix a second, from `fromS` for `n` seconds. */
const fixesAt = (fromS: number, n: number, seg = 0): GpsFix[] =>
  Array.from({ length: n }, (_, i) => {
    const s = fromS + i;
    const p = offset(HOME, s * 3, 90);
    return { lat: p.lat, lon: p.lon, alt: null, t: T0 + s * 1000, accuracy: 5, seg, speed: 3 };
  });

const runWith = (recorder: RecorderState, fixes: GpsFix[], userId: string | null = 'alice'): ActiveRun => ({
  meta: {
    version: 1,
    runId: 'run-1',
    userId,
    recorder,
    unit: 'km',
    autoPause: true,
    bodyweightKg: 75,
    mapVisibility: 'private',
    fixCount: fixes.length,
  },
  fixes,
});

describe('what the app offers when it reopens with a run on the phone', () => {
  it('offers to resume a run that was recording or paused', () => {
    expect(recoveryFor(runWith(recording, []), 'alice')).toBe('resume');
    const paused = reduceRecorder(recording, { type: 'pause', now: T0 + 60_000 });
    expect(recoveryFor(runWith(paused, []), 'alice')).toBe('resume');
  });

  it('offers to save a run that finished but never saved', () => {
    const finished = reduceRecorder(recording, { type: 'finish', now: T0 + 60_000 });
    expect(recoveryFor(runWith(finished, []), 'alice')).toBe('save');
  });

  it('quietly drops a run that never got past the countdown', () => {
    const countdown = reduceRecorder(initialRecorder, { type: 'start', now: T0 });
    expect(recoveryFor(runWith(countdown, []), 'alice')).toBe('discard');
  });

  it('never offers one person’s run to someone else', () => {
    expect(recoveryFor(runWith(recording, [], 'alice'), 'bob')).toBe('discard');
  });

  it('treats a run from before owners were recorded as the signed-in person’s', () => {
    expect(recoveryFor(runWith(recording, [], null), 'bob')).toBe('resume');
  });

  it('has nothing to offer without a run', () => {
    expect(recoveryFor(null, 'alice')).toBe('none');
  });
});

describe('finishing a run the app lost track of', () => {
  it('ends it at the last fix before the app reopened, not at whatever came after', () => {
    // Ran for 10 minutes, the app died, and it reopened an hour later at home.
    const launchedAt = T0 + 70 * 60_000;
    const before = fixesAt(0, 600);
    const after = fixesAt(4200, 30).map((f) => ({ ...f, lat: HOME.lat, lon: HOME.lon, speed: 0 }));
    const run = runWith(recording, [...before, ...after]);

    const end = lastRecordedBefore(run, launchedAt);
    expect(end).toBe(before[before.length - 1].t);

    const prepared = prepareFinish(run, end);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.recorder.finishedAt).toBe(end);
    expect(prepared.summary.elapsedSeconds).toBe(599);
    expect(prepared.summary.distanceM).toBeGreaterThan(1700);
    expect(prepared.summary.distanceM).toBeLessThan(1850);
  });

  it('ends a paused run where it was paused', () => {
    const paused = reduceRecorder(recording, { type: 'pause', now: T0 + 300_000 });
    const run = runWith(paused, fixesAt(0, 290));
    expect(lastRecordedBefore(run, T0 + 999_999)).toBe(T0 + 300_000);
  });

  it('falls back to the start when nothing was recorded', () => {
    expect(lastRecordedBefore(runWith(recording, []), T0 + 999_999)).toBe(T0);
  });

  it('keeps the finish time of a run that already finished', () => {
    const finished = reduceRecorder(recording, { type: 'finish', now: T0 + 600_000 });
    const prepared = prepareFinish(runWith(finished, fixesAt(0, 600)), T0 + 9_999_999);
    expect(prepared.ok && prepared.recorder.finishedAt).toBe(T0 + 600_000);
  });

  it('refuses a run too short to keep, and changes nothing', () => {
    const run = runWith(recording, fixesAt(0, 5));
    expect(prepareFinish(run, T0 + 5000)).toEqual({ ok: false, reason: 'too-short' });
    expect(run.meta.recorder).toBe(recording);
  });
});

describe('the run store across a locked phone and a relaunch', () => {
  const start = (overrides: Partial<NewRun> = {}): NewRun => ({
    runId: 'run-1',
    userId: 'alice',
    recorder: reduceRecorder(initialRecorder, { type: 'start', now: T0 }), // 3-second countdown
    unit: 'km',
    autoPause: true,
    bodyweightKg: 75,
    mapVisibility: 'private',
    ...overrides,
  });

  it('starts recording when the countdown ends, even with no screen ticking', async () => {
    const store = createRunStore(memoryStorage());
    await store.start(start());
    // Fixes during the countdown are dropped; the first one after it starts the run.
    expect(await store.append(fixesAt(1, 1).map(({ seg, ...f }) => f))).toBe(0);
    expect(store.current()!.meta.recorder.status).toBe('countdown');
    const kept = await store.append(fixesAt(2, 4).map(({ seg, ...f }) => f));
    const rec = store.current()!.meta.recorder;
    expect(rec.status).toBe('recording');
    expect(rec.startedAt).toBe(T0 + 3000);
    expect(kept).toBe(3);
  });

  it('remembers who recorded the run across a relaunch', async () => {
    const disk = memoryStorage();
    await createRunStore(disk).start(start());
    const reopened = await createRunStore(disk).load();
    expect(reopened?.meta.userId).toBe('alice');
  });

  it('reads a run saved before owners were recorded', async () => {
    const disk = memoryStorage();
    await createRunStore(disk).start(start());
    const meta = JSON.parse(disk.data.get(META_KEY)!);
    delete meta.userId;
    delete meta.recorder.pauses;
    disk.data.set(META_KEY, JSON.stringify(meta));

    const reopened = await createRunStore(disk).load();
    expect(reopened?.meta.userId).toBeNull();
    expect(reopened?.meta.recorder.pauses).toEqual([]);
  });
});
