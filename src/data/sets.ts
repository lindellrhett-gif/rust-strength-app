import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { mk, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { toLocalDateString } from '@/lib/dates';
import { newId } from '@/lib/ids';
import type { MuscleGroup, SetRow } from '@/lib/database.types';
import { e1rmFromSet, type LoggedSet } from '@/domain/recommender';
import type { SessionSet } from '@/domain/lastSession';
import type { ProgressSet } from '@/domain/progress';
import { insertSetRow } from './mutationDefaults';
import { useAuth } from '@/providers/AuthProvider';

export interface SetWithRefs extends SetRow {
  exercise: { name: string; muscle_group: MuscleGroup } | null;
  machine: { label: string; increment: number } | null;
}

const SELECT_WITH_REFS =
  '*, exercise:exercises(name, muscle_group), machine:machines(label, increment)';

export function useSetsForWorkout(workoutId: string | undefined) {
  return useQuery({
    queryKey: qk.setsForWorkout(workoutId ?? 'none'),
    enabled: !!workoutId,
    queryFn: async (): Promise<SetWithRefs[]> => {
      const { data, error } = await supabase
        .from('sets')
        .select(SELECT_WITH_REFS)
        .eq('workout_id', workoutId!)
        .order('order_index');
      if (error) throw error;
      return (data ?? []) as unknown as SetWithRefs[];
    },
  });
}

/**
 * Every working set of one exercise, oldest first — feeds the progress chart.
 *
 * Separate from `useExerciseHistory`, which is capped at the last 20 sets
 * because that is all the recommender looks at. A chart wants the whole story,
 * so this asks for far more and drops warmups, which would drag the line down
 * without meaning anything.
 */
export function useExerciseProgress(exerciseId: string | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.exerciseProgress(exerciseId ?? 'none'),
    enabled: !!exerciseId && !!userId,
    queryFn: async (): Promise<ProgressSet[]> => {
      const { data, error } = await supabase
        .from('sets')
        .select('weight, reps, e1rm, performed_at')
        .eq('exercise_id', exerciseId!)
        .eq('is_warmup', false)
        .order('performed_at', { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((s) => ({
        // Grouped by the user's own calendar day, so a late-night session
        // counts as the day they trained rather than the UTC day after.
        date: toLocalDateString(s.performed_at),
        weight: s.weight,
        reps: s.reps,
        e1rm: s.e1rm,
      }));
    },
  });
}

/** A set from an exercise's history: what the recommenders and "last time" read. */
export type HistorySet = LoggedSet & SessionSet;

/** Recent sets for one exercise (any workout) — feeds the recommender. */
export function useExerciseHistory(exerciseId: string | undefined) {
  return useQuery({
    queryKey: qk.exerciseHistory(exerciseId ?? 'none'),
    enabled: !!exerciseId,
    queryFn: async (): Promise<HistorySet[]> => {
      const { data, error } = await supabase
        .from('sets')
        .select(
          'workout_id, weight, reps, rpe, is_warmup, is_bodyweight, machine_id, performed_at, assist_weight, added_weight, duration_seconds',
        )
        .eq('exercise_id', exerciseId!)
        .order('performed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((s) => ({
        workoutId: s.workout_id,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        isWarmup: s.is_warmup,
        isBodyweight: s.is_bodyweight,
        machineId: s.machine_id,
        performedAt: s.performed_at,
        assistWeight: s.assist_weight,
        addedWeight: s.added_weight,
        durationSeconds: s.duration_seconds,
      }));
    },
  });
}

export interface AddSetInput {
  workoutId: string;
  exerciseId: string;
  machineId: string | null;
  weight: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  isBodyweight: boolean;
  /** Assisted exercises: the assistance entered. `weight` is bodyweight minus this. */
  assistWeight?: number | null;
  /** Bodyweight exercises: weight added on top. `weight` is bodyweight plus this. */
  addedWeight?: number | null;
  /** Timed exercises: the hold, in seconds. Such a set is stored as one rep. */
  durationSeconds?: number | null;
  targetRepLow: number;
  targetRepHigh: number;
  orderIndex: number;
}

/**
 * Log a set.
 *
 * Returns `add`, which is deliberately synchronous. Waiting on the network here
 * would mean that in a gym with no signal the Save button spins forever: an
 * offline write is *paused*, not failed, so the promise never settles. Instead
 * the set is written straight into the cache, the screen moves on, and the row
 * reaches the server whenever there is a connection — later in the session, or
 * after the app has been killed and reopened.
 */
