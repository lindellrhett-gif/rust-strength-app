import {
  ACTIVITY_KINDS,
  ACTIVITY_LABEL,
  ACTIVITY_FIELDS,
  activityTitle,
  activityMetrics,
  validateActivity,
  toSeconds,
  fromSeconds,
  activityTotals,
  topKind,
  type ActivityRecord,
} from '@/domain/activities';

function activity(partial: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: 'a1',
    kind: 'run',
    name: null,
    performedAt: '2026-09-07T10:00:00.000Z',
    durationSeconds: 1800,
    distance: null,
    distanceUnit: null,
    steps: null,
    calories: null,
    ...partial,
  };
}

describe('activity catalogue', () => {
  it('labels every kind it offers', () => {
    for (const kind of ACTIVITY_KINDS) {
      expect(ACTIVITY_LABEL[kind]).toBeTruthy();
      expect(ACTIVITY_FIELDS[kind]).toBeDefined();
    }
  });

  it('offers distance for running but not for basketball', () => {
    expect(ACTIVITY_FIELDS.run.distance).toBe(true);
    expect(ACTIVITY_FIELDS.basketball.distance).toBe(false);
  });

  it('offers steps on the stair master but not on a bike', () => {
    expect(ACTIVITY_FIELDS.stairmaster.steps).toBe(true);
    expect(ACTIVITY_FIELDS.cycle.steps).toBe(false);
  });
});

describe('activityTitle', () => {
  it('prefers a custom name', () => {
    expect(activityTitle({ kind: 'soccer', name: '5-a-side' })).toBe('5-a-side');
  });

  it('falls back to the kind label', () => {
    expect(activityTitle({ kind: 'stairmaster', name: null })).toBe('Stair Master');
    expect(activityTitle({ kind: 'run', name: '   ' })).toBe('Run');
  });
});

describe('activityMetrics', () => {
  it('lists only what was recorded', () => {
    expect(
      activityMetrics(activity({ distance: 3.2, distanceUnit: 'mi', calories: 410 })),
    ).toBe('3.2 mi · 410 cal');
  });

  it('is empty when nothing optional was entered', () => {
    expect(activityMetrics(activity())).toBe('');
  });

  it('skips zero values rather than showing "0 steps"', () => {
    expect(activityMetrics(activity({ steps: 0, calories: 0 }))).toBe('');
  });

  it('formats large step counts with separators', () => {
    expect(activityMetrics(activity({ steps: 12000 }))).toBe('12,000 steps');
  });
});

describe('validateActivity', () => {
  it('accepts a plain timed activity', () => {
    expect(validateActivity({ kind: 'run', durationSeconds: 600 })).toEqual({
      ok: true,
      error: null,
    });
  });

  it('requires a positive duration', () => {
    expect(validateActivity({ kind: 'run', durationSeconds: 0 }).ok).toBe(false);
    expect(validateActivity({ kind: 'run', durationSeconds: -5 }).ok).toBe(false);
  });

  it('rejects an absurd duration', () => {
    expect(validateActivity({ kind: 'run', durationSeconds: 86_400 * 3 }).ok).toBe(false);
  });

  it('rejects negative optional metrics', () => {
    expect(validateActivity({ kind: 'run', durationSeconds: 60, steps: -1 }).ok).toBe(false);
    expect(validateActivity({ kind: 'run', durationSeconds: 60, distance: -2 }).ok).toBe(false);
  });

  it('allows optional metrics to be absent', () => {
    expect(
      validateActivity({
        kind: 'basketball',
        durationSeconds: 3600,
        distance: null,
        steps: null,
        calories: null,
      }).ok,
    ).toBe(true);
  });
});

describe('duration conversion', () => {
  it('converts hours and minutes to seconds', () => {
    expect(toSeconds(1, 30)).toBe(5400);
    expect(toSeconds(0, 45)).toBe(2700);
  });

  it('round-trips back to hours and minutes', () => {
    expect(fromSeconds(5400)).toEqual({ hours: 1, minutes: 30, seconds: 0 });
    expect(fromSeconds(0)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('drops leftover seconds when splitting', () => {
    // Seconds are kept: a run time is a personal record, not a rounded one.
    expect(fromSeconds(5445)).toEqual({ hours: 1, minutes: 30, seconds: 45 });
  });

  it('treats nonsense input as zero', () => {
    expect(toSeconds(NaN, NaN)).toBe(0);
    expect(fromSeconds(-100)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });

  it('keeps a typed-in run time exact to the second', () => {
    expect(toSeconds(0, 22, 47)).toBe(22 * 60 + 47);
    expect(toSeconds(1, 5, 9)).toBe(3600 + 5 * 60 + 9);
    // A time entered with no seconds still works.
    expect(toSeconds(0, 30)).toBe(1800);
    const split = fromSeconds(toSeconds(0, 22, 47));
    expect(split).toEqual({ hours: 0, minutes: 22, seconds: 47 });
  });
});

describe('activityTotals', () => {
  it('sums time and groups it by kind', () => {
    const totals = activityTotals([
      activity({ id: '1', kind: 'run', durationSeconds: 1800 }),
      activity({ id: '2', kind: 'run', durationSeconds: 1200 }),
      activity({ id: '3', kind: 'basketball', durationSeconds: 3600 }),
    ]);
    expect(totals.totalSeconds).toBe(6600);
    expect(totals.count).toBe(3);
    expect(totals.byKind.run).toBe(3000);
    expect(totals.byKind.basketball).toBe(3600);
  });

  it('is all zeros with no activities', () => {
    expect(activityTotals([])).toEqual({ totalSeconds: 0, count: 0, byKind: {} });
  });
});

describe('topKind', () => {
  it('picks the kind with the most time, not the most entries', () => {
    const totals = activityTotals([
      activity({ id: '1', kind: 'run', durationSeconds: 600 }),
      activity({ id: '2', kind: 'run', durationSeconds: 600 }),
      activity({ id: '3', kind: 'basketball', durationSeconds: 5400 }),
    ]);
    expect(topKind(totals)).toBe('basketball');
  });

  it('is null when nothing has been logged', () => {
    expect(topKind(activityTotals([]))).toBeNull();
  });
});
