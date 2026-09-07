import {
  generateWorkout,
  FOCUS_GROUPS,
  type GeneratorExercise,
  type GenerateInput,
} from '@/domain/generator';
import type { LoggedSet } from '@/domain/recommender';

const LIB: GeneratorExercise[] = [
  { id: 'bb-bench', name: 'Barbell Bench Press', muscleGroup: 'chest', equipment: 'barbell' },
  { id: 'db-press', name: 'Dumbbell Bench Press', muscleGroup: 'chest', equipment: 'dumbbell' },
  { id: 'pushup', name: 'Push-Up', muscleGroup: 'chest', equipment: 'bodyweight' },
  { id: 'row', name: 'Bent-Over Row', muscleGroup: 'back', equipment: 'barbell' },
  { id: 'pullup', name: 'Pull-Up', muscleGroup: 'back', equipment: 'bodyweight' },
  { id: 'ohp', name: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'barbell' },
  { id: 'curl', name: 'Dumbbell Curl', muscleGroup: 'biceps', equipment: 'dumbbell' },
  { id: 'pushdown', name: 'Triceps Pushdown', muscleGroup: 'triceps', equipment: 'cable' },
  { id: 'squat', name: 'Back Squat', muscleGroup: 'quads', equipment: 'barbell' },
  { id: 'rdl', name: 'Romanian Deadlift', muscleGroup: 'hamstrings', equipment: 'barbell' },
  { id: 'thrust', name: 'Hip Thrust', muscleGroup: 'glutes', equipment: 'barbell' },
  { id: 'calf', name: 'Standing Calf Raise', muscleGroup: 'calves', equipment: 'machine' },
  { id: 'plank', name: 'Plank', muscleGroup: 'core', equipment: 'bodyweight' },
];

function input(over: Partial<GenerateInput> = {}): GenerateInput {
  return {
    exercises: LIB,
    availableEquipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    focus: 'full-body',
    exerciseCount: 5,
    setsPerExercise: 3,
    targetRepLow: 6,
    targetRepHigh: 8,
    weekCoverage: {},
    historyByExercise: {},
    seed: 42,
    ...over,
  };
}

describe('generateWorkout', () => {
  it('returns the requested number of exercises', () => {
    const out = generateWorkout(input({ exerciseCount: 5 }));
    expect(out.items).toHaveLength(5);
    expect(out.warning).toBeNull();
  });

  it('never repeats an exercise', () => {
    const out = generateWorkout(input({ exerciseCount: 8 }));
    const ids = out.items.map((i) => i.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only picks exercises the available equipment allows', () => {
    const out = generateWorkout(
      input({ availableEquipment: ['bodyweight'], exerciseCount: 3 }),
    );
    const allowed = new Set(['pushup', 'pullup', 'plank']);
    for (const item of out.items) expect(allowed.has(item.exerciseId)).toBe(true);
  });

  it('warns when equipment allows fewer exercises than requested', () => {
    const out = generateWorkout(
      input({ availableEquipment: ['bodyweight'], exerciseCount: 10 }),
    );
    expect(out.items.length).toBeLessThan(10);
    expect(out.warning).toMatch(/Only \d+ exercise/);
  });

  it('warns and returns nothing when no exercise matches', () => {
    const out = generateWorkout(
      input({ availableEquipment: ['kettlebell'], exerciseCount: 5 }),
    );
    expect(out.items).toEqual([]);
    expect(out.warning).toMatch(/No exercises match/);
  });

  it('treats custom exercises with unknown equipment as always eligible', () => {
    const custom: GeneratorExercise = {
      id: 'custom',
      name: 'Sled Push',
      muscleGroup: 'quads',
      equipment: null,
    };
    const out = generateWorkout(
      input({ exercises: [custom], availableEquipment: ['kettlebell'], exerciseCount: 1 }),
    );
    expect(out.items.map((i) => i.exerciseId)).toEqual(['custom']);
  });

  it('stays within the muscle groups of the chosen focus', () => {
    const out = generateWorkout(input({ focus: 'lower', exerciseCount: 4 }));
    for (const item of out.items) {
      expect(FOCUS_GROUPS.lower).toContain(item.muscleGroup);
    }
  });

  it('prioritises muscle groups not yet trained this week', () => {
    // Chest heavily trained, back untouched: back must be picked first.
    const out = generateWorkout(
      input({
        focus: 'push',
        exerciseCount: 1,
        weekCoverage: { chest: 12, shoulders: 0, triceps: 9 },
      }),
    );
    expect(out.items[0].muscleGroup).toBe('shoulders');
    expect(out.items[0].reason).toMatch(/not trained yet this week/);
  });

  it('suggests a weight from history and leaves it null without history', () => {
    const history: Record<string, LoggedSet[]> = {
      squat: [
        {
          weight: 225,
          reps: 5,
          rpe: 8,
          isWarmup: false,
          machineId: null,
          performedAt: '2026-09-01T10:00:00Z',
        },
      ],
    };
    const out = generateWorkout(
      input({ focus: 'lower', exerciseCount: 4, historyByExercise: history }),
    );
    const squat = out.items.find((i) => i.exerciseId === 'squat');
    expect(squat).toBeDefined();
    expect(squat!.suggestedWeight).toBeGreaterThan(0);
    expect(squat!.suggestedWeight! % 5).toBe(0);
    expect(squat!.reason).toMatch(/e1RM/);

    const noHistory = out.items.find((i) => i.exerciseId !== 'squat');
    expect(noHistory!.suggestedWeight).toBeNull();
    expect(noHistory!.reason).toMatch(/no history/);
  });

  it('is deterministic for the same seed and varies with a different one', () => {
    const a = generateWorkout(input({ seed: 7 }));
    const b = generateWorkout(input({ seed: 7 }));
    expect(a.items.map((i) => i.exerciseId)).toEqual(b.items.map((i) => i.exerciseId));
  });

  it('carries the requested set count and rep range onto every item', () => {
    const out = generateWorkout(
      input({ setsPerExercise: 4, targetRepLow: 10, targetRepHigh: 12 }),
    );
    for (const item of out.items) {
      expect(item.sets).toBe(4);
      expect(item.repLow).toBe(10);
      expect(item.repHigh).toBe(12);
    }
  });

  it('falls back to a sane rep range when given a nonsensical one', () => {
    const out = generateWorkout(input({ targetRepLow: 12, targetRepHigh: 4 }));
    expect(out.items[0].repLow).toBe(6);
    expect(out.items[0].repHigh).toBe(8);
  });

  it('does not filter when the user selects no equipment', () => {
    const out = generateWorkout(input({ availableEquipment: [], exerciseCount: 5 }));
    expect(out.items).toHaveLength(5);
  });
});
