import * as fs from 'fs';
import * as path from 'path';

import { RUN_ACTIVITY_TIMING, runActivityState, shouldUpdate, type RunActivityState } from '../src/domain/running/liveActivity';
import { initialRecorder, reduceRecorder, type RecorderState } from '../src/domain/running/recorder';
import type { LiveStats } from '../src/domain/running/summarize';

const T0 = Date.parse('2026-10-09T13:00:00Z');

function recorder(status: 'countdown' | 'recording' | 'paused' | 'finished'): RecorderState {
  let r = reduceRecorder(initialRecorder, { type: 'start', now: T0 });
  if (status === 'countdown') return r;
  r = reduceRecorder(r, { type: 'tick', now: T0 + 10_000 });
  if (status === 'paused') r = reduceRecorder(r, { type: 'pause', now: T0 + 600_000 });
  if (status === 'finished') r = reduceRecorder(r, { type: 'finish', now: T0 + 600_000 });
  return r;
}

const live = (over: Partial<LiveStats> = {}): LiveStats => ({
  distanceM: 1609.344 * 1.5,
  movingSeconds: 735.6,
  elapsedSeconds: 760,
  currentPace: 470,
  averagePace: 490.4,
  autoPaused: false,
  holding: false,
  ...over,
});

describe('what the Lock Screen shows', () => {
  it('runs the clock from when it read 0:00 while recording', () => {
    const now = T0 + 800_000;
    const s = runActivityState(recorder('recording'), live(), 'mi', now)!;
    expect(s).toEqual({
      status: 'recording',
      clockStart: now - 735_000,
      time: '12:15',
      distance: '1.50',
      pace: '8:10',
      unit: 'mi',
    });
  });

  it('holds the clock still at a stop, and says auto-paused once sure', () => {
    const now = T0 + 800_000;
    const held = runActivityState(recorder('recording'), live({ holding: true }), 'mi', now)!;
    expect(held.clockStart).toBeNull();
    expect(held.status).toBe('recording');
    expect(held.time).toBe('12:15');

    const stopped = runActivityState(recorder('recording'), live({ holding: true, autoPaused: true }), 'mi', now)!;
    expect(stopped.status).toBe('auto-paused');
    expect(stopped.clockStart).toBeNull();
  });

  it('shows a paused run with the clock still', () => {
    const s = runActivityState(recorder('paused'), live(), 'km', T0 + 900_000)!;
    expect(s.status).toBe('paused');
    expect(s.clockStart).toBeNull();
    expect(s.distance).toBe('2.41');
  });

  it('says starting during the countdown, before there are any numbers', () => {
    const s = runActivityState(recorder('countdown'), null, 'mi', T0 + 1000)!;
    expect(s).toEqual({ status: 'starting', clockStart: null, time: '0:00', distance: '0.00', pace: '--:--', unit: 'mi' });
  });

  it('shows nothing for a finished run', () => {
    expect(runActivityState(recorder('finished'), live(), 'mi', T0 + 700_000)).toBeNull();
    expect(runActivityState(initialRecorder, null, 'mi', T0)).toBeNull();
  });
});

describe('when to send an update', () => {
  const base: RunActivityState = runActivityState(recorder('recording'), live(), 'mi', T0 + 800_000)!;

  it('always sends the first one', () => {
    expect(shouldUpdate(null, base, 0)).toBe(true);
  });

  it('sends straight away when the clock stops or starts', () => {
    expect(shouldUpdate(base, { ...base, clockStart: null }, 1000)).toBe(true);
    expect(shouldUpdate({ ...base, clockStart: null }, base, 1000)).toBe(true);
    expect(shouldUpdate(base, { ...base, status: 'auto-paused', clockStart: null }, 1000)).toBe(true);
  });

  it('sends when the distance moves on', () => {
    expect(shouldUpdate(base, { ...base, distance: '1.51' }, 5000)).toBe(true);
  });

  it('ignores the clock start wobbling by a second, but corrects a real drift', () => {
    expect(shouldUpdate(base, { ...base, clockStart: base.clockStart! + 1000 }, 5000)).toBe(false);
    expect(shouldUpdate(base, { ...base, clockStart: base.clockStart! + 5000 }, 5000)).toBe(true);
  });

  it('lets a pace change alone wait', () => {
    expect(shouldUpdate(base, { ...base, pace: '8:11' }, 5000)).toBe(false);
    expect(shouldUpdate(base, { ...base, pace: '8:11' }, RUN_ACTIVITY_TIMING.paceEveryMs)).toBe(true);
  });

  it('sends nothing while paused until the heartbeat, which keeps it fresh', () => {
    const paused = { ...base, status: 'paused' as const, clockStart: null };
    expect(shouldUpdate(paused, paused, 30_000)).toBe(false);
    expect(shouldUpdate(paused, paused, RUN_ACTIVITY_TIMING.heartbeatMs)).toBe(true);
    expect(RUN_ACTIVITY_TIMING.heartbeatMs).toBeLessThan(RUN_ACTIVITY_TIMING.staleAfterMs);
  });
});

/**
 * iOS matches a Live Activity to the widget that draws it by the attributes
 * type, so the app's native module and the widget extension each carry a
 * copy of the same Swift file. They must never differ.
 */
it('the app and the widget share one definition of the activity', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'modules', 'run-activity', 'ios', 'RunActivityAttributes.swift'), 'utf8');
  const widget = fs.readFileSync(path.join(root, 'targets', 'widget', 'RunActivityAttributes.swift'), 'utf8');
  expect(widget).toBe(app);
});
