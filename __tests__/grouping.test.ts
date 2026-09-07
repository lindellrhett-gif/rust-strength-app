import { groupSetsByExercise, totalVolume, type GroupableSet } from '@/domain/grouping';

function s(partial: Partial<GroupableSet> & Pick<GroupableSet, 'id' | 'exerciseId' | 'orderIndex'>): GroupableSet {
  return {
    exerciseName: partial.exerciseId === 'bench' ? 'Bench Press' : 'Squat',
    weight: 100,
    reps: 8,
    rpe: 8,
    isWarmup: false,
    isBodyweight: false,
    e1rm: 130,
    ...partial,
  };
}

describe('groupSetsByExercise', () => {
  it('stacks consecutive sets of one exercise into a single group', () => {
    const groups = groupSetsByExercise([
      s({ id: '1', exerciseId: 'bench', orderIndex: 0 }),
      s({ id: '2', exerciseId: 'bench', orderIndex: 1 }),
      s({ id: '3', exerciseId: 'bench', orderIndex: 2 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].sets).toHaveLength(3);
    expect(groups[0].exerciseName).toBe('Bench Press');
  });

  it('orders by orderIndex regardless of input order', () => {
    const groups = groupSetsByExercise([
      s({ id: '3', exerciseId: 'squat', orderIndex: 2 }),
      s({ id: '1', exerciseId: 'bench', orderIndex: 0 }),
      s({ id: '2', exerciseId: 'bench', orderIndex: 1 }),
    ]);
    expect(groups.map((g) => g.exerciseId)).toEqual(['bench', 'squat']);
    expect(groups[0].sets.map((x) => x.id)).toEqual(['1', '2']);
  });

  it('keeps a revisited exercise as its own block and numbers both', () => {
    const groups = groupSetsByExercise([
      s({ id: '1', exerciseId: 'bench', orderIndex: 0 }),
      s({ id: '2', exerciseId: 'squat', orderIndex: 1 }),
      s({ id: '3', exerciseId: 'bench', orderIndex: 2 }),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups[0].occurrence).toBe(1);
    expect(groups[0].totalOccurrences).toBe(2);
    expect(groups[2].occurrence).toBe(2);
    expect(groups[2].totalOccurrences).toBe(2);
    // Squat appeared once.
    expect(groups[1].totalOccurrences).toBe(1);
  });

  it('excludes warmups from volume, count and best e1RM', () => {
    const groups = groupSetsByExercise([
      s({ id: '1', exerciseId: 'bench', orderIndex: 0, isWarmup: true, weight: 45, reps: 10, e1rm: 0 }),
      s({ id: '2', exerciseId: 'bench', orderIndex: 1, weight: 100, reps: 8, e1rm: 130 }),
      s({ id: '3', exerciseId: 'bench', orderIndex: 2, weight: 105, reps: 6, e1rm: 126 }),
    ]);
    expect(groups[0].sets).toHaveLength(3);
    expect(groups[0].workingSets).toBe(2);
    expect(groups[0].volume).toBe(100 * 8 + 105 * 6);
    expect(groups[0].bestE1rm).toBe(130);
  });

  it('reports null best e1RM when every set is a warmup', () => {
    const groups = groupSetsByExercise([
      s({ id: '1', exerciseId: 'bench', orderIndex: 0, isWarmup: true }),
    ]);
    expect(groups[0].bestE1rm).toBeNull();
    expect(groups[0].volume).toBe(0);
  });

  it('handles an empty workout', () => {
    expect(groupSetsByExercise([])).toEqual([]);
  });

  it('gives every group a unique key', () => {
    const groups = groupSetsByExercise([
      s({ id: '1', exerciseId: 'bench', orderIndex: 0 }),
      s({ id: '2', exerciseId: 'squat', orderIndex: 1 }),
      s({ id: '3', exerciseId: 'bench', orderIndex: 2 }),
    ]);
    expect(new Set(groups.map((g) => g.key)).size).toBe(groups.length);
  });
});

describe('totalVolume', () => {
  it('sums working sets only', () => {
    expect(
      totalVolume([
        s({ id: '1', exerciseId: 'bench', orderIndex: 0, weight: 100, reps: 10 }),
        s({ id: '2', exerciseId: 'bench', orderIndex: 1, weight: 50, reps: 10, isWarmup: true }),
      ]),
    ).toBe(1000);
  });

  it('is zero for no sets', () => {
    expect(totalVolume([])).toBe(0);
  });
});
