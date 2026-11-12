import {
  feetInches,
  formatWater,
  formatWeight,
  formatWeightChange,
  parseHeight,
  parseWater,
  parseWeight,
  waterButtons,
  weeklyRate,
  weightIn,
  weightTrend,
} from '../src/domain/nutrition/body';
import type { DiaryEntry } from '../src/domain/nutrition/entries';
import {
  draftFor,
  evaluateGoal,
  evenSplit,
  MIN_GOAL_KCAL,
  RATE_OPTIONS,
  type GoalContext,
  type GoalDraft,
} from '../src/domain/nutrition/goalForm';
import { calorieGoal } from '../src/domain/nutrition/goals';
import { emptyNutrients, type Nutrients } from '../src/domain/nutrition/nutrients';
import { rangeStart, reportDays, reportSummary, reportWeeks } from '../src/domain/nutrition/reports';
import { DEFAULT_NUTRITION_SETTINGS, ML_PER_CUP, type NutritionSettings, type WeighIn } from '../src/domain/nutrition/settings';
import { DAILY_VALUES, LIMIT_KEYS, nutrientRows, TARGET_KEYS } from '../src/domain/nutrition/targets';
import type { NutritionGoal } from '../src/domain/nutrition/totals';

const n = (over: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...over });
const TODAY = '2026-10-29';

describe('body units', () => {
  it('shows weight in the profile unit and stores kilograms', () => {
    expect(weightIn(82.74, 'lb')).toBe(182.4);
    expect(formatWeight(82.74, 'kg')).toBe('82.7 kg');
    expect(parseWeight('182.4', 'lb')).toBeCloseTo(82.736, 2);
    expect(parseWeight('82,5', 'kg')).toBe(82.5);
    expect(parseWeight('12', 'kg')).toBeNull();
    expect(parseWeight('heavy', 'lb')).toBeNull();
    expect(formatWeightChange(-0.45, 'lb')).toBe('−1 lb');
    expect(formatWeightChange(0.01, 'kg')).toBe('0 kg');
  });

  it('reads height in centimetres or feet and inches', () => {
    expect(parseHeight({ cm: '178' })).toBe(178);
    expect(parseHeight({ feet: '5', inches: '10' })).toBe(177.8);
    expect(parseHeight({ feet: '6', inches: '' })).toBe(182.9);
    expect(parseHeight({ feet: '5', inches: '13' })).toBeNull();
    expect(parseHeight({ cm: '20' })).toBeNull();
    expect(feetInches(177.8)).toEqual({ feet: 5, inches: 10 });
  });

  it('uses label cups and fluid ounces for water, so a cup is 8 fl oz', () => {
    expect(formatWater(ML_PER_CUP, 'lb')).toBe('8 fl oz');
    expect(formatWater(2000, 'kg')).toBe('2,000 ml');
    expect(parseWater('64', 'lb')).toBe(1920);
    expect(parseWater('0', 'kg')).toBeNull();
    expect(waterButtons('lb').map((b) => b.ml)).toEqual([240, 480]);
    expect(waterButtons('kg').map((b) => b.label)).toEqual(['250 ml', '500 ml']);
  });
});

