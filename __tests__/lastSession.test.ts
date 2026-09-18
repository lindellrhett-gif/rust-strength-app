import { lastTopSet, type SessionSet } from '../src/domain/lastSession';

const base: SessionSet = {
  workoutId: 'w1',
  weight: 100,
  reps: 8,
  rpe: 8,
  isWarmup: false,
  isBodyweight: false,
  assistWeight: null,
  addedWeight: null,
  durationSeconds: null,
  performedAt: '2026-09-10T10:00:00Z',
};
const set = (over: Partial<SessionSet>): SessionSet => ({ ...base, ...over });

describe('lastTopSet', () => {
  it('is null with no earlier session', () => {
    expect(lastTopSet([], 'now', 'weighted')).toBeNull();
    expect(lastTopSet([set({ workoutId: 'now' })], 'now', 'weighted')).toBeNull();
  });

  it('picks the heaviest set from the most recent earlier session', () => {
    const history = [
      set({ workoutId: 'old', weight: 300, performedAt: '2026-09-01T10:00:00Z' }),
      set({ workoutId: 'last', weight: 185, reps: 8, performedAt: '2026-09-10T10:00:00Z' }),
      set({ workoutId: 'last', weight: 195, reps: 5, performedAt: '2026-09-10T10:05:00Z' }),
      set({ workoutId: 'last', weight: 195, reps: 6, performedAt: '2026-09-10T10:10:00Z' }),
      set({ workoutId: 'now', weight: 205, performedAt: '2026-09-18T10:00:00Z' }),
    ];
    const top = lastTopSet(history, 'now', 'weighted')!;
    expect(top.set.weight).toBe(195);
    expect(top.set.reps).toBe(6);
    expect(top.workingSets).toBe(3);
    expect(top.performedAt).toBe('2026-09-10T10:10:00Z');
  });

  it('skips warmups, and a session that was only warmups', () => {
    const history = [
      set({ workoutId: 'a', weight: 135, performedAt: '2026-09-05T10:00:00Z' }),
      set({ workoutId: 'b', weight: 45, isWarmup: true, performedAt: '2026-09-09T10:00:00Z' }),
    ];
    expect(lastTopSet(history, 'now', 'weighted')!.set.workoutId).toBe('a');
  });

  it('ranks assisted sets by least assistance (most load moved)', () => {
    const history = [
      set({ weight: 120, assistWeight: 60, reps: 8, isBodyweight: true }),
      set({ weight: 140, assistWeight: 40, reps: 5, isBodyweight: true }),
    ];
    expect(lastTopSet(history, 'now', 'assisted')!.set.assistWeight).toBe(40);
  });

  it('ranks bodyweight sets by added weight, then reps', () => {
    const plain = [
      set({ addedWeight: 0, reps: 12, isBodyweight: true }),
      set({ addedWeight: 0, reps: 15, isBodyweight: true }),
    ];
    expect(lastTopSet(plain, 'now', 'bodyweight')!.set.reps).toBe(15);
    const weighted = [...plain, set({ addedWeight: 25, reps: 6, isBodyweight: true })];
    expect(lastTopSet(weighted, 'now', 'bodyweight')!.set.addedWeight).toBe(25);
  });

  it('ranks holds by time', () => {
    const history = [
      set({ weight: 0, reps: 1, durationSeconds: 60 }),
      set({ weight: 0, reps: 1, durationSeconds: 75 }),
      set({ weight: 0, reps: 1, durationSeconds: 50 }),
    ];
    expect(lastTopSet(history, 'now', 'timed')!.set.durationSeconds).toBe(75);
  });
});
