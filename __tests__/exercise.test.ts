import type { ActivityRecord } from '../src/domain/activities';
import { exerciseCaloriesForDay } from '../src/domain/exercise';

const localDate = (iso: string) => iso.slice(0, 10);
const activity = (partial: Partial<ActivityRecord>): ActivityRecord => ({
  id: 'a',
  kind: 'run',
  name: null,
  performedAt: '2026-10-07T13:00:00Z',
  durationSeconds: 1800,
  distance: null,
  distanceUnit: null,
  steps: null,
  calories: null,
  ...partial,
});

describe('exercise calories for the nutrition diary', () => {
  it('adds up the day’s activities that have an estimate', () => {
    const day = exerciseCaloriesForDay(
      [
        activity({ id: 'run', calories: 412.6 }),
        activity({ id: 'hoops', kind: 'basketball', name: 'Pickup game', calories: 300 }),
        activity({ id: 'walk', kind: 'walk', calories: null }),
        activity({ id: 'yesterday', calories: 500, performedAt: '2026-10-06T13:00:00Z' }),
      ],
      '2026-10-07',
      localDate,
    );
    expect(day.totalCalories).toBe(713);
    expect(day.entries.map((e) => [e.id, e.calories])).toEqual([
      ['run', 413],
      ['hoops', 300],
      ['walk', null],
    ]);
    expect(day.entries[1].title).toBe('Pickup game');
  });

  it('is zero on a day with no exercise', () => {
    expect(exerciseCaloriesForDay([], '2026-10-07', localDate)).toEqual({ totalCalories: 0, entries: [] });
  });
});