describe('weight trend', () => {
  const w = (measuredOn: string, kg: number): WeighIn => ({ id: measuredOn, measuredOn, kg });

  it('smooths the day-to-day swings', () => {
    const trend = weightTrend([w('2026-10-02', 81), w('2026-10-01', 80), w('2026-10-03', 79)]);
    expect(trend.map((t) => t.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(trend[0].trendKg).toBe(80);
    expect(trend[1].trendKg).toBeCloseTo(80.1, 3);
    expect(trend[2].trendKg).toBeCloseTo(79.99, 2);
  });

  it('counts a gap as several days of smoothing', () => {
    const daily = weightTrend([w('2026-10-01', 80), w('2026-10-02', 78)]);
    const week = weightTrend([w('2026-10-01', 80), w('2026-10-08', 78)]);
    expect(Math.abs(week[1].trendKg - 78)).toBeLessThan(Math.abs(daily[1].trendKg - 78));
  });

  it('gives a weekly rate only from enough weigh-ins over at least a week', () => {
    const losing = Array.from({ length: 15 }, (_, i) => w(`2026-10-${String(15 + i).padStart(2, '0')}`, 90 - i * 0.1));
    expect(weeklyRate(losing, TODAY)).toBeCloseTo(-0.7, 3);
    expect(weeklyRate(losing.slice(0, 2), TODAY)).toBeNull();
    expect(weeklyRate([w('2026-10-27', 80), w('2026-10-28', 79), w('2026-10-29', 81)], TODAY)).toBeNull();
    // Weigh-ins older than four weeks don't count.
    expect(weeklyRate([w('2026-09-01', 70), w('2026-09-10', 71), w('2026-09-20', 72)], TODAY)).toBeNull();
  });
});

describe('nutrient targets', () => {
  it('uses the FDA Daily Values and reads limits as limits', () => {
    expect(DAILY_VALUES).toMatchObject({ sodiumMg: 2300, fiberG: 28, addedSugarsG: 50, satFatG: 20, potassiumMg: 4700 });
    expect(DAILY_VALUES).not.toHaveProperty('transFatG');
    for (const key of Object.keys(DAILY_VALUES)) expect(TARGET_KEYS).toContain(key);
    expect(LIMIT_KEYS.has('sodiumMg')).toBe(true);
    expect(LIMIT_KEYS.has('fiberG')).toBe(false);
    expect(LIMIT_KEYS.has('proteinG')).toBe(false);
  });

  it('lists every label nutrient for the day, against its target', () => {
    const goal: NutritionGoal = {
      startsOn: '2026-10-01', kcal: 2000, proteinG: 150, carbsG: 200, fatG: 67,
      targets: { sodiumMg: 2300, fiberG: 28 }, mealSplit: null,
    };
    const rows = nutrientRows(n({ kcal: 1800, proteinG: 160, carbsG: 180, fiberG: 20, sodiumMg: 2500 }), goal, false);
    expect(rows.map((r) => r.key)).not.toContain('kcal');
    expect(rows.find((r) => r.key === 'sodiumMg')).toMatchObject({ kind: 'limit', status: 'over' });
    expect(rows.find((r) => r.key === 'fiberG')).toMatchObject({ kind: 'goal', status: 'under' });
    expect(rows.find((r) => r.key === 'proteinG')).toMatchObject({ kind: 'goal', status: 'met', target: 150 });
    expect(rows.find((r) => r.key === 'ironMg')).toMatchObject({ eaten: null, target: null, status: null });
  });

  it('shows net carbs when that is the setting', () => {
    const rows = nutrientRows(n({ kcal: 100, carbsG: 30, fiberG: 10 }), null, true);
    expect(rows.find((r) => r.key === 'carbsG')).toMatchObject({ label: 'Net carbs', eaten: 20 });
  });
});

describe('the goal form', () => {
  const ctx: GoalContext = {
    weightUnit: 'kg', energyUnit: 'kcal', today: TODAY, mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'], currentWeightKg: 80,
  };
  const settings: NutritionSettings = {
    ...DEFAULT_NUTRITION_SETTINGS, heightCm: 180, birthYear: 1990, sex: 'male', activity: 'moderate', weeklyChangeKg: -0.5,
  };
  const base = (over: Partial<GoalDraft> = {}): GoalDraft => ({ ...draftFor(settings, null, ctx), ...over });

  it('starts from the saved inputs and the latest weight', () => {
    const d = draftFor(settings, null, ctx);
    expect(d).toMatchObject({
      calories: 'calculator', weight: '80', heightCm: '180', birthYear: '1990', direction: 'lose', rateKg: 0.5,
      carbsPct: '50', proteinPct: '20', fatPct: '30', splitByMeal: false, mealSplit: ['25', '25', '25', '25'],
    });
    expect(draftFor(settings, null, { ...ctx, weightUnit: 'lb' })).toMatchObject({ heightFt: '5', heightIn: '11', weight: '176.4' });
  });

  it('works the calories out and splits them into grams', () => {
    const e = evaluateGoal(base(), ctx);
    expect(e.problems).toEqual([]);
    const expected = calorieGoal({
      weightKg: 80, heightCm: 180, birthYear: 1990, sex: 'male', activity: 'moderate', weeklyChangeKg: -0.5, today: TODAY,
    })!;
    expect(e.kcal).toBe(expected.kcal);
    expect(e.result?.goal).toMatchObject({ startsOn: TODAY, kcal: expected.kcal, macroMode: 'percent', mealSplit: null });
    expect(e.result?.goal.carbsG).toBe(Math.round((expected.kcal * 0.5) / 4));
    expect(e.result?.settings).toMatchObject({ heightCm: 180, birthYear: 1990, sex: 'male', activity: 'moderate', weeklyChangeKg: -0.5 });
    // The weight typed is the latest one, so no new weigh-in.
    expect(e.result?.weighInKg).toBeNull();
    expect(evaluateGoal(base({ weight: '79.4' }), ctx).result?.weighInKg).toBe(79.4);
  });

  it('opens a saved goal the way it was set', () => {
    const calc = evaluateGoal(base(), ctx).result!.goal;
    expect(draftFor(settings, calc, ctx).calories).toBe('calculator');
    const own: NutritionGoal = { ...calc, kcal: 2500, macroMode: 'grams', proteinG: 180, carbsG: 250, fatG: 80, mealSplit: [20, 30, 40, 10] };
    expect(draftFor(settings, own, ctx)).toMatchObject({
      calories: 'manual', manualEnergy: '2500', macroMode: 'grams', proteinG: '180', splitByMeal: true, mealSplit: ['20', '30', '40', '10'],
    });
  });

  it('asks for what the calculator needs', () => {
    const e = evaluateGoal(base({ weight: '', heightCm: '', activity: null, birthYear: '' }), ctx);
    expect(e.problems.map((p) => p.field).sort()).toEqual(['activity', 'birthYear', 'height', 'weight']);
    expect(e.result).toBeNull();
    expect(evaluateGoal(base({ birthYear: '2020' }), ctx).problems[0]).toMatchObject({ field: 'birthYear', message: 'Enter a year from 1906 to 2013.' });
  });

  it('takes a goal of your own, in kJ too', () => {
    const e = evaluateGoal(base({ calories: 'manual', manualEnergy: '2200' }), ctx);
    expect(e.result?.goal.kcal).toBe(2200);
    // Only the birth year and goal weight are kept from a manual goal.
    expect(Object.keys(e.result!.settings).sort()).toEqual(['birthYear', 'goalWeightKg']);
    const kj = evaluateGoal(base({ calories: 'manual', manualEnergy: '8368' }), { ...ctx, energyUnit: 'kj' });
    expect(kj.result?.goal.kcal).toBe(2000);
  });

  it('warns below the floor but saves; refuses below the minimum', () => {
    const low = evaluateGoal(base({ calories: 'manual', manualEnergy: '1300' }), ctx);
    expect(low.belowFloor).toBe(true);
    expect(low.floor).toBe(1500);
    expect(low.result).not.toBeNull();
    const tooLow = evaluateGoal(base({ calories: 'manual', manualEnergy: String(MIN_GOAL_KCAL - 1) }), ctx);
    expect(tooLow.problems[0].field).toBe('manualEnergy');
    // A small, sedentary person losing fast: the calculator's answer is too low to save.
    const fast = evaluateGoal(
      base({ weight: '45', heightCm: '150', sex: 'female', activity: 'sedentary', birthYear: '1960', direction: 'lose', rateKg: 1 }),
      ctx,
    );
    expect(fast.kcal).toBeLessThan(MIN_GOAL_KCAL);
    expect(fast.problems.map((p) => p.field)).toContain('direction');
  });

  describe('under 18', () => {
    // Born in 2009: 17 or 16 in 2026, depending on the birthday.
    const teen = (over: Partial<GoalDraft>) => base({ birthYear: '2009', ...over });

    it('offers no weight-loss goal', () => {
      const e = evaluateGoal(teen({ direction: 'lose' }), ctx);
      expect(e.minor).toBe(true);
      expect(e.problems.map((p) => p.field)).toContain('direction');
      expect(e.result).toBeNull();
      expect(evaluateGoal(teen({ direction: 'maintain' }), ctx).result).not.toBeNull();
      expect(evaluateGoal(teen({ direction: 'gain', rateKg: 0.25 }), ctx).result?.settings.weeklyChangeKg).toBe(0.25);
    });

    it('uses the lower age when the birthday is unknown', () => {
      // Born in 2008 could already be 18, or still 17: treated as 17.
      expect(evaluateGoal(base({ birthYear: '2008', direction: 'lose' }), ctx).minor).toBe(true);
      expect(evaluateGoal(base({ birthYear: '2007', direction: 'lose' }), ctx).minor).toBe(false);
    });

    it('takes no calorie number of their own', () => {
      const e = evaluateGoal(teen({ calories: 'manual', manualEnergy: '2400', direction: 'maintain' }), ctx);
      expect(e.problems.map((p) => p.field)).toEqual(['manualEnergy']);
    });

    it('refuses a goal weight below today’s', () => {
      expect(evaluateGoal(teen({ direction: 'maintain', goalWeight: '75' }), ctx).problems.map((p) => p.field)).toEqual(['goalWeight']);
      expect(evaluateGoal(teen({ direction: 'gain', goalWeight: '85' }), ctx).result?.settings.goalWeightKg).toBe(85);
    });

    it('opens on the calculator even if the goal was typed in', () => {
      const typed: NutritionGoal = { startsOn: '2026-10-01', kcal: 2600, proteinG: null, carbsG: null, fatG: null, targets: {}, mealSplit: null };
      expect(draftFor({ ...settings, birthYear: 2009, weeklyChangeKg: 0 }, typed, ctx).calories).toBe('calculator');
    });
  });

  it('checks the macros add up', () => {
    expect(evaluateGoal(base({ carbsPct: '50', proteinPct: '30', fatPct: '30' }), ctx).problems[0]).toMatchObject({
      field: 'macros', message: 'These add up to 110%. Make them 100%.',
    });
    const grams = evaluateGoal(base({ macroMode: 'grams', carbsG: '200', proteinG: '160', fatG: '' }), ctx);
    expect(grams.result?.goal).toMatchObject({ carbsG: 200, proteinG: 160, fatG: null, macroMode: 'grams' });
    expect(grams.macroKcal).toBe(1440);
  });

  it('keeps the other targets that were filled in', () => {
    const e = evaluateGoal(base({ targets: { sodiumMg: '2300', fiberG: '30', ironMg: '', calciumMg: 'lots' } }), ctx);
    expect(e.problems).toEqual([{ field: 'calciumMg', message: 'Enter mg, or leave it blank.' }]);
    const ok = evaluateGoal(base({ targets: { sodiumMg: '2300', fiberG: '30', ironMg: '' } }), ctx);
    expect(ok.result?.goal.targets).toEqual({ sodiumMg: 2300, fiberG: 30 });
  });

  it('splits calories by meal only when the shares make 100%', () => {
    expect(evenSplit(3)).toEqual([34, 33, 33]);
    expect(evenSplit(6).reduce((a, b) => a + b, 0)).toBe(100);
    const bad = evaluateGoal(base({ splitByMeal: true, mealSplit: ['30', '30', '30', '20'] }), ctx);
    expect(bad.splitTotal).toBe(110);
    const ok = evaluateGoal(base({ splitByMeal: true, mealSplit: ['20', '35', '35', '10'] }), ctx);
    expect(ok.result?.goal.mealSplit).toEqual([20, 35, 35, 10]);
  });

  it('offers weekly rates in pounds or kilograms, up to the calculator’s cap', () => {
    expect(RATE_OPTIONS.lb.map((r) => r.label)).toEqual(['0.5 lb', '1 lb', '1.5 lb', '2 lb']);
    for (const r of [...RATE_OPTIONS.lb, ...RATE_OPTIONS.kg]) expect(r.kg).toBeLessThanOrEqual(1);
  });
});

describe('reports', () => {
  const entry = (day: string, kcal: number, extra: Partial<Nutrients> = {}): DiaryEntry => ({
    id: `${day}-${kcal}`, day, meal: 0, loggedAt: `${day}T12:00:00Z`, foodId: null, source: 'quick', barcode: null,
    name: 'Food', brand: null, amount: 1, unit: 'serving', grams: null, nutrients: n({ kcal, ...extra }),
  });
  const goals: NutritionGoal[] = [
    { startsOn: '2026-10-01', kcal: 2000, proteinG: null, carbsG: null, fatG: null, targets: {}, mealSplit: null },
    { startsOn: '2026-10-27', kcal: 1800, proteinG: null, carbsG: null, fatG: null, targets: {}, mealSplit: null },
  ];

  it('covers every day of the range, logged or not', () => {
    expect(rangeStart('week', TODAY)).toBe('2026-10-23');
    expect(rangeStart('month', TODAY)).toBe('2026-09-30');
    // 12 whole weeks, starting on a Sunday.
    expect(rangeStart('quarter', TODAY)).toBe('2026-08-09');
    const days = reportDays([entry('2026-10-25', 1500), entry('2026-10-25', 400), entry('2026-10-28', 1700)], goals, '2026-10-23', TODAY);
    expect(days).toHaveLength(7);
    expect(days.filter((d) => d.logged).map((d) => d.day)).toEqual(['2026-10-25', '2026-10-28']);
    expect(days.find((d) => d.day === '2026-10-25')).toMatchObject({ goalKcal: 2000, total: { kcal: 1900 } });
    expect(days.find((d) => d.day === '2026-10-28')?.goalKcal).toBe(1800);
  });

  it('averages over the days logged only', () => {
    const days = reportDays(
      [
        entry('2026-10-25', 1900, { carbsG: 200, proteinG: 100, fatG: 60, sodiumMg: 2000 }),
        entry('2026-10-28', 1700, { carbsG: 150, proteinG: 120, fatG: 60 }),
      ],
      goals,
      '2026-10-23',
      TODAY,
    );
    const s = reportSummary(days);
    expect(s).toMatchObject({ days: 7, daysLogged: 2, averageKcal: 1800, averageGoalKcal: 1900, daysWithGoal: 2, daysAtOrUnderGoal: 2 });
    expect(s.averages.sodiumMg).toBe(1000);
    expect(s.averages).not.toHaveProperty('ironMg');
    expect(s.macroShare).toEqual(expect.objectContaining({ carbsPct: expect.any(Number) }));
    expect(s.macroShare!.carbsPct + s.macroShare!.proteinPct + s.macroShare!.fatPct).toBe(100);
    expect(reportSummary(reportDays([], goals, '2026-10-23', TODAY))).toMatchObject({ daysLogged: 0, averageKcal: null, macroShare: null });
  });

  it('groups a quarter into Sunday-to-Saturday weeks', () => {
    const from = rangeStart('quarter', TODAY);
    const weeks = reportWeeks(reportDays([entry('2026-10-26', 2100), entry('2026-10-28', 1900)], goals, from, TODAY));
    expect(weeks).toHaveLength(12);
    expect(weeks[0].week).toBe('2026-08-09');
    expect(weeks[11]).toMatchObject({ week: '2026-10-25', daysLogged: 2, averageKcal: 2000 });
    expect(weeks[0]).toMatchObject({ daysLogged: 0, averageKcal: null });
  });
});
