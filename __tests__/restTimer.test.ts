import {
  DEFAULT_REST_SECONDS,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  REST_PRESETS,
  adjustRest,
  clampRest,
  formatRest,
  isRestOver,
  remainingSeconds,
  restLabel,
  restProgress,
} from '@/domain/restTimer';

describe('clampRest', () => {
  it('keeps a sensible duration untouched', () => {
    expect(clampRest(90)).toBe(90);
  });

  it('pulls values back inside the allowed range', () => {
    expect(clampRest(0)).toBe(MIN_REST_SECONDS);
    expect(clampRest(99_999)).toBe(MAX_REST_SECONDS);
  });

  it('falls back to the default for junk', () => {
    expect(clampRest(Number.NaN)).toBe(DEFAULT_REST_SECONDS);
    expect(clampRest(Number.POSITIVE_INFINITY)).toBe(DEFAULT_REST_SECONDS);
  });

  it('rounds to whole seconds', () => {
    expect(clampRest(90.6)).toBe(91);
  });
});

describe('adjustRest', () => {
  it('steps up and down', () => {
    expect(adjustRest(90, 15)).toBe(105);
    expect(adjustRest(90, -15)).toBe(75);
  });

  it('will not step below the minimum', () => {
    expect(adjustRest(MIN_REST_SECONDS, -60)).toBe(MIN_REST_SECONDS);
  });

  it('will not step above the maximum', () => {
    expect(adjustRest(MAX_REST_SECONDS, 60)).toBe(MAX_REST_SECONDS);
  });
});

describe('remainingSeconds', () => {
  it('counts down toward the deadline', () => {
    expect(remainingSeconds(10_000, 0)).toBe(10);
    expect(remainingSeconds(10_000, 5_000)).toBe(5);
  });

  it('never goes negative once the deadline has passed', () => {
    expect(remainingSeconds(10_000, 50_000)).toBe(0);
  });

  it('rounds up, so a timer never shows 0 while time is left', () => {
    expect(remainingSeconds(10_000, 9_500)).toBe(1);
  });

  it('survives a phone sleeping through the whole rest', () => {
    // A counter that ticked would have drifted; a deadline simply expires.
    expect(remainingSeconds(60_000, 3_600_000)).toBe(0);
    expect(isRestOver(60_000, 3_600_000)).toBe(true);
  });

  it('treats junk as finished rather than running forever', () => {
    expect(remainingSeconds(Number.NaN, 1_000)).toBe(0);
  });
});

describe('restProgress', () => {
  it('runs from 0 at the start to 1 at the end', () => {
    expect(restProgress(120, 120)).toBe(0);
    expect(restProgress(120, 60)).toBe(0.5);
    expect(restProgress(120, 0)).toBe(1);
  });

  it('stays inside 0..1 for nonsense input', () => {
    expect(restProgress(120, 500)).toBe(0);
    expect(restProgress(120, -50)).toBe(1);
    expect(restProgress(0, 0)).toBe(1);
  });
});

describe('formatting', () => {
  it('formats as m:ss', () => {
    expect(formatRest(0)).toBe('0:00');
    expect(formatRest(9)).toBe('0:09');
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(600)).toBe('10:00');
  });

  it('counts past an hour instead of wrapping', () => {
    expect(formatRest(3_600)).toBe('60:00');
  });

  it('labels presets the way a lifter would say them', () => {
    expect(restLabel(30)).toBe('30s');
    expect(restLabel(120)).toBe('2 min');
    expect(restLabel(300)).toBe('5 min');
    expect(restLabel(95)).toBe('1:35');
  });

  it('offers presets that are all valid durations', () => {
    for (const p of REST_PRESETS) expect(clampRest(p)).toBe(p);
  });
});
