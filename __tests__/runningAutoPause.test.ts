/**
 * Auto-pause, live and in the summary. The simulated runs are replayed one
 * second at a time, exactly as the recording screen sees them: only the fixes
 * that have arrived so far, and the clock ticking in between.
 */
import * as fs from 'fs';
import * as path from 'path';

import { filterFixes } from '../src/domain/running/filter';
import { parseGpx } from '../src/domain/running/gpx';
import { initialRecorder, type RecorderState } from '../src/domain/running/recorder';
import { findStops } from '../src/domain/running/stops';
import { liveStats, summarizeRun, type LiveStats } from '../src/domain/running/summarize';
import { stoppedMs } from '../src/domain/running/track';
import type { GpsFix, MotionSample } from '../src/domain/running/types';

const DIR = path.join(__dirname, 'fixtures', 'gpx');
const truth: Record<string, { distanceM: number; movingSeconds: number; elapsedSeconds: number }> = JSON.parse(
  fs.readFileSync(path.join(DIR, 'fixtures.json'), 'utf8'),
);
const load = (name: string): GpsFix[] => parseGpx(fs.readFileSync(path.join(DIR, `${name}.gpx`), 'utf8'));

interface Tick extends LiveStats {
  /** Seconds since the start. */
  s: number;
}

function replay(name: string): { ticks: Tick[]; fixes: GpsFix[]; t0: number } {
  const fixes = load(name);
  const t0 = fixes[0].t;
  const end = fixes[fixes.length - 1].t;
  const recorder: RecorderState = { ...initialRecorder, status: 'recording', startedAt: t0 };
  const ticks: Tick[] = [];
  let arrived = 0;
  for (let now = t0; now <= end; now += 1000) {
    while (arrived < fixes.length && fixes[arrived].t <= now) arrived += 1;
    ticks.push({ s: (now - t0) / 1000, ...liveStats(fixes.slice(0, arrived), recorder, now, { autoPause: true, unit: 'km' }) });
  }
  return { ticks, fixes, t0 };
}

function summary(fixes: GpsFix[]) {
  const ts = fixes.map((f) => f.t);
  const recorder: RecorderState = {
    ...initialRecorder,
    status: 'finished',
    startedAt: Math.min(...ts),
    finishedAt: Math.max(...ts),
  };
  return summarizeRun(fixes, recorder, { autoPause: true, unit: 'km', bodyweightKg: 70 });
}

const pausedAt = (ticks: Tick[]) => ticks.filter((t) => t.autoPaused).map((t) => t.s);

describe('auto-pause with the phone’s speed reading', () => {
  it('never pauses a slow walk with poor GPS, and catches the stop in it', () => {
    // 600 m at 1.35 m/s (444 s), 20 s standing, 600 m more.
    const { ticks, fixes } = replay('walk-poor-gps');
    const paused = pausedAt(ticks);
    expect(paused.length).toBeGreaterThan(0);
    expect(Math.min(...paused)).toBeGreaterThanOrEqual(444);
    expect(Math.min(...paused)).toBeLessThanOrEqual(451);
    expect(Math.max(...paused)).toBeLessThanOrEqual(466);

    const s = summary(fixes);
    expect(Math.abs(s.movingSeconds - truth['walk-poor-gps'].movingSeconds)).toBeLessThanOrEqual(5);
    expect(Math.abs(s.distanceM - 1200)).toBeLessThan(1200 * 0.04);
  });

  it('pauses at a light within seconds, resumes right away, and never runs the clock backwards', () => {
    // 1500 m at 3 m/s (500 s), 45 s standing, 1500 m more.
    const { ticks, fixes } = replay('stoplight-doppler');
    const paused = pausedAt(ticks);
    expect(Math.min(...paused)).toBeGreaterThanOrEqual(500);
    expect(Math.min(...paused)).toBeLessThanOrEqual(507);
    expect(Math.max(...paused)).toBeLessThanOrEqual(546);
    // Nothing paused outside the stop.
    expect(paused.every((s) => s >= 500 && s <= 546)).toBe(true);

    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i].movingSeconds).toBeGreaterThanOrEqual(ticks[i - 1].movingSeconds);
    }
    // The clock held through the stop.
    const at = (s: number) => ticks.find((t) => t.s === s)!.movingSeconds;
    expect(at(540) - at(505)).toBeLessThanOrEqual(1);

    const s = summary(fixes);
    expect(Math.abs(s.movingSeconds - truth['stoplight-doppler'].movingSeconds)).toBeLessThanOrEqual(4);
    // What the runner saw at the end matches what gets saved.
    expect(Math.abs(ticks[ticks.length - 1].movingSeconds - s.movingSeconds)).toBeLessThanOrEqual(2);
  });

  it('keeps moving through a tunnel with no fixes at all', () => {
    // 1400 m at 3 m/s (467 s), then 60 s with no signal while still running.
    const { ticks, fixes } = replay('tunnel-doppler');
    expect(pausedAt(ticks)).toEqual([]);
    const at = (s: number) => ticks.find((t) => t.s === s)!.movingSeconds;
    expect(at(520) - at(470)).toBeGreaterThanOrEqual(49);
    expect(Math.abs(summary(fixes).movingSeconds - truth['tunnel-doppler'].movingSeconds)).toBeLessThanOrEqual(4);
  });
});