export function useAddSet() {
  const { userId } = useAuth();
  const client = useQueryClient();

  const mutation = useMutation({
    mutationKey: mk.addSet,
    mutationFn: insertSetRow,
    onSettled: (_data, _error, row) => {
      client.invalidateQueries({ queryKey: qk.setsForWorkout(row.workout_id) });
      client.invalidateQueries({ queryKey: qk.exerciseHistory(row.exercise_id) });
      client.invalidateQueries({ queryKey: qk.exerciseProgress(row.exercise_id) });
      client.invalidateQueries({ queryKey: qk.totals });
      client.invalidateQueries({ queryKey: qk.prs });
      client.invalidateQueries({ queryKey: ['stats', 'coverage'] });
    },
  });

  const add = useCallback(
    (input: AddSetInput): SetRow => {
      const e1rm = input.isWarmup
        ? 0
        : Math.round(
            e1rmFromSet({ weight: input.weight, reps: input.reps, rpe: input.rpe }) * 10,
          ) / 10;

      const now = new Date().toISOString();
      const row: SetRow = {
        // Generated here so the set can be queued behind a workout that has not
        // reached the server yet, and so a replay cannot duplicate it.
        id: newId(),
        user_id: userId!,
        workout_id: input.workoutId,
        exercise_id: input.exerciseId,
        machine_id: input.machineId,
        weight: input.weight,
        reps: input.reps,
        rpe: input.rpe,
        is_warmup: input.isWarmup,
        is_bodyweight: input.isBodyweight,
        assist_weight: input.assistWeight ?? null,
        added_weight: input.addedWeight ?? null,
        duration_seconds: input.durationSeconds ?? null,
        target_rep_low: input.targetRepLow,
        target_rep_high: input.targetRepHigh,
        e1rm,
        order_index: input.orderIndex,
        performed_at: now,
        created_at: now,
      };

      // Show it immediately, with the exercise and machine names the workout
      // screen renders, looked up from caches the picker already filled.
      const exercise =
        client
          .getQueryData<{ id: string; name: string; muscle_group: MuscleGroup }[]>(qk.exercises)
          ?.find((e) => e.id === input.exerciseId) ?? null;
      const machine =
        client
          .getQueryData<{ id: string; label: string; increment: number }[]>(qk.machines)
          ?.find((m) => m.id === input.machineId) ?? null;

      client.setQueryData<SetWithRefs[]>(qk.setsForWorkout(input.workoutId), (current) => [
        ...(current ?? []),
        {
          ...row,
          exercise: exercise ? { name: exercise.name, muscle_group: exercise.muscle_group } : null,
          machine: machine ? { label: machine.label, increment: machine.increment } : null,
        },
      ]);

      mutation.mutate(row);
      return row;
    },
    [userId, client, mutation],
  );

  return { add, isPending: mutation.isPending, error: mutation.error };
}

export function useDeleteSet(workoutId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (setId: string) => {
      const { error } = await supabase.from('sets').delete().eq('id', setId);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.setsForWorkout(workoutId) });
      client.invalidateQueries({ queryKey: qk.totals });
      client.invalidateQueries({ queryKey: qk.prs });
      client.invalidateQueries({ queryKey: ['sets', 'exercise'] });
      client.invalidateQueries({ queryKey: ['stats', 'coverage'] });
    },
  });
}

/**
 * Recent working sets across ALL exercises, bucketed by exercise id.
 * The workout generator needs history for many movements at once; fetching
 * per-exercise would mean dozens of round trips.
 */
export function useRecentHistoryByExercise(limit = 400) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ['sets', 'recent-by-exercise', limit],
    enabled: !!userId,
    queryFn: async (): Promise<Record<string, LoggedSet[]>> => {
      const { data, error } = await supabase
        .from('sets')
        .select('exercise_id, weight, reps, rpe, is_warmup, machine_id, performed_at')
        .eq('is_warmup', false)
        .order('performed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;

      const out: Record<string, LoggedSet[]> = {};
      for (const s of data ?? []) {
        const list = out[s.exercise_id] ?? (out[s.exercise_id] = []);
        list.push({
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
          isWarmup: s.is_warmup,
          machineId: s.machine_id,
          performedAt: s.performed_at,
        });
      }
      return out;
    },
  });
}
