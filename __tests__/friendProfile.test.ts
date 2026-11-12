import { evaluateAchievements, type AchievementInput } from '@/domain/achievements';
import { friendDataUnit, friendVolume } from '@/domain/friendProfile';
import { convertVolume } from '@/domain/leaderboard';
import { computeXp, levelProgress } from '@/domain/xp';
import { compact } from '@/lib/format';

type Unit = 'lb' | 'kg';

const BENCH = 'barbell bench press';
const PRESS = 'overhead press';

/** A lifter's own numbers, in `unit`, as their phone hands them to the trophies. */
const lifter = (unit: Unit, over: Partial<AchievementInput> = {}): AchievementInput => ({
  totalWorkouts: 0,
  totalVolume: 0,
  totalReps: 0,
  totalSets: 0,
  totalSeconds: 0,
  currentStreak: 0,
  bestStreak: 0,
  groupsThisWeek: 0,
  groupsTotal: 0,
  bestWeightByExercise: {},
  bestRepsByExercise: {},
  unit,
  activitySeconds: 0,
  activityCount: 0,
  activityKinds: 0,
  runDistanceM: 0,
  stepsTotal: 0,
  friendCount: 0,
  reactionsReceived: 0,
  ...over,
});

const tierOf = (input: AchievementInput, id: string) =>
  evaluateAchievements(input).find((a) => a.id === id)!.tier;

/** Their numbers, scored the way the friend profile scores them for this viewer. */
const asSeenBy = (viewer: Unit, input: AchievementInput): AchievementInput => ({
  ...input,
  unit: friendDataUnit(input.unit, viewer),
});

describe('the unit a friend’s numbers are in', () => {
  it('is theirs, whatever the viewer uses', () => {
    expect(friendDataUnit('kg', 'lb')).toBe('kg');
    expect(friendDataUnit('lb', 'kg')).toBe('lb');
    expect(friendDataUnit('kg', 'kg')).toBe('kg');
  });

  it('reads as the viewer’s until migration 0036 is applied', () => {
    expect(friendDataUnit(null, 'kg')).toBe('kg');
    expect(friendDataUnit(undefined, 'lb')).toBe('lb');
  });
});

describe('a friend’s total on screen', () => {
  it('turns a kg lifter’s total into pounds for an lb viewer', () => {
    expect(friendVolume(8_000, 'kg', 'lb')).toBeCloseTo(17_636.96, 2);
    expect(compact(friendVolume(8_000, 'kg', 'lb'))).toBe('18k');
  });

  it('turns an lb lifter’s total into kilos for a kg viewer', () => {
    expect(friendVolume(17_636.96, 'lb', 'kg')).toBeCloseTo(8_000, 6);
  });

  it('leaves it exactly alone when you both use the same unit', () => {
    expect(friendVolume(8_000.5, 'kg', 'kg')).toBe(8_000.5);
    expect(friendVolume(8_000.5, 'lb', 'lb')).toBe(8_000.5);
  });

  it('shows the same figure as their phone would, in the viewer’s unit', () => {
    // 22,000 kg on the lifter's own phone; a kg friend reads the same.
    expect(compact(friendVolume(22_000, 'kg', 'kg'))).toBe(compact(22_000));
  });

  it('leaves it unconverted until migration 0036 is applied', () => {
    expect(friendVolume(8_000, null, 'lb')).toBe(8_000);
    expect(friendVolume(8_000, undefined, 'kg')).toBe(8_000);
  });

  it('copes with nothing lifted yet', () => {
    expect(friendVolume(0, 'kg', 'lb')).toBe(0);
  });
});

