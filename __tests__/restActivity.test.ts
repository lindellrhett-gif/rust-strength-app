import * as fs from 'fs';
import * as path from 'path';

import { loggedSetDetail, restActivityState, upcomingSetDetail, type UpcomingSet } from '../src/domain/restActivity';

const T = Date.parse('2026-10-10T18:00:00Z');

describe('the rest timer on the Lock Screen', () => {
  const running = { endsAt: T + 90_000, totalSeconds: 120, finished: false, signedIn: true };

  it('counts down from when the rest began to when it ends, with the next set', () => {
    expect(restActivityState(running, { exercise: 'Bench Press', kind: 'next', detail: '185 lb × 6–8' })).toEqual({
      status: 'resting',
      startedAt: T - 30_000,
      endsAt: T + 90_000,
      exercise: 'Bench Press',
      label: 'Next set',
      detail: '185 lb × 6–8',
    });
  });

  it('says it is the last set when that is all that is known', () => {
    const s = restActivityState(running, { exercise: 'Bench Press', kind: 'last', detail: '185 × 8' })!;
    expect(s.label).toBe('Last set');
  });

  it('shows just the countdown when nothing is known about the next set', () => {
    const s = restActivityState(running, null)!;
    expect([s.exercise, s.detail]).toEqual(['', '']);
  });

  it("says the rest is over once it is, and shows nothing with no rest or after sign-out", () => {
    expect(restActivityState({ ...running, finished: true }, null)!.status).toBe('ready');
    expect(restActivityState({ ...running, endsAt: null }, null)).toBeNull();
    expect(restActivityState({ ...running, signedIn: false }, null)).toBeNull();
  });

  it('never starts the countdown after it ends', () => {
    const s = restActivityState({ ...running, totalSeconds: 0 }, null)!;
    expect(s.startedAt).toBeLessThan(s.endsAt);
  });
});

describe('the next set as one line', () => {
  const base: UpcomingSet = {
    loadType: 'weighted',
    unit: 'lb',
    weight: 185,
    assist: 0,
    added: 0,
    reps: 10,
    holdSeconds: 60,
    repLow: 6,
    repHigh: 8,
  };

  it('gives the weight and the reps to aim for', () => {
    expect(upcomingSetDetail(base)).toBe('185 lb × 6–8');
    expect(upcomingSetDetail({ ...base, weight: 102.5, repLow: 8, repHigh: 8 })).toBe('102.5 lb × 8');
  });

  it('covers assisted, bodyweight and timed exercises', () => {
    expect(upcomingSetDetail({ ...base, loadType: 'assisted', assist: 40, unit: 'kg' })).toBe('40 kg assist × 6–8');
    expect(upcomingSetDetail({ ...base, loadType: 'assisted', assist: 0 })).toBe('No assist × 6–8');
    expect(upcomingSetDetail({ ...base, loadType: 'bodyweight' })).toBe('BW × 10');
    expect(upcomingSetDetail({ ...base, loadType: 'bodyweight', added: 25 })).toBe('BW + 25 lb × 10');
    expect(upcomingSetDetail({ ...base, loadType: 'timed', holdSeconds: 90 })).toBe('1:30 hold');
  });

  it('reads a logged set the same way the app lists it', () => {
    expect(loggedSetDetail({ weight: 185, reps: 8, isBodyweight: false }, 'lb')).toBe('185 lb × 8');
  });
});

/**
 * iOS matches a Live Activity to the widget that draws it by the attributes
 * type, so the app's native module and the widget extension each carry a
 * copy of the same Swift file. They must never differ.
 */
it('the app and the widget share one definition of the rest activity', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'modules', 'live-activities', 'ios', 'RestActivityAttributes.swift'), 'utf8');
  const widget = fs.readFileSync(path.join(root, 'targets', 'widget', 'RestActivityAttributes.swift'), 'utf8');
  expect(widget).toBe(app);
});
