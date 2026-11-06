import { useMemo } from 'react';

import { useActivities } from './activities';
import { useRestDays } from './restDays';
import { useWorkouts } from './workouts';
import { elapsedSeconds } from '@/domain/duration';
import { buildTimeline } from '@/domain/timeline';

/**
 * One feed of lifting, activities and rest days, newest first: what the
 * calendar reads for the chosen day and the Recent workouts screen lists.
 */
export function useTimeline() {
  const workouts = useWorkouts();
  const activities = useActivities();
  const restDays = useRestDays();
  const timeline = useMemo(
    () =>
      buildTimeline(
        (workouts.data ?? []).map((w) => ({
          id: w.id,
          name: w.name,
          startedAt: w.started_at,
          endedAt: w.ended_at,
          durationSeconds: w.ended_at ? elapsedSeconds(w.started_at, w.ended_at) : 0,
          volume: 0,
          setCount: 0,
        })),
        activities.data ?? [],
        (restDays.data ?? []).map((r) => ({ id: r.id, date: r.rest_date, note: r.note })),
      ),
    [workouts.data, activities.data, restDays.data],
  );
  return {
    timeline,
    isLoading: workouts.isLoading || activities.isLoading || restDays.isLoading,
    isRefetching: workouts.isRefetching || activities.isRefetching || restDays.isRefetching,
    refetch: () => {
      void workouts.refetch();
      void activities.refetch();
      void restDays.refetch();
    },
  };
}
