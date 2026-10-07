/**
 * Editing a saved run: trimming its start or end, and the charts on its
 * summary. Each run here is a simulated GPX run, saved and read back exactly
 * as the app does it, so the trimming works from the same numbers the
 * database holds.
 */
import * as fs from 'fs';
import * as path from 'path';

import { elevationSeries, paceSeries } from '../src/domain/running/charts';
import { parseRunRow, runRowFromSave, type RunDetail } from '../src/domain/running/detail';
import { cropRun, effortLabel, indexAtDistance, savedTrack } from '../src/domain/running/edit';
import { parseGpx } from '../src/domain/running/gpx';
import { initialRecorder, type RecorderState } from '../src/domain/running/recorder';
import { buildSaveRunInput } from '../src/domain/running/save';
import { summarizeRun } from '../src/domain/running/summarize';
import type { RunDistanceUnit } from '../src/domain/running/units';

const DIR = path.join(__dirname, 'fixtures', 'gpx');

function savedRun(name: string, unit: RunDistanceUnit = 'km', steps: number | null = 6000): RunDetail {
  const fixes = parseGpx(fs.readFileSync(path.join(DIR, `${name}.gpx`), 'utf8'));
  const ts = fixes.map((f) => f.t);
  const recorder: RecorderState = {
    ...initialRecorder,
    status: 'finished',
    startedAt: Math.min(...ts),
    finishedAt: Math.max(...ts),
  };
  const summary = summarizeRun(fixes, recorder, { autoPause: true, unit, bodyweightKg: 75 });
  const input = buildSaveRunInput(summary, {
    runId: `run-${name}`,
    startedAt: recorder.startedAt!,
    unit,
    mapVisibility: 'private',
    steps,
  });
  return parseRunRow(runRowFromSave(input));
}

describe('a saved run read back', () => {
  it('carries distance and moving time at every point, so it can be trimmed', () => {
    const run = savedRun('steady-5k');
    expect(run.trimmable).toBe(true);
    const track = savedTrack(run);
    const end = track[track.length - 1];
    expect(Math.abs(end.d - run.distanceM)).toBeLessThan(1);
    expect(Math.abs(end.mt - run.movingSeconds)).toBeLessThanOrEqual(2);
  });

  it('measures distance by what was run, not by the line, across a manual pause', () => {
    // The paused fixture jumps 500 m while paused; that was never run.
    const run = savedRun('paused');
    const track = savedTrack(run);
    expect(Math.abs(track[track.length - 1].d - run.distanceM)).toBeLessThan(1);
    expect(run.distanceM).toBeLessThan(2100);
  });

  it('falls back to the line for a run saved before per-point distances, and can’t be trimmed', () => {
    const run = savedRun('steady-5k');
    const old: RunDetail = { ...run, trimmable: false, route: run.route.map((p) => ({ ...p, d: null, mt: null })) };
    const track = savedTrack(old);
    expect(track[track.length - 1].d).toBeGreaterThan(4900);
    expect(cropRun(old, 10, 100)).toEqual({ ok: false, reason: 'not-trimmable' });
  });
});

