import {
  epleyE1rm,
  repsInReserve,
  e1rmFromSet,
  estimateE1rm,
  repRangeOrDefault,
  recommendNextWeight,
  MAX_STEP_CHANGE,
  type LoggedSet,
} from '@/domain/recommender';

function set(partial: Partial<LoggedSet> & Pick<LoggedSet, 'weight' | 'reps'>): LoggedSet {
  return {
    rpe: null,
    isWarmup: false,
    machineId: 'm1',
    performedAt: '2026-09-01T10:00:00.000Z',
    ...partial,
  };
}

describe('epleyE1rm', () => {
  it('matches the Epley formula', () => {
    expect(epleyE1rm(135, 8)).toBeCloseTo(135 * (1 + 8 / 30), 4);
    expect(epleyE1rm(225, 5)).toBeCloseTo(225 * (1 + 5 / 30), 4);
  });

  it('returns the weight itself for a true single', () => {
    expect(epleyE1rm(200, 1)).toBe(200);
  });

  it('caps effective reps so high-rep sets do not explode', () => {
    expect(epleyE1rm(100, 30)).toBe(epleyE1rm(100, 12));
  });

  it('is zero for nonsense input', () => {
    expect(epleyE1rm(0, 5)).toBe(0);
    expect(epleyE1rm(100, 0)).toBe(0);
  });
});

describe('repsInReserve', () => {
  it('maps RPE to reps left in the tank', () => {
    expect(repsInReserve(10)).toBe(0);
    expect(repsInReserve(8)).toBe(2);
    expect(repsInReserve(7.5)).toBe(2.5);
  });

  it('assumes failure when RPE is missing', () => {
    expect(repsInReserve(null)).toBe(0);
  });

  it('clamps absurd RPE values', () => {
    expect(repsInReserve(2)).toBe(5);
    expect(repsInReserve(11)).toBe(0);
  });
});

describe('e1rmFromSet', () => {
  it('adds reps-in-reserve before estimating', () => {
    // 135 x 8 @ RPE 7 -> 3 in reserve -> effective 11 reps
    expect(e1rmFromSet({ weight: 135, reps: 8, rpe: 7 })).toBeCloseTo(
      135 * (1 + 11 / 30),
      4,
    );
  });

  it('treats a missing RPE as taken to failure', () => {
    expect(e1rmFromSet({ weight: 135, reps: 8, rpe: null })).toBeCloseTo(
      epleyE1rm(135, 8),
      4,
    );
  });
});

describe('estimateE1rm', () => {
  it('is empty when there is no working history', () => {
    expect(estimateE1rm([]).count).toBe(0);
    expect(estimateE1rm([set({ weight: 45, reps: 10, isWarmup: true })]).count).toBe(0);
  });

  it('weights the most recent set the most', () => {
    const history: LoggedSet[] = [
      set({ weight: 100, reps: 8, rpe: 8, performedAt: '2026-09-01T10:00:00Z' }),
      set({ weight: 150, reps: 8, rpe: 8, performedAt: '2026-09-03T10:00:00Z' }),
    ];
    const est = estimateE1rm(history);
    const older = e1rmFromSet({ weight: 100, reps: 8, rpe: 8 });
    const newer = e1rmFromSet({ weight: 150, reps: 8, rpe: 8 });
    expect(est.value).toBeGreaterThan(older);
    expect(est.value).toBeLessThan(newer);
    // EMA with alpha 0.3 seeded on the older value.
    expect(est.value).toBeCloseTo(0.3 * newer + 0.7 * older, 4);
  });

  it('ignores set order in the input array', () => {
    const a = set({ weight: 150, reps: 8, performedAt: '2026-09-03T10:00:00Z' });
    const b = set({ weight: 100, reps: 8, performedAt: '2026-09-01T10:00:00Z' });
    expect(estimateE1rm([a, b]).value).toBeCloseTo(estimateE1rm([b, a]).value, 6);
  });
});

