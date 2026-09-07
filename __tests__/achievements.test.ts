import {
  evaluateAchievements,
  earnedCount,
  totalTiersEarned,
  totalTiersAvailable,
  topAchievements,
  consistency,
  TIERS,
  LB_PER_KG,
  type AchievementInput,
  type TieredAchievement,
} from '@/domain/achievements';

function input(partial: Partial<AchievementInput> = {}): AchievementInput {
  return {
    totalWorkouts: 0,
    totalVolume: 0,
    totalReps: 0,
    totalSets: 0,
    totalSeconds: 0,
    currentStreak: 0,
    bestStreak: 0,
    groupsThisWeek: 0,
    groupsTotal: 10,
    bestWeightByExercise: {},
    bestRepsByExercise: {},
    unit: 'lb',
    activitySeconds: 0,
    activityCount: 0,
    activityKinds: 0,
    ...partial,
  };
}

const byId = (list: TieredAchievement[], id: string): TieredAchievement => {
  const found = list.find((a) => a.id === id);
  if (!found) throw new Error(`no achievement ${id}`);
  return found;
};

describe('tier ladders', () => {
  it('has nine tiers from wood to legend', () => {
    expect(TIERS).toHaveLength(9);
    expect(TIERS[0]).toBe('wood');
    expect(TIERS[TIERS.length - 1]).toBe('legend');
  });

  it('gives every trophy all nine tiers, in ascending order', () => {
    for (const a of evaluateAchievements(input())) {
      expect(a.tiersTotal).toBe(9);
      expect(a.steps).toHaveLength(9);
      const thresholds = a.steps.map((s) => s.threshold);
      const sorted = [...thresholds].sort((x, y) => x - y);
      expect(thresholds).toEqual(sorted);
    }
  });

  it('uses the exact bench ladder that was specified', () => {
    const bench = byId(evaluateAchievements(input()), 'lift-bench');
    expect(bench.steps.map((s) => s.threshold)).toEqual([
      45, 95, 135, 185, 225, 275, 315, 385, 405,
    ]);
  });

  it('covers the five main barbell lifts and three calisthenics movements', () => {
    const list = evaluateAchievements(input());
    expect(list.filter((a) => a.family === 'lift').map((a) => a.name)).toEqual([
      'Bench Press',
      'Back Squat',
      'Deadlift',
      'Overhead Press',
      'Barbell Row',
    ]);
    expect(list.filter((a) => a.family === 'calisthenics').map((a) => a.name)).toEqual([
      'Pull-Ups',
      'Push-Ups',
      'Dips',
    ]);
  });

  it('never falls back to an emoji for an icon', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const a of evaluateAchievements(input())) {
      expect(a.glyph).toBeTruthy();
      expect(emoji.test(a.glyph)).toBe(false);
      expect(emoji.test(a.name)).toBe(false);
    }
  });
});

describe('earning tiers', () => {
  it('is unearned with no history', () => {
    const bench = byId(evaluateAchievements(input()), 'lift-bench');
    expect(bench.tier).toBeNull();
    expect(bench.earned).toBe(false);
    expect(bench.tiersEarned).toBe(0);
    expect(bench.valueLabel).toBe('—');
  });

  it('awards the highest tier cleared, not just the first', () => {
    const bench = byId(
      evaluateAchievements(
        input({ bestWeightByExercise: { 'barbell bench press': 230 } }),
      ),
      'lift-bench',
    );
    // 230 clears wood/stone/silver/gold/platinum (45..225) but not diamond (275).
    expect(bench.tier).toBe('platinum');
    expect(bench.tiersEarned).toBe(5);
    expect(bench.next?.tier).toBe('diamond');
    expect(bench.next?.threshold).toBe(275);
  });

  it('awards a tier exactly at its threshold', () => {
    const bench = byId(
      evaluateAchievements(
        input({ bestWeightByExercise: { 'barbell bench press': 225 } }),
      ),
      'lift-bench',
    );
    expect(bench.tier).toBe('platinum');
  });

  it('maxes out at legend with no next tier', () => {
    const bench = byId(
      evaluateAchievements(
        input({ bestWeightByExercise: { 'barbell bench press': 500 } }),
      ),
      'lift-bench',
    );
    expect(bench.tier).toBe('legend');
    expect(bench.tiersEarned).toBe(9);
    expect(bench.next).toBeNull();
    expect(bench.progress).toBe(1);
  });

  it('measures progress between the last tier cleared and the next', () => {
    const bench = byId(
      evaluateAchievements(
        input({ bestWeightByExercise: { 'barbell bench press': 155 } }),
      ),
      'lift-bench',
    );
    // Cleared silver (135), climbing to gold (185): 20 of 50.
    expect(bench.tier).toBe('silver');
    expect(bench.progress).toBeCloseTo(20 / 50, 5);
  });
});

