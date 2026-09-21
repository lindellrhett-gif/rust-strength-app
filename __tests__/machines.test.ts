import {
  MAX_PAIRS,
  PAIR_WINDOW_DAYS,
  historyForMachine,
  learnRatio,
  type MachineSet,
} from '../src/domain/machines';
import { recommendNextWeight, type LoggedSet } from '../src/domain/recommender';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 1);

let n = 0;
function ms(machineId: string, weight: number, reps: number, day: number, exerciseId = 'row'): MachineSet {
  n += 1;
  return {
    exerciseId,
    workoutId: `w-${machineId}-${day}-${exerciseId}`,
    machineId,
    weight,
    reps,
    rpe: 10,
    performedAt: T0 + day * DAY + n,
  };
}
const asLogged = (s: MachineSet): LoggedSet => ({
  weight: s.weight,
  reps: s.reps,
  rpe: s.rpe,
  isWarmup: false,
  machineId: s.machineId,
  performedAt: s.performedAt,
});

describe('learnRatio', () => {
  it('learns that one cable stack reads double the other', () => {
    const sets = [ms('cable1', 50, 8, 0), ms('cable2', 100, 8, 3)];
    expect(learnRatio(sets, 'cable1', 'cable2')).toEqual({ ratio: 2, pairs: 1 });
    expect(learnRatio(sets, 'cable2', 'cable1')).toEqual({ ratio: 0.5, pairs: 1 });
  });

  it('knows nothing until both machines have been used close together', () => {
    expect(learnRatio([ms('cable1', 50, 8, 0)], 'cable1', 'cable2')).toBeNull();
    const farApart = [ms('cable1', 50, 8, 0), ms('cable2', 100, 8, PAIR_WINDOW_DAYS + 5)];
    expect(learnRatio(farApart, 'cable1', 'cable2')).toBeNull();
  });

  it('only compares the same exercise, but pools pairs across exercises', () => {
    const sets = [
      ms('cable1', 50, 8, 0, 'row'),
      ms('cable2', 100, 8, 1, 'curl'), // different exercise: no pair
    ];
    expect(learnRatio(sets, 'cable1', 'cable2')).toBeNull();
    const pooled = [...sets, ms('cable1', 20, 10, 2, 'curl'), ms('cable2', 60, 8, 2, 'row')];
    const r = learnRatio(pooled, 'cable1', 'cable2')!;
    expect(r.pairs).toBe(2);
    expect(r.ratio).toBeGreaterThan(1.1);
  });

  it('uses the median, so one odd session does not move it', () => {
    const sets = [
      ms('a', 50, 8, 0), ms('b', 100, 8, 0),
      ms('a', 50, 8, 7), ms('b', 100, 8, 7),
      ms('a', 50, 8, 14), ms('b', 240, 8, 14), // mistyped
    ];
    expect(learnRatio(sets, 'a', 'b')!.ratio).toBe(2);
  });

  it('ignores impossible ratios as logging mistakes', () => {
    expect(learnRatio([ms('a', 10, 8, 0), ms('b', 500, 8, 0)], 'a', 'b')).toBeNull();
  });

  it('keeps only the most recent comparisons', () => {
    const sets: MachineSet[] = [];
    for (let d = 0; d < 20; d += 1) sets.push(ms('a', 50, 8, d * 3), ms('b', d < 10 ? 150 : 100, 8, d * 3));
    const r = learnRatio(sets, 'a', 'b')!;
    expect(r.pairs).toBe(MAX_PAIRS);
    expect(r.ratio).toBe(2); // the older 3x readings have aged out
  });
});

