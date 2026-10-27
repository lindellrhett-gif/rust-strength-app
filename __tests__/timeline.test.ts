import {
  buildTimeline,
  entriesOn,
  workoutTitle,
  DEFAULT_WORKOUT_NAME,
  type TimelineWorkout,
  type TimelineRest,
} from '@/domain/timeline';
import type { ActivityRecord } from '@/domain/activities';

function workout(partial: Partial<TimelineWorkout> = {}): TimelineWorkout {
  return {
    id: 'w1',
    name: null,
    startedAt: '2026-09-07T10:00:00.000Z',
    endedAt: '2026-09-07T11:00:00.000Z',
    durationSeconds: 3600,
    volume: 12000,
    setCount: 15,
    ...partial,
  };
}

function activity(partial: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: 'a1',
    kind: 'run',
    name: null,
    performedAt: '2026-09-07T08:00:00.000Z',
    durationSeconds: 1800,
    distance: null,
    distanceUnit: null,
    steps: null,
    calories: null,
    ...partial,
  };
}

function rest(partial: Partial<TimelineRest> = {}): TimelineRest {
  return { id: 'r1', date: '2026-09-06', note: null, ...partial };
}

describe('workoutTitle', () => {
  it('uses the preset name when there is one', () => {
    expect(workoutTitle('Push Day 1')).toBe('Push Day 1');
  });

  it('falls back to "Workout" for an ad-hoc session', () => {
    expect(workoutTitle(null)).toBe(DEFAULT_WORKOUT_NAME);
    expect(workoutTitle('')).toBe('Workout');
    expect(workoutTitle('   ')).toBe('Workout');
  });
});

describe('buildTimeline', () => {
  it('names workouts after the preset that started them', () => {
    const [entry] = buildTimeline([workout({ name: 'Push Day 1' })], [], []);
    expect(entry.title).toBe('Push Day 1');
    expect(entry.kind).toBe('workout');
    expect(entry.workoutId).toBe('w1');
  });

  it('names activities after the kind, or their custom name', () => {
    const entries = buildTimeline(
      [],
      [
        activity({ id: 'a1', kind: 'run', name: null }),
        activity({ id: 'a2', kind: 'soccer', name: '5-a-side' }),
      ],
      [],
    );
    const titles = entries.map((e) => e.title);
    expect(titles).toContain('Run');
    expect(titles).toContain('5-a-side');
  });

  it('links a recorded run to its detail page, and leaves other activities unlinked', () => {
    const entries = buildTimeline(
      [],
      [activity({ id: 'run1', kind: 'run', hasRunDetail: true }), activity({ id: 'old', kind: 'run' })],
      [],
    );
    expect(entries.find((e) => e.id === 'activity-run1')?.runId).toBe('run1');
    expect(entries.find((e) => e.id === 'activity-old')?.runId).toBeUndefined();
  });

  it('includes rest days', () => {
    const [entry] = buildTimeline([], [], [rest()]);
    expect(entry.kind).toBe('rest');
    expect(entry.title).toBe('Rest day');
    expect(entry.detail).toBe('Streak kept');
  });

  it('shows a rest day note when there is one', () => {
    const [entry] = buildTimeline([], [], [rest({ note: 'Sore shoulder' })]);
    expect(entry.detail).toBe('Sore shoulder');
  });

  it('leaves out workouts that have not finished', () => {
    const entries = buildTimeline([workout({ endedAt: null })], [], []);
    expect(entries).toEqual([]);
  });

  it('merges all three sources newest first', () => {
    const entries = buildTimeline(
      [workout({ id: 'w1', startedAt: '2026-09-05T10:00:00.000Z', endedAt: '2026-09-05T11:00:00.000Z' })],
      [activity({ id: 'a1', performedAt: '2026-09-07T08:00:00.000Z' })],
      [rest({ id: 'r1', date: '2026-09-06' })],
    );
    expect(entries.map((e) => e.kind)).toEqual(['activity', 'rest', 'workout']);
  });

  it('sorts a rest day below work actually done the same day', () => {
    const entries = buildTimeline(
      [],
      [activity({ id: 'a1', performedAt: '2026-09-06T09:00:00.000Z' })],
      [rest({ id: 'r1', date: '2026-09-06' })],
    );
    expect(entries.map((e) => e.kind)).toEqual(['activity', 'rest']);
  });

  it('summarises a workout by volume and sets', () => {
    const [entry] = buildTimeline([workout({ volume: 12000, setCount: 15 })], [], [], 'lb');
    expect(entry.detail).toBe('12,000 lb · 15 sets');
  });

  it('summarises an activity by its recorded metrics', () => {
    const [entry] = buildTimeline(
      [],
      [activity({ distance: 3.2, distanceUnit: 'mi', calories: 410 })],
      [],
    );
    expect(entry.detail).toBe('3.2 mi · 410 cal');
  });

  it('respects the display unit', () => {
    const [entry] = buildTimeline([workout({ volume: 500, setCount: 1 })], [], [], 'kg');
    expect(entry.detail).toContain('kg');
  });

  it('is empty when nothing has been logged', () => {
    expect(buildTimeline([], [], [])).toEqual([]);
  });
});

describe('entriesOn', () => {
  it('filters to a single local date', () => {
    const entries = buildTimeline(
      [workout({ id: 'w1', startedAt: '2026-09-05T10:00:00.000Z', endedAt: '2026-09-05T11:00:00.000Z' })],
      [],
      [rest({ id: 'r1', date: '2026-09-06' })],
    );
    expect(entriesOn(entries, '2026-09-06').map((e) => e.kind)).toEqual(['rest']);
    expect(entriesOn(entries, '2026-01-01')).toEqual([]);
  });
});
