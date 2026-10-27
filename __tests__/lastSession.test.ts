import { lastSession, lastTopSet, type SessionSet } from '../src/domain/lastSession';

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

describe('lastSession', () => {
  const history = [
    set({ workoutId: 'old', weight: 300, performedAt: '2026-09-01T10:00:00Z' }),
    // Newest first, the way the history query returns them.
    set({ workoutId: 'last', weight: 175, reps: 8, performedAt: '2026-09-10T10:15:00Z' }),
    set({ workoutId: 'last', weight: 195, reps: 6, performedAt: '2026-09-10T10:10:00Z' }),
    set({ workoutId: 'last', weight: 185, reps: 8, performedAt: '2026-09-10T10:05:00Z' }),
    set({ workoutId: 'last', weight: 135, reps: 10, isWarmup: true, rpe: null, performedAt: '2026-09-10T10:00:00Z' }),
    set({ workoutId: 'now', weight: 205, performedAt: '2026-09-18T10:00:00Z' }),
  ];

  it('lists every set of the last session in the order they were done, warm-ups included', () => {
    const last = lastSession(history, 'now', 'weighted')!;
    expect(last.sets.map((s) => [s.weight, s.reps])).toEqual([
      [135, 10],
      [185, 8],
      [195, 6],
      [175, 8],
    ]);
    expect(last.performedAt).toBe('2026-09-10T10:15:00Z');
  });

  it('picks out the top working set, never a warm-up', () => {
    const last = lastSession(history, 'now', 'weighted')!;
    expect(last.sets[last.topIndex].weight).toBe(195);
    const heavyWarmup = [
      set({ workoutId: 'x', weight: 225, isWarmup: true, performedAt: '2026-09-10T10:00:00Z' }),
      set({ workoutId: 'x', weight: 185, performedAt: '2026-09-10T10:05:00Z' }),
    ];
    const x = lastSession(heavyWarmup, 'now', 'weighted')!;
    expect(x.sets[x.topIndex].weight).toBe(185);
  });

  it('leaves out the workout in progress, and a session that was only warm-ups', () => {
    expect(lastSession([set({ workoutId: 'now' })], 'now', 'weighted')).toBeNull();
    const onlyWarmups = [
      set({ workoutId: 'a', weight: 135, performedAt: '2026-09-05T10:00:00Z' }),
      set({ workoutId: 'b', weight: 45, isWarmup: true, performedAt: '2026-09-09T10:00:00Z' }),
    ];
    expect(lastSession(onlyWarmups, 'now', 'weighted')!.sets.map((s) => s.workoutId)).toEqual(['a']);
  });
});