describe('historyForMachine', () => {
  it('carries a record on one machine over to the other (the 60 → 120 case)', () => {
    const machineSets = [
      ms('cable1', 50, 8, 0),
      ms('cable2', 100, 8, 2),
      ms('cable1', 60, 8, 10), // new best on machine 1
    ];
    const history = machineSets.map(asLogged);
    const converted = historyForMachine(history, 'cable2', machineSets);
    // Only the day-0 and day-2 sessions are compared: the later record is
    // progress, not a difference between the machines.
    expect(converted.conversions).toEqual([{ machineId: 'cable1', ratio: 2, pairs: 1 }]);

    // The record itself is carried over at double: 60 on machine 1 is 120 here.
    const newest = [...converted.history].sort(
      (a, b) => Number(b.performedAt) - Number(a.performedAt),
    )[0];
    expect(newest.weight).toBe(120);

    const rec = recommendNextWeight({
      history: converted.history,
      targetRepLow: 6,
      targetRepHigh: 8,
      increment: 5,
      currentMachineId: 'cable2',
    });
    // And the suggestion is exactly what machine 1 would get, doubled: the
    // same smoothing over recent sets applies on either machine.
    const onMachine1 = recommendNextWeight({
      history: historyForMachine(history, 'cable1', machineSets).history,
      targetRepLow: 6,
      targetRepHigh: 8,
      increment: 2.5,
      currentMachineId: 'cable1',
    });
    expect(rec.e1rm).toBeCloseTo(onMachine1.e1rm! * 2, 0);
    expect(rec.suggestedWeight).toBeGreaterThan(100);
    // Converted sets count as this machine, so no "different machine" warning.
    expect(rec.rationale).not.toMatch(/different machine/);
  });

  it('keeps machines separate until a conversion is learned', () => {
    const machineSets = [ms('cable1', 50, 8, 0)];
    const converted = historyForMachine(machineSets.map(asLogged), 'cable2', machineSets);
    expect(converted.history).toHaveLength(0);
    expect(converted.unmatched).toEqual(['cable1']);
  });

  it('uses a machine’s own sets as they are', () => {
    const machineSets = [ms('cable2', 100, 8, 0), ms('cable1', 50, 8, 40)];
    const converted = historyForMachine(machineSets.map(asLogged), 'cable2', machineSets);
    expect(converted.history.map((s) => s.weight)).toEqual([100]);
    expect(converted.unmatched).toEqual(['cable1']);
  });

  it('falls back to sets with no machine recorded when nothing else applies', () => {
    const old: LoggedSet = {
      weight: 80, reps: 8, rpe: 9, isWarmup: false, machineId: null, performedAt: T0,
    };
    const converted = historyForMachine([old], 'cable1', []);
    expect(converted.usedUnrecorded).toBe(true);
    expect(converted.history).toEqual([old]);
  });

  it('with no machine chosen, uses the sets that had none', () => {
    const free: LoggedSet = { weight: 40, reps: 10, rpe: 8, isWarmup: false, machineId: null, performedAt: T0 };
    const onStack = asLogged(ms('cable1', 90, 8, 1));
    expect(historyForMachine([free, onStack], null, []).history).toEqual([free]);
  });
});

describe('preset rep ranges', () => {
  const history: LoggedSet[] = [
    { weight: 200, reps: 8, rpe: 9, isWarmup: false, machineId: null, performedAt: T0 },
  ];
  const suggest = (low: number, high: number) =>
    recommendNextWeight({ history, targetRepLow: low, targetRepHigh: high, increment: 5, currentMachineId: null })
      .suggestedWeight!;

  it('suggests a lighter weight for a higher rep range', () => {
    expect(suggest(10, 15)).toBeLessThan(suggest(6, 8));
    expect(suggest(10, 15)).toBeLessThan(200);
  });

  it('suggests the same weight back for the reps a set actually did', () => {
    const at12: LoggedSet[] = [
      { weight: 100, reps: 12, rpe: 10, isWarmup: false, machineId: null, performedAt: T0 },
    ];
    const rec = recommendNextWeight({
      history: at12, targetRepLow: 12, targetRepHigh: 12, increment: 5, currentMachineId: null,
    });
    expect(rec.suggestedWeight).toBe(100);
  });
});
