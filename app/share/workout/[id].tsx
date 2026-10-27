import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { EmptyState, LoadingView } from '@/components';
import { SharePreview } from '@/components/share/SharePreview';
import { WorkoutShareCard } from '@/components/share/WorkoutShareCard';
import { useExercises } from '@/data/exercises';
import { useProfile } from '@/data/profile';
import { useSetsForWorkout } from '@/data/sets';
import { useWorkout, useWorkoutSummary } from '@/data/workouts';
import { buildWorkoutCard } from '@/domain/shareCard';
import type { MuscleGroup } from '@/domain/stats';
import { longestHolds, setsByMuscle, summarizeSession } from '@/domain/workoutSummary';

/** The shareable card for one finished workout. */
export default function ShareWorkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkout(id);
  const sets = useSetsForWorkout(id);
  const rows = useWorkoutSummary(id);
  const exercises = useExercises();
  const profile = useProfile();

  const card = useMemo(() => {
    if (!workout.data || !sets.data || !rows.data) return null;
    const groupOf = new Map((exercises.data ?? []).map((e) => [e.id, e.muscle_group as MuscleGroup]));
    const summary = summarizeSession(workout.data.started_at, workout.data.ended_at, sets.data, rows.data);
    const hasRecords = summary.records.length > 0;
    return buildWorkoutCard({
      name: workout.data.name,
      dateLabel: new Date(workout.data.started_at).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      summary,
      unit: profile.data?.unit ?? 'lb',
      setsByGroup: setsByMuscle(sets.data, (exerciseId) => groupOf.get(exerciseId)),
      holds: longestHolds(sets.data),
      // Records take room; the exercise list gives it up.
      maxRecords: 2,
      maxExercises: hasRecords ? 4 : 6,
    });
  }, [workout.data, sets.data, rows.data, exercises.data, profile.data?.unit]);

  if (workout.isLoading || sets.isLoading || rows.isLoading) return <LoadingView />;
  if (!card) return <EmptyState title="Workout not found" message="It may have been deleted." />;

  return <SharePreview renderCard={(ref) => <WorkoutShareCard card={card} ref={ref} />} />;
}
