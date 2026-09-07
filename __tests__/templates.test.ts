import {
  buildWorkoutBlocks,
  planProgress,
  nextUpBlock,
  templateDraftFromSets,
  normalizeTemplateName,
  type PlannedSlot,
} from '@/domain/templates';
import type { GroupableSet } from '@/domain/grouping';

function slot(partial: Partial<PlannedSlot> & Pick<PlannedSlot, 'id' | 'exerciseId'>): PlannedSlot {
  return {
    exerciseName: 'Exercise',
    orderIndex: 0,
    targetSets: 3,
    targetRepLow: 6,
    targetRepHigh: 8,
    suggestedWeight: null,
    ...partial,
  };
}

function set(
  partial: Partial<GroupableSet> & Pick<GroupableSet, 'id' | 'exerciseId' | 'orderIndex'>,
): GroupableSet {
  return {
    exerciseName: 'Exercise',
    weight: 100,
    reps: 8,
    rpe: 8,
    isWarmup: false,
    isBodyweight: false,
    e1rm: 120,
    ...partial,
  };
}

describe('buildWorkoutBlocks', () => {
  it('shows planned exercises before any set is logged', () => {
    const blocks = buildWorkoutBlocks(
      [
        slot({ id: 's1', exerciseId: 'bench', exerciseName: 'Bench Press', orderIndex: 0, targetSets: 4 }),
        slot({ id: 's2', exerciseId: 'incline', exerciseName: 'Incline DB Press', orderIndex: 1 }),
      ],
      [],
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].exerciseName).toBe('Bench Press');
    expect(blocks[0].planned).toBe(true);
    expect(blocks[0].workingSets).toBe(0);
    expect(blocks[0].targetSets).toBe(4);
    expect(blocks[0].complete).toBe(false);
  });

  it('keeps plan order regardless of the order sets were logged', () => {
    const blocks = buildWorkoutBlocks(
      [
        slot({ id: 's1', exerciseId: 'a', exerciseName: 'A', orderIndex: 0 }),
        slot({ id: 's2', exerciseId: 'b', exerciseName: 'B', orderIndex: 1 }),
      ],
      // B was performed first.
      [set({ id: 'x', exerciseId: 'b', orderIndex: 0 })],
    );
    expect(blocks.map((b) => b.exerciseId)).toEqual(['a', 'b']);
    expect(blocks[1].workingSets).toBe(1);
  });

  it('marks a slot complete once its target sets are met', () => {
    const blocks = buildWorkoutBlocks(
      [slot({ id: 's1', exerciseId: 'a', targetSets: 2 })],
      [
        set({ id: '1', exerciseId: 'a', orderIndex: 0 }),
        set({ id: '2', exerciseId: 'a', orderIndex: 1 }),
      ],
    );
    expect(blocks[0].workingSets).toBe(2);
    expect(blocks[0].complete).toBe(true);
  });

  it('does not count warmups toward the target', () => {
    const blocks = buildWorkoutBlocks(
      [slot({ id: 's1', exerciseId: 'a', targetSets: 1 })],
      [set({ id: '1', exerciseId: 'a', orderIndex: 0, isWarmup: true })],
    );
    expect(blocks[0].workingSets).toBe(0);
    expect(blocks[0].complete).toBe(false);
  });

  it('re-visiting a planned movement adds to its slot, not a new block', () => {
    const blocks = buildWorkoutBlocks(
      [slot({ id: 's1', exerciseId: 'a', targetSets: 3 })],
      [
        set({ id: '1', exerciseId: 'a', orderIndex: 0 }),
        set({ id: '2', exerciseId: 'z', orderIndex: 1, exerciseName: 'Other' }),
        set({ id: '3', exerciseId: 'a', orderIndex: 2 }),
      ],
    );
    const planned = blocks.filter((b) => b.exerciseId === 'a');
    expect(planned).toHaveLength(1);
    expect(planned[0].workingSets).toBe(2);
  });

  it('appends unplanned exercises after the plan', () => {
    const blocks = buildWorkoutBlocks(
      [slot({ id: 's1', exerciseId: 'a', exerciseName: 'A', orderIndex: 0 })],
      [
        set({ id: '1', exerciseId: 'a', orderIndex: 0 }),
        set({ id: '2', exerciseId: 'extra', exerciseName: 'Cable Curl', orderIndex: 1 }),
      ],
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[1].exerciseName).toBe('Cable Curl');
    expect(blocks[1].planned).toBe(false);
    expect(blocks[1].targetSets).toBeNull();
  });

  it('falls back to plain grouping when there is no plan', () => {
    const blocks = buildWorkoutBlocks(
      [],
      [
        set({ id: '1', exerciseId: 'a', exerciseName: 'A', orderIndex: 0 }),
        set({ id: '2', exerciseId: 'a', exerciseName: 'A', orderIndex: 1 }),
      ],
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].planned).toBe(false);
    expect(blocks[0].workingSets).toBe(2);
  });

  it('computes volume and best e1RM per block', () => {
    const blocks = buildWorkoutBlocks(
      [slot({ id: 's1', exerciseId: 'a' })],
      [
        set({ id: '1', exerciseId: 'a', orderIndex: 0, weight: 100, reps: 10, e1rm: 130 }),
        set({ id: '2', exerciseId: 'a', orderIndex: 1, weight: 100, reps: 8, e1rm: 145 }),
      ],
    );
    expect(blocks[0].volume).toBe(100 * 10 + 100 * 8);
    expect(blocks[0].bestE1rm).toBe(145);
  });
});

