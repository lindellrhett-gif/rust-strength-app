/**
 * The whole GPS pipeline against simulated runs with known truth: tunnels,
 * stops at a light, a jittery start, spikes, walk breaks, a hill, a manual
 * pause, and GPS reappearing somewhere impossible. The GPX files and their
 * truth come from scripts/make-gpx-fixtures.js.
 */
import * as fs from 'fs';
import * as path from 'path';

import { parseGpx } from '../src/domain/running/gpx';
import { initialRecorder, type RecorderState } from '../src/domain/running/recorder';
import { summarizeRun } from '../src/domain/running/summarize';
import type { GpsFix } from '../src/domain/running/types';

const DIR = path.join(__dirname, 'fixtures', 'gpx');
const truth: Record<
  string,
  { distanceM: number; movingSeconds: number; elapsedSeconds: number; elevationGainM?: number; elevationLossM?: number }
> = JSON.parse(fs.readFileSync(path.join(DIR, 'fixtures.json'), 'utf8'));

function load(name: string): GpsFix[] {
  return parseGpx(fs.readFileSync(path.join(DIR, `${name}.gpx`), 'utf8'));
}

/** A recorder that ran from the first fix to the last, like a real session. */
function recorderFor(fixes: GpsFix[]): RecorderState {
  const ts = fixes.map((f) => f.t);
  return {
    ...initialRecorder,
    status: 'finished',
    startedAt: Math.min(...ts),
    finishedAt: Math.max(...ts),
  };
}

function run(name: string, autoPause = true) {
  const fixes = load(name);
  return summarizeRun(fixes, recorderFor(fixes), { autoPause, unit: 'km', bodyweightKg: 70 });
}

const within = (actual: number, expected: number, fraction: number) =>
  Math.abs(actual - expected) <= expected * fraction;

describe('GPS pipeline on simulated runs', () => {
  it('parses every fixture', () => {
    for (const name of Object.keys(truth)) {
      const fixes = load(name);
      expect(fixes.length).toBeGreaterThan(100);
      expect(fixes.every((f) => Number.isFinite(f.lat) && Number.isFinite(f.t))).toBe(true);
    }
  });

  it('measures a steady 5K within 1.5%, with no invented climb', () => {
    const s = run('steady-5k');
    expect(within(s.distanceM, 5000, 0.015)).toBe(true);
    expect(within(s.movingSeconds, truth['steady-5k'].movingSeconds, 0.02)).toBe(true);
    expect(s.elevationGainM).toBeLessThan(6);
    expect(s.bestEfforts['5k']).toBeDefined();
    expect(within(s.bestEfforts['5k']!, 1667, 0.03)).toBe(true);
    // Splits: five full kilometres, each about 5:33.
    const full = s.splits.filter((x) => !x.partial);
    expect(full.length).toBeGreaterThanOrEqual(4);
    for (const split of full) expect(within(split.seconds, 1000 / 3, 0.05)).toBe(true);
  });

  it('bridges a tunnel with a straight line and keeps the time as moving', () => {
    const s = run('tunnel');
    expect(within(s.distanceM, truth.tunnel.distanceM, 0.015)).toBe(true);
    expect(within(s.movingSeconds, truth.tunnel.movingSeconds, 0.02)).toBe(true);
  });

  it('takes a stop at a light out of moving time without adding jitter distance', () => {
    const s = run('stoplight');
    expect(within(s.distanceM, truth.stoplight.distanceM, 0.015)).toBe(true);
    expect(Math.abs(s.movingSeconds - truth.stoplight.movingSeconds)).toBeLessThanOrEqual(8);
    expect(s.elapsedSeconds).toBe(truth.stoplight.elapsedSeconds);
  });

  it('keeps the stop in moving time when auto-pause is off', () => {
    const s = run('stoplight', false);
    expect(Math.abs(s.movingSeconds - truth.stoplight.elapsedSeconds)).toBeLessThanOrEqual(2);
  });

  it('ignores vague fixes while the phone settles', () => {
    const s = run('jittery-start');
    expect(within(s.distanceM, truth['jittery-start'].distanceM, 0.015)).toBe(true);
    expect(s.rejected.inaccurate).toBeGreaterThanOrEqual(8);
  });

  it('rejects spikes, single and double', () => {
    const s = run('spike');
    expect(within(s.distanceM, truth.spike.distanceM, 0.015)).toBe(true);
    expect(s.rejected.spike).toBeGreaterThanOrEqual(3);
  });

  it('counts walk breaks as moving', () => {
    const s = run('walk-breaks');
    expect(within(s.distanceM, truth['walk-breaks'].distanceM, 0.015)).toBe(true);
    expect(within(s.movingSeconds, truth['walk-breaks'].movingSeconds, 0.02)).toBe(true);
  });

  it('finds the climb on a hill through altitude noise', () => {
    const s = run('hill');
    expect(s.hasElevation).toBe(true);
    expect(Math.abs(s.elevationGainM - 30)).toBeLessThanOrEqual(6);
    expect(Math.abs(s.elevationLossM - 30)).toBeLessThanOrEqual(6);
  });

  it('counts no distance for where you went while paused', () => {
    const s = run('paused');
    expect(within(s.distanceM, truth.paused.distanceM, 0.015)).toBe(true);
    expect(within(s.movingSeconds, truth.paused.movingSeconds, 0.02)).toBe(true);
    expect(s.elapsedSeconds).toBe(truth.paused.elapsedSeconds);
  });

  it('re-anchors when GPS reappears somewhere it could not have run to', () => {
    const s = run('signal-jump');
    expect(within(s.distanceM, truth['signal-jump'].distanceM, 0.015)).toBe(true);
  });

  it('estimates calories from bodyweight, and none without it', () => {
    const fixes = load('steady-5k');
    const withWeight = summarizeRun(fixes, recorderFor(fixes), { autoPause: true, unit: 'km', bodyweightKg: 70 });
    const without = summarizeRun(fixes, recorderFor(fixes), { autoPause: true, unit: 'km', bodyweightKg: null });
    // About 1 kcal per kg per km for running.
    expect(withWeight.calories).toBeGreaterThan(300);
    expect(withWeight.calories).toBeLessThan(450);
    expect(without.calories).toBeNull();
  });
});