describe('repRangeOrDefault', () => {
  it('passes through a valid range', () => {
    expect(repRangeOrDefault(6, 8)).toEqual([6, 8]);
    expect(repRangeOrDefault(10, 12)).toEqual([10, 12]);
  });

  it('falls back to 6-8 for a nonsensical range', () => {
    expect(repRangeOrDefault(8, 6)).toEqual([6, 8]);
    expect(repRangeOrDefault(0, 5)).toEqual([6, 8]);
    expect(repRangeOrDefault(NaN, 8)).toEqual([6, 8]);
  });
});

describe('recommendNextWeight', () => {
  const base = {
    targetRepLow: 6,
    targetRepHigh: 8,
    increment: 5,
    currentMachineId: 'm1',
  };

  it('has no suggestion without history', () => {
    const rec = recommendNextWeight({ ...base, history: [] });
    expect(rec.suggestedWeight).toBeNull();
    expect(rec.e1rm).toBeNull();
    expect(rec.confidence).toBe('low');
  });

  it('suggests a concrete, on-increment weight from one set', () => {
    const rec = recommendNextWeight({
      ...base,
      history: [set({ weight: 135, reps: 8, rpe: 7 })],
    });
    expect(rec.suggestedWeight).not.toBeNull();
    expect(rec.suggestedWeight! % 5).toBe(0);
    expect(rec.e1rm).toBeGreaterThan(135);
    expect(rec.repRange).toEqual([6, 8]);
  });

  it('goes heavier when the last set was well below target RPE', () => {
    const easy = recommendNextWeight({
      ...base,
      history: [set({ weight: 135, reps: 8, rpe: 6 })],
    });
    const hard = recommendNextWeight({
      ...base,
      history: [set({ weight: 135, reps: 8, rpe: 9 })],
    });
    expect(easy.suggestedWeight!).toBeGreaterThanOrEqual(hard.suggestedWeight!);
    expect(easy.rationale).toMatch(/easier/);
  });

  it('goes lighter when the last set was maxed out and missed the rep range', () => {
    const rec = recommendNextWeight({
      ...base,
      history: [
        set({ weight: 200, reps: 4, rpe: 10, performedAt: '2026-09-01T10:00:00Z' }),
        set({ weight: 185, reps: 4, rpe: 10, performedAt: '2026-09-03T10:00:00Z' }),
      ],
    });
    expect(rec.suggestedWeight!).toBeLessThan(185);
    expect(rec.rationale).toMatch(/harder/);
  });

  it('never jumps more than the step-change cap from the last set', () => {
    const last = 100;
    const rec = recommendNextWeight({
      ...base,
      increment: 1,
      // Absurdly strong single to force the cap.
      history: [set({ weight: last, reps: 1, rpe: 5 })],
    });
    expect(rec.suggestedWeight!).toBeLessThanOrEqual(last * (1 + MAX_STEP_CHANGE) + 1e-9);
    expect(rec.suggestedWeight!).toBeGreaterThanOrEqual(last * (1 - MAX_STEP_CHANGE) - 1e-9);
  });

  it('rounds the first working set down, not up', () => {
    const history = [set({ weight: 135, reps: 8, rpe: 6 })];
    const first = recommendNextWeight({ ...base, history, isFirstWorkingSet: true });
    const later = recommendNextWeight({ ...base, history, isFirstWorkingSet: false });
    expect(first.suggestedWeight!).toBeLessThanOrEqual(later.suggestedWeight!);
  });

  it('flags a machine change in the rationale', () => {
    const rec = recommendNextWeight({
      ...base,
      currentMachineId: 'm2',
      history: [set({ weight: 135, reps: 8, rpe: 8, machineId: 'm1' })],
    });
    expect(rec.rationale).toMatch(/different machine/);
  });

  it('reports higher confidence with more sets', () => {
    const mk = (n: number): LoggedSet[] =>
      Array.from({ length: n }, (_, i) =>
        set({
          weight: 135,
          reps: 8,
          rpe: 8,
          performedAt: `2026-09-0${i + 1}T10:00:00Z`,
        }),
      );
    expect(recommendNextWeight({ ...base, history: mk(1) }).confidence).toBe('low');
    expect(recommendNextWeight({ ...base, history: mk(3) }).confidence).toBe('medium');
    expect(recommendNextWeight({ ...base, history: mk(5) }).confidence).toBe('high');
  });
});
