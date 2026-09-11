import {
  computeXp,
  cumulativeXpForLevel,
  levelForXp,
  levelProgress,
  levelTitle,
  sessionXp,
  strengthScore,
  LB_PER_KG,
  MAX_FRIEND_XP,
  MAX_LEVEL,
  XP_PER_1000LB,
  XP_PER_FRIEND,
  XP_PER_RECORD,
  XP_PER_SET,
  XP_PER_STREAK_DAY,
  XP_PER_TROPHY_TIER,
  XP_PER_WORKOUT,
  type XpInput,
  type XpSourceId,
} from '@/domain/xp';

function input(partial: Partial<XpInput> = {}): XpInput {
  return {
    totalWorkouts: 0,
    totalSets: 0,
    totalVolume: 0,
    totalActivities: 0,
    bestStreak: 0,
    friendCount: 0,
    trophyTiers: 0,
    strengthScore: 0,
    unit: 'lb',
    ...partial,
  };
}

const xpFrom = (result: ReturnType<typeof computeXp>, id: XpSourceId) =>
  result.sources.find((s) => s.id === id)!.xp;

describe('computeXp', () => {
  it('is zero for a brand new account', () => {
    expect(computeXp(input()).total).toBe(0);
  });

  it('pays each source at its published rate', () => {
    const r = computeXp(
      input({
        totalWorkouts: 3,
        totalSets: 40,
        bestStreak: 5,
        trophyTiers: 4,
        totalActivities: 2,
      }),
    );
    expect(xpFrom(r, 'workouts')).toBe(3 * XP_PER_WORKOUT);
    expect(xpFrom(r, 'sets')).toBe(40 * XP_PER_SET);
    expect(xpFrom(r, 'streak')).toBe(5 * XP_PER_STREAK_DAY);
    expect(xpFrom(r, 'trophies')).toBe(4 * XP_PER_TROPHY_TIER);
  });

  it('totals to the sum of its sources', () => {
    const r = computeXp(input({ totalWorkouts: 10, totalSets: 120, totalVolume: 80_000 }));
    expect(r.total).toBe(r.sources.reduce((n, s) => n + s.xp, 0));
  });

  it('caps friend XP so adding people cannot be farmed', () => {
    expect(xpFrom(computeXp(input({ friendCount: 5 })), 'friends')).toBe(5 * XP_PER_FRIEND);
    expect(xpFrom(computeXp(input({ friendCount: 500 })), 'friends')).toBe(MAX_FRIEND_XP);
  });

  it('scores volume per thousand pounds', () => {
    expect(xpFrom(computeXp(input({ totalVolume: 10_000 })), 'volume')).toBe(10 * XP_PER_1000LB);
  });

  it('pays a kilo lifter the same XP as a pound lifter for the same work', () => {
    const lb = computeXp(input({ totalVolume: 100_000, strengthScore: 2_000, unit: 'lb' }));
    const kg = computeXp(
      input({
        totalVolume: 100_000 / LB_PER_KG,
        strengthScore: 2_000 / LB_PER_KG,
        unit: 'kg',
      }),
    );
    expect(Math.abs(lb.total - kg.total)).toBeLessThanOrEqual(1);
  });

  it('never returns negative XP from junk input', () => {
    const r = computeXp(input({ totalWorkouts: -5, totalVolume: -1000, friendCount: -3 }));
    expect(r.total).toBe(0);
    for (const s of r.sources) expect(s.xp).toBeGreaterThanOrEqual(0);
  });

  it('pluralises activities correctly rather than saying "activitys"', () => {
    const one = computeXp(input({ totalActivities: 1 }));
    const many = computeXp(input({ totalActivities: 4 }));
    expect(one.sources.find((s) => s.id === 'activities')!.detail).toBe('1 activity');
    expect(many.sources.find((s) => s.id === 'activities')!.detail).toBe('4 activities');
  });
});

describe('the level curve', () => {
  it('starts everyone at level 1 with no XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(cumulativeXpForLevel(1)).toBe(0);
  });

  it('places the documented milestones where the comment says they are', () => {
    expect(cumulativeXpForLevel(2)).toBe(100);
    expect(cumulativeXpForLevel(5)).toBe(1_000);
    expect(cumulativeXpForLevel(20)).toBe(19_000);
    expect(cumulativeXpForLevel(MAX_LEVEL)).toBe(495_000);
  });

  it('round-trips every level boundary exactly', () => {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const floor = cumulativeXpForLevel(level);
      expect(levelForXp(floor)).toBe(level);
      if (level > 1) expect(levelForXp(floor - 1)).toBe(level - 1);
    }
  });

  it('never exceeds the cap', () => {
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL);
    expect(levelProgress(10_000_000).maxed).toBe(true);
    expect(levelProgress(10_000_000).xpToNext).toBe(0);
  });

  it('rises monotonically', () => {
    let previous = 0;
    for (let xp = 0; xp < 60_000; xp += 137) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it('reports progress across the current level', () => {
    const half = levelProgress(cumulativeXpForLevel(4) + 150);
    expect(half.level).toBe(4);
    expect(half.xpForLevel).toBe(cumulativeXpForLevel(5) - cumulativeXpForLevel(4));
    expect(half.xpIntoLevel).toBe(150);
    expect(half.xpToNext).toBe(half.xpForLevel - 150);
    expect(half.progress).toBeCloseTo(150 / half.xpForLevel);
  });

  it('treats a negative balance as level 1 rather than crashing', () => {
    expect(levelProgress(-500).level).toBe(1);
    expect(levelProgress(-500).xp).toBe(0);
  });

  it('names each band', () => {
    expect(levelTitle(1)).toBe('Newcomer');
    expect(levelTitle(5)).toBe('Novice');
    expect(levelTitle(10)).toBe('Lifter');
    expect(levelTitle(MAX_LEVEL)).toBe('Legend');
  });
});

describe('sessionXp', () => {
  it('always pays for finishing, even with an empty session', () => {
    expect(sessionXp({ sets: 0, volume: 0, records: 0, unit: 'lb' }).total).toBe(XP_PER_WORKOUT);
  });

  it('omits the records line when nothing was beaten', () => {
    const r = sessionXp({ sets: 12, volume: 9_000, records: 0, unit: 'lb' });
    expect(r.sources.some((s) => s.id === 'records')).toBe(false);
  });

  it('pays a flat bonus per personal record', () => {
    const without = sessionXp({ sets: 12, volume: 9_000, records: 0, unit: 'lb' }).total;
    const with2 = sessionXp({ sets: 12, volume: 9_000, records: 2, unit: 'lb' }).total;
    expect(with2 - without).toBe(2 * XP_PER_RECORD);
  });
});

describe('strengthScore', () => {
  it('sums the best e1RM across exercises', () => {
    expect(strengthScore({ bench: 225, squat: 315, deadlift: 405 })).toBe(945);
  });

  it('ignores missing and nonsense values', () => {
    expect(strengthScore({ bench: 225, broken: NaN, negative: -50, zero: 0 })).toBe(225);
  });

  it('is zero for an empty map', () => {
    expect(strengthScore({})).toBe(0);
  });
});