describe('trimming a run', () => {
  const run = savedRun('steady-5k');
  const track = savedTrack(run);

  it('drops the first kilometre and works everything out again', () => {
    const from = indexAtDistance(track, 1000);
    const result = cropRun(run, from, track.length - 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { input } = result;
    expect(input.p_from).toBe(from + 1);
    expect(input.p_to).toBe(track.length);
    expect(Math.abs(input.p_distance_m - (run.distanceM - track[from].d))).toBeLessThan(0.2);
    expect(Math.abs(input.p_distance_m - (run.distanceM - 1000))).toBeLessThan(15);
    expect(input.p_moving_seconds).toBe(Math.round(track[track.length - 1].mt - track[from].mt));
    expect(input.p_elapsed_seconds).toBeGreaterThanOrEqual(input.p_moving_seconds);
    // Four full kilometres now, and no 5K inside a 4K run.
    expect(input.p_splits.filter((s) => s[2] >= 999)).toHaveLength(4);
    expect(input.p_best_efforts['5k']).toBeUndefined();
    expect(input.p_best_efforts.mile).toBeGreaterThan(0);
    // Calories by distance kept, steps by moving time kept.
    expect(input.p_calories).toBe(Math.round((run.calories! * input.p_distance_m) / run.distanceM));
    expect(input.p_steps).toBe(Math.round((6000 * input.p_moving_seconds) / run.movingSeconds));
  });

  it('trims the end too, and keeps the track for the map', () => {
    const to = indexAtDistance(track, 3000);
    const result = cropRun(run, 0, to);
    expect(result.ok && Math.abs(result.input.p_distance_m - 3000) < 15).toBe(true);
    expect(result.ok && result.track[0].d).toBe(0);
  });

  it('keeps a flat run flat, wherever it is trimmed', () => {
    for (let from = 7; from < 200; from += 7) {
      const result = cropRun(run, from, track.length - 1 - from);
      expect(result.ok && result.input.p_elevation_gain_m).toBeLessThanOrEqual(1);
    }
  });

  it('says so when nothing would change', () => {
    expect(cropRun(run, 0, track.length - 1)).toEqual({ ok: false, reason: 'unchanged' });
  });

  it('refuses to keep less than a real run', () => {
    expect(cropRun(run, 100, 100)).toEqual({ ok: false, reason: 'too-short' });
    expect(cropRun(run, 0, indexAtDistance(track, 20))).toEqual({ ok: false, reason: 'too-short' });
  });

  it('keeps no step count when there wasn’t one', () => {
    const noSteps = savedRun('steady-5k', 'km', null);
    const result = cropRun(noSteps, 0, indexAtDistance(savedTrack(noSteps), 2000));
    expect(result.ok && result.input.p_steps).toBeNull();
  });

  it('finds the nearest point to a distance', () => {
    expect(indexAtDistance(track, 0)).toBe(0);
    expect(indexAtDistance(track, 1e9)).toBe(track.length - 1);
    const i = indexAtDistance(track, 2500);
    expect(Math.abs(track[i].d - 2500)).toBeLessThan(10);
  });
});

describe('the charts on a run’s summary', () => {
  it('draws a steady pace for a steady run', () => {
    const run = savedRun('steady-5k');
    const pace = paceSeries(savedTrack(run), 'km');
    expect(pace.length).toBeGreaterThan(100);
    for (const p of pace) expect(Math.abs(p.y - 1000 / 3)).toBeLessThan(1000 / 3 * 0.15);
    expect(pace[pace.length - 1].x).toBeCloseTo(run.distanceM / 1000, 1);
  });

  it('leaves a stop at a light out of the pace chart', () => {
    const run = savedRun('stoplight-doppler');
    const pace = paceSeries(savedTrack(run), 'km');
    expect(Math.max(...pace.map((p) => p.y))).toBeLessThan(1000 / 3 * 1.2);
  });

  it('draws the climb on a hilly run', () => {
    const run = savedRun('hill');
    const elevation = elevationSeries(savedTrack(run), 'km');
    const ys = elevation.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(25);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(36);
  });

  it('draws nothing for a run too short to have a trend', () => {
    const run = savedRun('steady-5k');
    const short = savedTrack(run).filter((p) => p.d < 300);
    expect(paceSeries(short, 'km')).toEqual([]);
  });

  it('works in miles too', () => {
    const run = savedRun('steady-5k', 'mi');
    const pace = paceSeries(savedTrack(run), 'mi');
    expect(Math.abs(pace[10].y - 1609.344 / 3)).toBeLessThan(1609.344 / 3 * 0.15);
  });
});

describe('effort', () => {
  it('reads as a word', () => {
    expect([1, 3, 4, 6, 7, 8, 9, 10].map(effortLabel)).toEqual([
      'Easy', 'Easy', 'Moderate', 'Moderate', 'Hard', 'Hard', 'All out', 'All out',
    ]);
  });
});
