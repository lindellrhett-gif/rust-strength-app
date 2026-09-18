import {
  MAX_REP_JUMP,
  recommendAssisted,
  recommendNextWeight,
  recommendReps,
  type LoggedSet,
  type RepSet,
} from '../src/domain/recommender';

const day = (n: number) => new Date(2026, 8, n).toISOString();

function set(weight: number, reps: number, rpe: number | null, n: number): LoggedSet {
  return { weight, reps, rpe, isWarmup: false, machineId: null, performedAt: day(n) };
}

describe('recommendAssisted', () => {
  // 180 lb lifter using 40 lb of assistance: the load moved is 140.
  const history = [set(140, 8, 8, 1), set(140, 8, 8, 3), set(140, 8, 8, 5)];
  const input = {
    history,
    bodyWeight: 180,
    targetRepLow: 6,
    targetRepHigh: 8,
    increment: 5,
    currentMachineId: null,
  };

  it('suggests assistance, not load, and they add up to bodyweight', () => {
    const r = recommendAssisted(input);
    expect(r.suggestedAssist).not.toBeNull();
    expect(r.suggestedWeight).toBeCloseTo(180 - (r.suggestedAssist ?? 0), 5);
  });

  it('lands on a real step of the machine', () => {
    const r = recommendAssisted(input);
    expect((r.suggestedAssist ?? 0) % 5).toBe(0);
  });

  it('matches the weighted recommender on the load actually moved', () => {
    const weighted = recommendNextWeight(input);
    const assisted = recommendAssisted(input);
    // Same target load, rounded on the assistance side instead.
    expect(Math.abs((assisted.suggestedWeight ?? 0) - (weighted.suggestedWeight ?? 0))).toBeLessThanOrEqual(5);
  });

  it('asks for less assistance when the last set felt easy', () => {
    const easy = recommendAssisted({ ...input, history: [...history, set(140, 8, 6, 7)] });
    const hard = recommendAssisted({ ...input, history: [...history, set(140, 6, 10, 7)] });
    expect(easy.suggestedAssist!).toBeLessThan(hard.suggestedAssist!);
  });

  it('rounds toward more assistance on the first working set', () => {
    const first = recommendAssisted({ ...input, increment: 10, isFirstWorkingSet: true });
    const later = recommendAssisted({ ...input, increment: 10, isFirstWorkingSet: false });
    expect(first.suggestedAssist!).toBeGreaterThanOrEqual(later.suggestedAssist!);
  });

  it('suggests no assistance, and says so, once the user outgrows it', () => {
    const strong = [set(180, 8, 6, 1), set(180, 9, 6, 2), set(180, 10, 6, 3)];
    const r = recommendAssisted({ ...input, history: strong });
    expect(r.suggestedAssist).toBe(0);
    expect(r.rationale).toMatch(/no assistance/);
  });

  it('never suggests more assistance than bodyweight', () => {
    const weak = [set(10, 3, 10, 1)];
    const r = recommendAssisted({ ...input, history: weak });
    expect(r.suggestedAssist!).toBeLessThanOrEqual(180);
  });

  it('asks for bodyweight rather than guessing without it', () => {
    const r = recommendAssisted({ ...input, bodyWeight: 0 });
    expect(r.suggestedAssist).toBeNull();
    expect(r.rationale).toMatch(/bodyweight/i);
  });

  it('waits for history before suggesting', () => {
    const r = recommendAssisted({ ...input, history: [] });
    expect(r.suggestedAssist).toBeNull();
    expect(r.rationale).toMatch(/first working set/);
  });
});

describe('recommendReps', () => {
  function reps(n: number, rpe: number | null, d: number, addedWeight: number | null = null): RepSet {
    return { reps: n, rpe, isWarmup: false, addedWeight, performedAt: day(d) };
  }

  it('asks for more reps when there were reps left in the tank', () => {
    const r = recommendReps({ history: [reps(10, 7, 1), reps(10, 7, 3)], addedWeight: 0 });
    expect(r.suggestedReps!).toBeGreaterThan(10);
  });

  it('asks to match a set that went to failure', () => {
    const r = recommendReps({ history: [reps(10, 10, 1), reps(10, 10, 3)], addedWeight: 0 });
    expect(r.suggestedReps).toBe(10);
  });

  it('weights the newest set most', () => {
    const r = recommendReps({ history: [reps(6, 10, 1), reps(12, 10, 5)], addedWeight: 0 });
    expect(r.suggestedReps!).toBeGreaterThanOrEqual(8);
    expect(r.suggestedReps!).toBeLessThanOrEqual(12);
  });

  it('never jumps more than a few reps past the last set', () => {
    const r = recommendReps({ history: [reps(3, 5, 1)], addedWeight: 0 });
    expect(r.suggestedReps!).toBeLessThanOrEqual(3 + MAX_REP_JUMP);
  });

  it('counts only sets at the added weight about to be used', () => {
    const history = [reps(15, 10, 1, 0), reps(5, 10, 2, 45)];
    expect(recommendReps({ history, addedWeight: 0 }).suggestedReps).toBe(15);
    expect(recommendReps({ history, addedWeight: 45 }).suggestedReps).toBe(5);
  });

  it('explains when there is history, but none at this added weight', () => {
    const r = recommendReps({ history: [reps(12, 9, 1, 0)], addedWeight: 25 });
    expect(r.suggestedReps).toBeNull();
    expect(r.rationale).toMatch(/added weight/);
  });

  it('ignores warmups', () => {
    const history: RepSet[] = [
      { ...reps(20, null, 1), isWarmup: true },
      reps(8, 10, 2),
    ];
    expect(recommendReps({ history, addedWeight: 0 }).suggestedReps).toBe(8);
  });

  it('waits for a first set', () => {
    const r = recommendReps({ history: [], addedWeight: 0 });
    expect(r.suggestedReps).toBeNull();
    expect(r.estimatedMaxReps).toBeNull();
  });
});
