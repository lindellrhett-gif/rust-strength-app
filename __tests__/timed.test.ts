import { readFileSync } from 'node:fs';

import {
  LOAD_TYPES,
  LOAD_TYPE_HINT,
  LOAD_TYPE_LABEL,
  formatHold,
  formatSetLoad,
  formatSetSummary,
} from '../src/domain/loadType';
import {
  HOLD_STEP_SECONDS,
  MAX_REPS,
  MIN_HOLD_JUMP_SECONDS,
  recommendDuration,
  repRangeOrDefault,
  type HoldSet,
} from '../src/domain/recommender';

const hold = (seconds: number, rpe: number | null, minutesAgo: number, addedWeight: number | null = 0): HoldSet => ({
  seconds,
  rpe,
  isWarmup: false,
  addedWeight,
  performedAt: Date.now() - minutesAgo * 60_000,
});

describe('timed load type', () => {
  it('is a load type with a label and a hint', () => {
    expect(LOAD_TYPES).toContain('timed');
    expect(LOAD_TYPE_LABEL.timed).toBe('Timed');
    expect(LOAD_TYPE_HINT.timed.length).toBeGreaterThan(0);
  });

  it('formats holds as seconds, then minutes, then hours', () => {
    expect(formatHold(0)).toBe('0s');
    expect(formatHold(45)).toBe('45s');
    expect(formatHold(60)).toBe('1:00');
    expect(formatHold(95)).toBe('1:35');
    expect(formatHold(3725)).toBe('1:02:05');
  });

  it('shows a timed set by its time, not "0 × 1"', () => {
    const plank = { weight: 0, reps: 1, isBodyweight: true, addedWeight: 0, durationSeconds: 90 };
    expect(formatSetSummary(plank, 'lb')).toBe('1:30 hold');
    expect(formatSetSummary({ ...plank, weight: 25, addedWeight: 25 }, 'lb')).toBe('1:30 hold + 25 lb');
    expect(formatSetLoad(plank, 'lb')).toBe('BW');
  });

  it('summarises the other types with their load and reps', () => {
    expect(formatSetSummary({ weight: 185, reps: 8, isBodyweight: false }, 'lb')).toBe('185 lb × 8');
    expect(
      formatSetSummary({ weight: 140, reps: 6, isBodyweight: true, assistWeight: 40 }, 'lb'),
    ).toBe('40 lb assist × 6');
    expect(
      formatSetSummary({ weight: 205, reps: 10, isBodyweight: true, addedWeight: 25 }, 'lb'),
    ).toBe('BW + 25 lb × 10');
    expect(formatSetSummary({ weight: 180, reps: 12, isBodyweight: true, addedWeight: 0 }, 'kg')).toBe(
      'BW × 12',
    );
  });
});

describe('recommendDuration', () => {
  it('asks for a first hold when there is no history', () => {
    const rec = recommendDuration({ history: [], addedWeight: 0 });
    expect(rec.suggestedSeconds).toBeNull();
    expect(rec.rationale).toMatch(/first hold/);
  });

  it('matches a hold taken to the limit', () => {
    const rec = recommendDuration({ history: [hold(60, 10, 5)], addedWeight: 0 });
    expect(rec.suggestedSeconds).toBe(60);
  });

  it('asks for longer when the last hold had time left', () => {
    const rec = recommendDuration({ history: [hold(60, 7, 5)], addedWeight: 0 });
    // RPE 7 = 3 in reserve = about 30% more; capped at +20% of the last hold.
    expect(rec.suggestedSeconds).toBe(70);
    expect(rec.rationale).toMatch(/go longer/);
  });

  it('lets a short hold grow by at least the minimum step', () => {
    const rec = recommendDuration({ history: [hold(20, 6, 5)], addedWeight: 0 });
    expect(rec.suggestedSeconds).toBe(20 + MIN_HOLD_JUMP_SECONDS);
  });

  it('suggests in 5-second steps', () => {
    const rec = recommendDuration({
      history: [hold(47, 9, 30), hold(52, 9, 20), hold(49, 9, 10)],
      addedWeight: 0,
    });
    expect(rec.suggestedSeconds! % HOLD_STEP_SECONDS).toBe(0);
    expect(rec.confidence).toBe('medium');
  });

  it('only counts holds at the same added weight', () => {
    const history = [hold(90, 10, 20, 0), hold(30, 10, 10, 25)];
    expect(recommendDuration({ history, addedWeight: 25 }).suggestedSeconds).toBe(30);
    expect(recommendDuration({ history, addedWeight: 0 }).suggestedSeconds).toBe(90);
    const none = recommendDuration({ history, addedWeight: 45 });
    expect(none.suggestedSeconds).toBeNull();
    expect(none.rationale).toMatch(/added weight/);
  });

  it('ignores warmups', () => {
    const rec = recommendDuration({
      history: [{ ...hold(200, 6, 5), isWarmup: true }, hold(40, 10, 10)],
      addedWeight: 0,
    });
    expect(rec.suggestedSeconds).toBe(40);
  });
});

describe('rep cap', () => {
  it('allows rep targets up to 200', () => {
    expect(MAX_REPS).toBe(200);
    expect(repRangeOrDefault(50, 100)).toEqual([50, 100]);
    expect(repRangeOrDefault(150, 200)).toEqual([150, 200]);
    expect(repRangeOrDefault(1, 201)).toEqual([6, 8]);
  });

  it('matches the database constraint', () => {
    const sql = readFileSync('supabase/migrations/0013_timed_sets_leaderboard.sql', 'utf8');
    expect(sql).toContain(`target_rep_high between 1 and ${MAX_REPS}`);
    expect(sql).toContain(`target_rep_low between 1 and ${MAX_REPS}`);
  });
});

describe('timed migrations', () => {
  const addType = readFileSync('supabase/migrations/0012_timed_load_type.sql', 'utf8');
  const main = readFileSync('supabase/migrations/0013_timed_sets_leaderboard.sql', 'utf8');

  it('adds the enum value on its own, before anything uses it', () => {
    // Postgres rejects a new enum value used in the transaction that added it.
    expect(addType).toMatch(/alter type exercise_load_type add value if not exists 'timed'/);
    expect(main).not.toMatch(/add value/i);
    expect(main).toMatch(/'timed'/);
  });
});