describe('planProgress', () => {
  it('sums completed vs target sets across planned blocks only', () => {
    const blocks = buildWorkoutBlocks(
      [
        slot({ id: 's1', exerciseId: 'a', targetSets: 3, orderIndex: 0 }),
        slot({ id: 's2', exerciseId: 'b', targetSets: 2, orderIndex: 1 }),
      ],
      [
        set({ id: '1', exerciseId: 'a', orderIndex: 0 }),
        set({ id: '2', exerciseId: 'adhoc', orderIndex: 1 }),
      ],
    );
    expect(planProgress(blocks)).toEqual({ done: 1, target: 5, complete: false });
  });

  it('does not let extra sets overshoot the target', () => {
    const blocks = buildWorkoutBlocks(
      [slot({ id: 's1', exerciseId: 'a', targetSets: 2 })],
      [
        set({ id: '1', exerciseId: 'a', orderIndex: 0 }),
        set({ id: '2', exerciseId: 'a', orderIndex: 1 }),
        set({ id: '3', exerciseId: 'a', orderIndex: 2 }),
      ],
    );
    expect(planProgress(blocks)).toEqual({ done: 2, target: 2, complete: true });
  });

  it('reports no target for an unplanned session', () => {
    const blocks = buildWorkoutBlocks([], [set({ id: '1', exerciseId: 'a', orderIndex: 0 })]);
    expect(planProgress(blocks)).toEqual({ done: 0, target: 0, complete: false });
  });
});

describe('nextUpBlock', () => {
  it('returns the first planned block still owing sets', () => {
    const blocks = buildWorkoutBlocks(
      [
        slot({ id: 's1', exerciseId: 'a', exerciseName: 'A', targetSets: 1, orderIndex: 0 }),
        slot({ id: 's2', exerciseId: 'b', exerciseName: 'B', targetSets: 2, orderIndex: 1 }),
      ],
      [set({ id: '1', exerciseId: 'a', orderIndex: 0 })],
    );
    expect(nextUpBlock(blocks)?.exerciseName).toBe('B');
  });

  it('is null once the plan is finished', () => {
    const blocks = buildWorkoutBlocks(
      [slot({ id: 's1', exerciseId: 'a', targetSets: 1 })],
      [set({ id: '1', exerciseId: 'a', orderIndex: 0 })],
    );
    expect(nextUpBlock(blocks)).toBeNull();
  });
});

describe('templateDraftFromSets', () => {
  it('lists each exercise once in the order first performed', () => {
    const draft = templateDraftFromSets([
      set({ id: '1', exerciseId: 'bench', exerciseName: 'Bench', orderIndex: 0 }),
      set({ id: '2', exerciseId: 'bench', exerciseName: 'Bench', orderIndex: 1 }),
      set({ id: '3', exerciseId: 'fly', exerciseName: 'Fly', orderIndex: 2 }),
    ]);
    expect(draft.map((d) => d.exerciseName)).toEqual(['Bench', 'Fly']);
    expect(draft[0].targetSets).toBe(2);
    expect(draft[1].targetSets).toBe(1);
  });

  it('keeps an exercise that was only warmed up, with a target of 1', () => {
    const draft = templateDraftFromSets([
      set({ id: '1', exerciseId: 'a', orderIndex: 0, isWarmup: true }),
    ]);
    expect(draft).toHaveLength(1);
    expect(draft[0].targetSets).toBe(1);
  });

  it('is empty for a session with no sets', () => {
    expect(templateDraftFromSets([])).toEqual([]);
  });
});

describe('normalizeTemplateName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTemplateName('  Push   Day 1 ')).toBe('Push Day 1');
  });

  it('rejects empty or overlong names', () => {
    expect(normalizeTemplateName('   ')).toBeNull();
    expect(normalizeTemplateName('x'.repeat(61))).toBeNull();
  });
});