describe('a friend’s trophies match the ones on their own phone', () => {
  it('a 102.5 kg bench is 226 lb, whoever is looking', () => {
    const kira = lifter('kg', { bestWeightByExercise: { [BENCH]: 102.5 } });
    expect(tierOf(kira, 'lift-bench')).toBe('platinum');
    expect(tierOf(asSeenBy('lb', kira), 'lift-bench')).toBe('platinum');
    expect(tierOf(asSeenBy('kg', kira), 'lift-bench')).toBe('platinum');
    // What an lb viewer used to be told: 102.5 read as pounds.
    expect(tierOf({ ...kira, unit: 'lb' }, 'lift-bench')).toBe('stone');
  });

  it('a 225 lb bench stays 225 lb for a kg viewer', () => {
    const liam = lifter('lb', { bestWeightByExercise: { [BENCH]: 225 } });
    expect(tierOf(asSeenBy('kg', liam), 'lift-bench')).toBe('platinum');
    // What a kg viewer used to be told: 225 read as kilos.
    expect(tierOf({ ...liam, unit: 'kg' }, 'lift-bench')).toBe('legend');
  });

  it('a lifetime total counts by what it weighs, in either unit', () => {
    const kira = lifter('kg', { totalVolume: 8_000 }); // 17,637 lb
    expect(tierOf(kira, 'total-volume')).toBe('gold');
    expect(tierOf(asSeenBy('lb', kira), 'total-volume')).toBe('gold');
    expect(tierOf({ ...kira, unit: 'lb' }, 'total-volume')).toBe('silver');
  });

  it('every trophy agrees, for each pair of units', () => {
    const numbers = {
      totalVolume: 60_000,
      bestWeightByExercise: { [BENCH]: 140, [PRESS]: 70 },
      bestRepsByExercise: { 'pull-up': 12 },
      runDistanceM: 42_195,
      friendCount: 3,
    };
    for (const friend of ['lb', 'kg'] as const) {
      for (const viewer of ['lb', 'kg'] as const) {
        const own = lifter(friend, numbers);
        const seen = evaluateAchievements(asSeenBy(viewer, own));
        expect(seen.map((a) => [a.id, a.tier])).toEqual(
          evaluateAchievements(own).map((a) => [a.id, a.tier]),
        );
      }
    }
  });

  it('a lift exactly on a tier’s line keeps the tier', () => {
    // 155 lb is a line on the press ladder, and a trip through kilos lands just
    // under it. This is why trophies are scored in the friend's unit, not ours.
    const roundTrip = convertVolume(convertVolume(155, 'lb', 'kg'), 'kg', 'lb');
    expect(roundTrip).toBeLessThan(155);

    const exact = lifter('lb', { bestWeightByExercise: { [PRESS]: 155 } });
    const below = lifter('lb', { bestWeightByExercise: { [PRESS]: roundTrip } });
    expect(tierOf(exact, 'lift-press')).toBe('diamond');
    expect(tierOf(asSeenBy('kg', exact), 'lift-press')).toBe('diamond');
    expect(tierOf(below, 'lift-press')).toBe('platinum');
  });
});

describe('a friend’s level matches the one on their own phone', () => {
  const numbers = {
    totalWorkouts: 40,
    totalSets: 600,
    totalVolume: 80_000,
    totalActivities: 5,
    bestStreak: 10,
    friendCount: 3,
    trophyTiers: 12,
    strengthScore: 900,
  };
  const scored = (unit: Unit) => computeXp({ ...numbers, unit });

  it('counts a kg lifter’s work in pounds for any viewer', () => {
    const own = scored('kg');
    expect(scored(friendDataUnit('kg', 'lb')).total).toBe(own.total);
    expect(scored(friendDataUnit('kg', 'kg')).total).toBe(own.total);
    expect(own.sources.find((s) => s.id === 'volume')!.xp).toBe(882); // 176,370 lb
    expect(own.sources.find((s) => s.id === 'records')!.xp).toBe(992); // 1,984 lb
  });

  it('would read low for an lb viewer without it, by whole levels', () => {
    const own = levelProgress(scored('kg').total).level;
    const unconverted = levelProgress(scored('lb').total).level;
    expect(unconverted).toBeLessThan(own);
    expect(levelProgress(scored(friendDataUnit('kg', 'lb')).total).level).toBe(own);
  });
});
