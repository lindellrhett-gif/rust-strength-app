import {
  addDays,
  daysBetween,
  currentStreak,
  bestStreak,
  allTimeTotals,
  weeklyCoverage,
  uncoveredGroups,
  weekStart,
  MUSCLE_GROUPS,
  type MuscleGroup,
} from '@/domain/stats';

describe('date helpers', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28'); // 2026 is not a leap year
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // 2024 is
  });

  it('counts whole days between dates', () => {
    expect(daysBetween('2026-09-01', '2026-09-03')).toBe(2);
    expect(daysBetween('2026-09-03', '2026-09-01')).toBe(-2);
  });
});

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(
      currentStreak(['2026-09-01', '2026-09-02', '2026-09-03'], '2026-09-03'),
    ).toBe(3);
  });

  it('stays alive if the user trained yesterday but not yet today', () => {
    expect(currentStreak(['2026-09-01', '2026-09-02'], '2026-09-03')).toBe(2);
  });

  it('is zero when the most recent workout was more than a day ago', () => {
    expect(currentStreak(['2026-08-20'], '2026-09-03')).toBe(0);
    expect(currentStreak([], '2026-09-03')).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(currentStreak(['2026-09-01', '2026-09-03'], '2026-09-03')).toBe(1);
  });

  it('is unfazed by duplicate dates', () => {
    expect(currentStreak(['2026-09-03', '2026-09-03'], '2026-09-03')).toBe(1);
  });
});

describe('rest days and streaks', () => {
  it('bridges a gap so the streak survives a day off', () => {
    // Trained Mon and Wed, rested Tue.
    expect(
      currentStreak(['2026-09-01', '2026-09-03'], '2026-09-03', ['2026-09-02']),
    ).toBe(3);
  });

  it('keeps the streak alive when today is a rest day', () => {
    expect(currentStreak(['2026-09-02'], '2026-09-03', ['2026-09-03'])).toBe(2);
  });

  it('still breaks on a day that was neither trained nor rested', () => {
    expect(
      currentStreak(['2026-09-01', '2026-09-04'], '2026-09-04', ['2026-09-02']),
    ).toBe(1);
  });

  it('refuses to build a streak out of rest days alone', () => {
    expect(currentStreak([], '2026-09-03', ['2026-09-01', '2026-09-02', '2026-09-03'])).toBe(0);
  });

  it('counts rest days toward the best streak too', () => {
    expect(bestStreak(['2026-09-01', '2026-09-03'], ['2026-09-02'])).toBe(3);
  });

  it('does not let a run of pure rest become a best streak', () => {
    // One workout far from a long rest block.
    expect(
      bestStreak(['2026-09-20'], ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']),
    ).toBe(1);
  });

  it('behaves exactly as before when no rest days are given', () => {
    expect(currentStreak(['2026-09-01', '2026-09-02', '2026-09-03'], '2026-09-03')).toBe(3);
    expect(bestStreak(['2026-09-01', '2026-09-02', '2026-09-10'])).toBe(2);
  });
});

describe('bestStreak', () => {
  it('finds the longest consecutive run', () => {
    expect(
      bestStreak([
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
        '2026-09-10',
        '2026-09-11',
      ]),
    ).toBe(3);
  });

  it('handles unsorted input and duplicates', () => {
    expect(bestStreak(['2026-09-03', '2026-09-01', '2026-09-02', '2026-09-02'])).toBe(3);
  });

  it('is zero for no data and one for a lone day', () => {
    expect(bestStreak([])).toBe(0);
    expect(bestStreak(['2026-09-01'])).toBe(1);
  });
});

describe('allTimeTotals', () => {
  it('sums volume, reps, sets and distinct completed workouts', () => {
    const sets = [
      { weight: 100, reps: 10, workoutId: 'w1' },
      { weight: 100, reps: 8, workoutId: 'w1' },
      { weight: 50, reps: 12, workoutId: 'w2' },
    ];
    const totals = allTimeTotals(sets, ['w1', 'w2']);
    expect(totals.volume).toBe(100 * 10 + 100 * 8 + 50 * 12);
    expect(totals.reps).toBe(30);
    expect(totals.sets).toBe(3);
    expect(totals.workouts).toBe(2);
  });

  it('is all zeros with no data', () => {
    expect(allTimeTotals([], [])).toEqual({
      volume: 0,
      reps: 0,
      sets: 0,
      workouts: 0,
    });
  });
});

describe('weeklyCoverage', () => {
  it('counts sets per muscle group and reports the gaps', () => {
    const sets: { muscleGroup: MuscleGroup }[] = [
      { muscleGroup: 'chest' },
      { muscleGroup: 'chest' },
      { muscleGroup: 'back' },
    ];
    const coverage = weeklyCoverage(sets);
    expect(coverage.chest).toBe(2);
    expect(coverage.back).toBe(1);
    expect(coverage.quads).toBe(0);

    const gaps = uncoveredGroups(coverage);
    expect(gaps).not.toContain('chest');
    expect(gaps).toContain('quads');
    expect(gaps.length).toBe(MUSCLE_GROUPS.length - 2);
  });
});

describe('weekStart', () => {
  it('returns the Monday of the containing week', () => {
    const monday = weekStart('2026-09-03');
    expect(daysBetween(monday, '2026-09-03')).toBeGreaterThanOrEqual(0);
    expect(daysBetween(monday, '2026-09-03')).toBeLessThanOrEqual(6);
    // The Monday of a week is its own week start.
    expect(weekStart(monday)).toBe(monday);
  });
});