describe('auto-pause without a speed reading', () => {
  it('still finds a stop at a light from the positions alone', () => {
    // Fixes every 2 s, no speed: 500 s running, 45 s stopped.
    const { ticks } = replay('stoplight');
    const paused = pausedAt(ticks);
    expect(paused.length).toBeGreaterThan(20);
    expect(paused.every((s) => s >= 500 && s <= 548)).toBe(true);
  });

  it('never pauses a steady run or a tunnel', () => {
    expect(pausedAt(replay('steady-5k').ticks)).toEqual([]);
    expect(pausedAt(replay('tunnel').ticks)).toEqual([]);
  });
});

describe('findStops', () => {
  const sample = (s: number, state: MotionSample['state'], measured = true, seg = 0): MotionSample => ({
    t: s * 1000,
    seg,
    state,
    measured,
  });

  it('turns five seconds of standing still into a stop, dated from the last movement', () => {
    const samples = [sample(0, 'moving'), sample(1, 'moving'), ...[2, 3, 4, 5, 6, 7].map((s) => sample(s, 'still')), sample(8, 'moving')];
    expect(findStops(samples).stops).toEqual([{ start: 1000, end: 7000, open: false }]);
  });

  it('ignores a slow moment shorter than that, like a sharp turn', () => {
    const samples = [sample(0, 'moving'), sample(1, 'still'), sample(2, 'still'), sample(3, 'moving')];
    expect(findStops(samples).stops).toEqual([]);
  });

  it('reports a stop still going at the end as open, up to now', () => {
    const samples = [sample(0, 'moving'), sample(1, 'still'), sample(2, 'still')];
    expect(findStops(samples, 9000).stops).toEqual([{ start: 0, end: 9000, open: true }]);
  });

  it('reports a fresh stillness as pending, and says whether the speed reading saw it', () => {
    const measured = findStops([sample(0, 'moving'), sample(1, 'still')], 2000);
    expect(measured.pending).toEqual({ start: 0, end: 2000, open: true, measured: true });
    const guessed = findStops([sample(0, 'moving'), sample(1, 'still', false)], 2000);
    expect(guessed.pending?.measured).toBe(false);
  });

  it('lets unsure samples pass without ending a stop', () => {
    const samples = [sample(0, 'moving'), sample(2, 'still'), sample(4, 'unsure'), sample(6, 'still'), sample(7, 'moving')];
    expect(findStops(samples).stops).toEqual([{ start: 0, end: 6000, open: false }]);
  });

  it('ends a stop at a manual pause', () => {
    const samples = [
      sample(0, 'moving'),
      ...[1, 2, 3, 4, 5, 6].map((s) => sample(s, 'still')),
      sample(100, 'still', true, 1),
      sample(101, 'moving', true, 1),
    ];
    expect(findStops(samples).stops).toEqual([{ start: 0, end: 6000, open: false }]);
  });

  it('measures how much of a span was spent stopped', () => {
    const stops = [
      { start: 10_000, end: 20_000, open: false },
      { start: 30_000, end: 40_000, open: false },
    ];
    expect(stoppedMs(stops, 0, 50_000)).toBe(20_000);
    expect(stoppedMs(stops, 15_000, 35_000)).toBe(10_000);
    expect(stoppedMs(stops, 20_000, 30_000)).toBe(0);
  });
});

describe('the phone’s speed reading in the filter', () => {
  const at = (s: number, east: number, speed: number | null, accuracy = 15): GpsFix => ({
    lat: 47.9253,
    lon: -97.0329 + east / 74_600,
    alt: null,
    t: s * 1000,
    accuracy,
    seg: 0,
    speed,
  });

  it('treats a wander inside the accuracy circle as jitter when the phone says it is standing', () => {
    // 12 m away: beyond the usual 10 m jitter radius, inside the 15 m accuracy.
    const standing = filterFixes([at(0, 0, 0), at(8, 12, 0.1)]);
    expect(standing.fixes).toHaveLength(1);
    const walking = filterFixes([at(0, 0, 1.4), at(8, 12, 1.4)]);
    expect(walking.fixes).toHaveLength(2);
  });

  it('decides moving or still from the speed reading when there is one', () => {
    const { motion } = filterFixes([at(0, 0, 3), at(1, 1, 0.2), at(12, 36, null)]);
    expect(motion.map((m) => [m.state, m.measured])).toEqual([
      ['moving', true],
      ['still', true],
      ['moving', false],
    ]);
  });
});
