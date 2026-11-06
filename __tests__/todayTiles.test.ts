import { calorieBudget } from '@/domain/nutrition/totals';
import {
  DEFAULT_STEP_GOAL,
  STEP_GOAL_MAX,
  STEP_GOAL_MIN,
  calorieTile,
  cleanStepGoal,
  consistencyPercent,
  stepGoalShort,
  stepProgress,
} from '@/domain/todayTiles';

describe('cleanStepGoal', () => {
  it('starts at 10,000 when nothing is saved', () => {
    expect(cleanStepGoal(null)).toBe(DEFAULT_STEP_GOAL);
    expect(cleanStepGoal('')).toBe(DEFAULT_STEP_GOAL);
    expect(cleanStepGoal('lots')).toBe(DEFAULT_STEP_GOAL);
  });

  it('reads a saved goal back', () => {
    expect(cleanStepGoal('8000')).toBe(8000);
    expect(cleanStepGoal(12_500)).toBe(12_500);
  });

  it('keeps to steps of 500 within range', () => {
    expect(cleanStepGoal(7_740)).toBe(7_500);
    expect(cleanStepGoal(200)).toBe(STEP_GOAL_MIN);
    expect(cleanStepGoal(1_000_000)).toBe(STEP_GOAL_MAX);
  });
});

describe('stepGoalShort', () => {
  it('writes the goal in thousands', () => {
    expect(stepGoalShort(10_000)).toBe('10k');
    expect(stepGoalShort(7_500)).toBe('7.5k');
    expect(stepGoalShort(12_000)).toBe('12k');
  });
});

describe('stepProgress', () => {
  it('is the share of the goal walked, never past full', () => {
    expect(stepProgress(6_240, 10_000)).toBeCloseTo(0.624, 5);
    expect(stepProgress(14_000, 10_000)).toBe(1);
    expect(stepProgress(0, 10_000)).toBe(0);
    expect(stepProgress(500, 0)).toBe(0);
  });
});

describe('consistencyPercent', () => {
  it('rounds to a whole percentage', () => {
    expect(consistencyPercent(26 / 30)).toBe('87%');
    expect(consistencyPercent(0)).toBe('0%');
    expect(consistencyPercent(1)).toBe('100%');
    expect(consistencyPercent(NaN)).toBe('0%');
  });
});

describe('calorieTile', () => {
  it("shows what's left of the goal, as the diary does", () => {
    expect(calorieTile(calorieBudget(2400, 1160, 0, true), 'kcal')).toEqual({
      value: '1,240',
      label: 'kcal left today',
      over: false,
    });
  });

  it('counts exercise when that setting is on', () => {
    expect(calorieTile(calorieBudget(2000, 1500, 300, true), 'kcal').value).toBe('800');
    expect(calorieTile(calorieBudget(2000, 1500, 300, false), 'kcal').value).toBe('500');
  });

  it('says how far over once past the goal', () => {
    expect(calorieTile(calorieBudget(2000, 2150, 0, true), 'kcal')).toEqual({
      value: '150',
      label: 'kcal over today',
      over: true,
    });
  });

  it("shows what was eaten when there's no goal", () => {
    expect(calorieTile(calorieBudget(null, 1860, 0, true), 'kcal')).toEqual({
      value: '1,860',
      label: 'kcal eaten today',
      over: false,
    });
  });

  it('uses kilojoules when the diary does', () => {
    expect(calorieTile(calorieBudget(2000, 1000, 0, true), 'kj').label).toBe('kJ left today');
  });
});
