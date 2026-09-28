import {
  acceptsFixes,
  countdownRemaining,
  elapsedMs,
  initialRecorder,
  recordingMs,
  reduceRecorder,
  type RecorderEvent,
  type RecorderState,
} from '../src/domain/running/recorder';
import { liveStats } from '../src/domain/running/summarize';
import { offset } from '../src/domain/running/geo';
import type { GpsFix } from '../src/domain/running/types';

const T = 1_000_000;
const play = (events: RecorderEvent[], from: RecorderState = initialRecorder) =>
  events.reduce(reduceRecorder, from);

describe('recorder state machine', () => {
  it('counts down, then records from when the countdown ends', () => {
    let s = play([{ type: 'start', now: T }]);
    expect(s.status).toBe('countdown');
    expect(countdownRemaining(s, T + 100)).toBe(3);
    expect(countdownRemaining(s, T + 2100)).toBe(1);
    s = reduceRecorder(s, { type: 'tick', now: T + 1000 });
    expect(s.status).toBe('countdown');
    s = reduceRecorder(s, { type: 'tick', now: T + 3400 });
    expect(s).toMatchObject({ status: 'recording', startedAt: T + 3000 });
    expect(acceptsFixes(s)).toBe(true);
  });

  it('can skip or cancel the countdown, or start without one', () => {
    expect(play([{ type: 'start', now: T }, { type: 'skipCountdown', now: T + 500 }])).toMatchObject({
      status: 'recording',
      startedAt: T + 500,
    });
    expect(play([{ type: 'start', now: T }, { type: 'cancel' }])).toEqual(initialRecorder);
    expect(play([{ type: 'start', now: T, countdownSeconds: 0 }])).toMatchObject({ status: 'recording', startedAt: T });
  });

  it('pauses and resumes into a new segment, and keeps pause time out', () => {
    const s = play([
      { type: 'start', now: T, countdownSeconds: 0 },
      { type: 'pause', now: T + 60_000 },
      { type: 'resume', now: T + 90_000 },
    ]);
    expect(s).toMatchObject({ status: 'recording', segment: 1, pausedMs: 30_000 });
    expect(elapsedMs(s, T + 120_000)).toBe(120_000);
    expect(recordingMs(s, T + 120_000)).toBe(90_000);
  });

  it('does not take fixes while paused, and counts an open pause', () => {
    const s = play([
      { type: 'start', now: T, countdownSeconds: 0 },
      { type: 'pause', now: T + 10_000 },
    ]);
    expect(acceptsFixes(s)).toBe(false);
    expect(recordingMs(s, T + 25_000)).toBe(10_000);
  });

  it('finishes from paused, adding the pause', () => {
    const s = play([
      { type: 'start', now: T, countdownSeconds: 0 },
      { type: 'pause', now: T + 10_000 },
      { type: 'finish', now: T + 40_000 },
    ]);
    expect(s).toMatchObject({ status: 'finished', finishedAt: T + 40_000, pausedMs: 30_000 });
    expect(recordingMs(s, T + 999_999)).toBe(10_000);
  });

  it('ignores events that do not fit, so a double tap cannot corrupt a run', () => {
    const recording = play([{ type: 'start', now: T, countdownSeconds: 0 }]);
    expect(reduceRecorder(recording, { type: 'start', now: T + 5 })).toBe(recording);
    expect(reduceRecorder(recording, { type: 'resume', now: T + 5 })).toBe(recording);
    const finished = reduceRecorder(recording, { type: 'finish', now: T + 10 });
    expect(reduceRecorder(finished, { type: 'finish', now: T + 20 })).toBe(finished);
    expect(reduceRecorder(finished, { type: 'pause', now: T + 20 })).toBe(finished);
    expect(reduceRecorder(initialRecorder, { type: 'finish', now: T })).toBe(initialRecorder);
  });
});

describe('liveStats', () => {
  const HOME = { lat: 47.9253, lon: -97.0329 };
  const fixesFor = (seconds: number, speed = 3): GpsFix[] =>
    Array.from({ length: seconds / 2 + 1 }, (_, i) => {
      const p = offset(HOME, i * 2 * speed, 90);
      return { lat: p.lat, lon: p.lon, alt: null, t: T + i * 2000, accuracy: 5, seg: 0 };
    });
  const recording = play([{ type: 'start', now: T, countdownSeconds: 0 }]);

  it('shows distance, the moving clock and paces while running', () => {
    const s = liveStats(fixesFor(120), recording, T + 121_000, { autoPause: true, unit: 'km' });
    expect(s.distanceM).toBeGreaterThan(355);
    expect(s.distanceM).toBeLessThan(365);
    expect(s.movingSeconds).toBe(121);
    expect(s.autoPaused).toBe(false);
    expect(s.currentPace).toBeCloseTo(1000 / 3, 0);
    expect(s.averagePace).not.toBeNull();
  });

  it('auto-pauses when fixes stop arriving, and stops the clock', () => {
    const s = liveStats(fixesFor(120), recording, T + 140_000, { autoPause: true, unit: 'km' });
    expect(s.autoPaused).toBe(true);
    expect(s.movingSeconds).toBe(120);
    expect(s.currentPace).toBeNull();
    expect(s.elapsedSeconds).toBe(140);
  });

  it('keeps the clock running with auto-pause off', () => {
    const s = liveStats(fixesFor(120), recording, T + 140_000, { autoPause: false, unit: 'km' });
    expect(s.autoPaused).toBe(false);
    expect(s.movingSeconds).toBe(140);
  });

  it('starts at zero before the first fix', () => {
    const s = liveStats([], recording, T + 3000, { autoPause: true, unit: 'mi' });
    expect(s).toMatchObject({ distanceM: 0, movingSeconds: 0, currentPace: null, averagePace: null, autoPaused: false });
  });
});
