import {
  editableValue,
  endedAtFor,
  isChanged,
  lengthProblem,
  normalizeWorkoutName,
  patchForEdit,
  setKind,
  workoutLengthSeconds,
  type StoredSet,
} from '../src/domain/workoutEdit';
import { e1rmFromSet } from '../src/domain/recommender';

const base: StoredSet = {
  weight: 185,
  reps: 8,
  rpe: 8,
  is_warmup: false,
  assist_weight: null,
  added_weight: null,
  duration_seconds: null,
};
const set = (over: Partial<StoredSet>): StoredSet => ({ ...base, ...over });

describe('workout length', () => {
  it('reads the length to the minute', () => {
    expect(workoutLengthSeconds('2026-09-18T18:00:00Z', '2026-09-18T19:14:40Z')).toBe(75 * 60);
    expect(workoutLengthSeconds('2026-09-18T18:00:00Z', null)).toBe(0);
  });

  it('turns a corrected length into an end time', () => {
    // Forgot to tap Finish: ended at 23:00, really trained 1h15m.
    expect(endedAtFor('2026-09-18T18:00:00.000Z', 75 * 60)).toBe('2026-09-18T19:15:00.000Z');
  });

  it('rejects lengths under a minute or over 12 hours', () => {
    expect(lengthProblem(0)).toMatch(/at least a minute/);
    expect(lengthProblem(60)).toBeNull();
    expect(lengthProblem(12 * 3600)).toBeNull();
    expect(lengthProblem(12 * 3600 + 60)).toMatch(/12 hours/);
  });
});

describe('workout name', () => {
  it('trims, collapses spaces, and treats blank as unnamed', () => {
    expect(normalizeWorkoutName('  Push   Day  ')).toBe('Push Day');
    expect(normalizeWorkoutName('   ')).toBeNull();
    expect(normalizeWorkoutName('x'.repeat(80))).toHaveLength(60);
  });
});

describe('editing a set', () => {
  it('knows how each set was logged', () => {
    expect(setKind(base)).toBe('weighted');
    expect(setKind(set({ assist_weight: 40 }))).toBe('assisted');
    expect(setKind(set({ added_weight: 0 }))).toBe('bodyweight');
    expect(setKind(set({ duration_seconds: 60 }))).toBe('timed');
  });

  it('edits the number the user typed', () => {
    expect(editableValue(base)).toBe(185);
    expect(editableValue(set({ weight: 140, assist_weight: 40 }))).toBe(40);
    expect(editableValue(set({ weight: 205, added_weight: 25 }))).toBe(25);
    expect(editableValue(set({ weight: 0, reps: 1, duration_seconds: 75 }))).toBe(75);
  });

  it('rewrites weight, reps and e1RM for a weighted set', () => {
    const patch = patchForEdit(base, { value: 195, reps: 6 });
    expect(patch.weight).toBe(195);
    expect(patch.reps).toBe(6);
    expect(patch.e1rm).toBeCloseTo(e1rmFromSet({ weight: 195, reps: 6, rpe: 8 }), 1);
  });

  it('keeps the bodyweight the set was logged at for assisted sets', () => {
    // Logged at 180 bodyweight with 40 assist: 140 moved. Correct to 30 assist.
    const patch = patchForEdit(set({ weight: 140, assist_weight: 40 }), { value: 30, reps: 8 });
    expect(patch.assist_weight).toBe(30);
    expect(patch.weight).toBe(150);
  });

  it('keeps the bodyweight the set was logged at for bodyweight sets', () => {
    // Logged at 180 + 25 added = 205. Correct the added weight to 35.
    const patch = patchForEdit(set({ weight: 205, added_weight: 25 }), { value: 35, reps: 10 });
    expect(patch.added_weight).toBe(35);
    expect(patch.weight).toBe(215);
  });

  it('edits a hold’s time and keeps it one rep', () => {
    const plank = set({ weight: 0, reps: 1, rpe: 9, duration_seconds: 60, added_weight: 0 });
    const patch = patchForEdit(plank, { value: 90, reps: 1 });
    expect(patch.duration_seconds).toBe(90);
    expect(patch.reps).toBe(1);
    expect(patch.weight).toBe(0);
  });

  it('gives warmups no e1RM', () => {
    expect(patchForEdit(set({ is_warmup: true, rpe: null }), { value: 95, reps: 10 }).e1rm).toBe(0);
  });

  it('only writes sets that changed', () => {
    expect(isChanged(base, { value: 185, reps: 8 })).toBe(false);
    expect(isChanged(base, { value: 190, reps: 8 })).toBe(true);
    expect(isChanged(base, { value: 185, reps: 7 })).toBe(true);
    const plank = set({ weight: 0, reps: 1, duration_seconds: 60 });
    expect(isChanged(plank, { value: 60, reps: 5 })).toBe(false);
  });
});