describe('calisthenics trophies', () => {
  it('ranks on the most reps in a single set', () => {
    const list = evaluateAchievements(input({ bestRepsByExercise: { 'pull-up': 12 } }));
    const pullups = byId(list, 'cal-pullup');
    expect(pullups.tier).toBe('platinum');
    expect(pullups.valueLabel).toBe('12 reps');
  });

  it('scales push-ups differently from pull-ups', () => {
    const list = evaluateAchievements(
      input({ bestRepsByExercise: { 'pull-up': 10, 'push-up': 10 } }),
    );
    // 10 pull-ups is a real feat; 10 push-ups is early days.
    expect(byId(list, 'cal-pullup').tiersEarned).toBeGreaterThan(
      byId(list, 'cal-pushup').tiersEarned,
    );
  });
});

describe('total volume milestones', () => {
  it('names a real object for every tier', () => {
    const vol = byId(evaluateAchievements(input()), 'total-volume');
    expect(vol.steps.every((s) => !!s.note)).toBe(true);
    expect(vol.steps.map((s) => s.note)).toContain('a semi truck at the legal limit');
  });

  it('uses the US federal semi limit of 80,000 lb', () => {
    const vol = byId(evaluateAchievements(input()), 'total-volume');
    const semi = vol.steps.find((s) => s.note?.includes('semi'));
    expect(semi?.threshold).toBe(80_000);
  });

  it('climbs as lifetime volume grows', () => {
    const at5k = byId(evaluateAchievements(input({ totalVolume: 5_000 })), 'total-volume');
    const at1m = byId(
      evaluateAchievements(input({ totalVolume: 1_000_000 })),
      'total-volume',
    );
    expect(at5k.tier).toBe('silver');
    expect(at1m.tier).toBe('ruby');
  });
});

describe('kilogram lifters', () => {
  it('converts to pounds so the real-world objects stay honest', () => {
    // 100 kg is ~220 lb, which clears the 185 lb gold bench tier but not 225.
    const kg = byId(
      evaluateAchievements(
        input({ unit: 'kg', bestWeightByExercise: { 'barbell bench press': 100 } }),
      ),
      'lift-bench',
    );
    expect(kg.tier).toBe('gold');

    // The same number treated as pounds would only reach stone.
    const lb = byId(
      evaluateAchievements(
        input({ unit: 'lb', bestWeightByExercise: { 'barbell bench press': 100 } }),
      ),
      'lift-bench',
    );
    expect(lb.tier).toBe('stone');
  });

  it('shows thresholds converted back into kilos', () => {
    const kg = byId(evaluateAchievements(input({ unit: 'kg' })), 'lift-bench');
    // The 45 lb bar shown to a kg lifter should read ~20 kg, not 45.
    expect(kg.steps[0].label).toContain('kg');
    expect(Number(kg.steps[0].label.replace(/[^\d.]/g, ''))).toBeCloseTo(45 / LB_PER_KG, 0);
  });

  it('leaves rep-based ladders untouched by unit', () => {
    const a = byId(
      evaluateAchievements(input({ unit: 'kg', bestRepsByExercise: { 'pull-up': 12 } })),
      'cal-pullup',
    );
    const b = byId(
      evaluateAchievements(input({ unit: 'lb', bestRepsByExercise: { 'pull-up': 12 } })),
      'cal-pullup',
    );
    expect(a.tier).toBe(b.tier);
  });
});

describe('collection scoring', () => {
  it('counts trophies at wood or above', () => {
    const list = evaluateAchievements(
      input({ totalWorkouts: 1, bestWeightByExercise: { 'barbell bench press': 135 } }),
    );
    expect(earnedCount(list)).toBe(2);
  });

  it('totals tiers across every trophy', () => {
    const empty = evaluateAchievements(input());
    expect(totalTiersEarned(empty)).toBe(0);
    expect(totalTiersAvailable(empty)).toBe(empty.length * 9);

    const some = evaluateAchievements(
      input({ bestWeightByExercise: { 'barbell bench press': 225 } }),
    );
    expect(totalTiersEarned(some)).toBe(5);
  });

  it('ranks the best trophies first for a profile strip', () => {
    const list = evaluateAchievements(
      input({
        totalWorkouts: 1,
        bestWeightByExercise: { 'barbell bench press': 405 },
      }),
    );
    const top = topAchievements(list, 3);
    expect(top[0].id).toBe('lift-bench');
    expect(top.every((a) => a.earned)).toBe(true);
    expect(top.length).toBeLessThanOrEqual(3);
  });

  it('returns nothing to show when nothing is earned', () => {
    expect(topAchievements(evaluateAchievements(input()))).toEqual([]);
  });
});

describe('consistency', () => {
  it('is the share of recent days with a workout', () => {
    const dates = ['2026-09-06', '2026-09-05', '2026-09-04'];
    expect(consistency(dates, '2026-09-06', 30)).toBeCloseTo(3 / 30, 5);
  });

  it('ignores days outside the window', () => {
    expect(consistency(['2026-01-01'], '2026-09-06', 30)).toBe(0);
  });

  it('is zero for a nonsensical window', () => {
    expect(consistency(['2026-09-06'], '2026-09-06', 0)).toBe(0);
  });
});
