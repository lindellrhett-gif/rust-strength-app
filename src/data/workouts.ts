import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { mk, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { newId } from '@/lib/ids';
import type { Workout } from '@/lib/database.types';
import type { SetPatch } from '@/domain/workoutEdit';
import { endWorkoutRow, insertWorkoutRow } from './mutationDefaults';
import { useAuth } from '@/providers/AuthProvider';

export function useOpenWorkout() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.openWorkout,
    enabled: !!userId,
    queryFn: async (): Promise<Workout | null> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useWorkouts() {
  return useQuery({
    queryKey: qk.workouts,
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * One session. `data` is null only when the server answered and has no such
 * workout; a failed request is an error, so a screen can tell "gone" from
 * "could not reach it".
 */
export function useWorkout(id: string | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: qk.workout(id ?? 'none'),
    enabled: !!id,
    queryFn: async (): Promise<Workout | null> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // Resuming from Home: the open session is already cached, so start from
    // it. It stays on screen even if the refetch fails, rather than an error.
    initialData: () => {
      const open = client.getQueryData<Workout | null>(qk.openWorkout);
      return open && open.id === id ? open : undefined;
    },
    initialDataUpdatedAt: () => client.getQueryState(qk.openWorkout)?.dataUpdatedAt,
  });
}

/**
 * Start a session.
 *
 * `start` returns the workout straight away rather than awaiting the insert.
 * With no signal the write is paused rather than failed, so awaiting it would
 * leave the Start button spinning in exactly the place people need it most.
 * The id is generated on the phone, which is what lets sets be logged against
 * a session the server has not heard about yet.
 */
export function useStartWorkout() {
  const { userId } = useAuth();
  const client = useQueryClient();

  const mutation = useMutation({
    mutationKey: mk.startWorkout,
    mutationFn: insertWorkoutRow,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.openWorkout });
      client.invalidateQueries({ queryKey: qk.workouts });
    },
  });

  const start = useCallback(
    (name?: string | null): Workout => {
      // One open session per user is a database constraint, so reuse whatever
      // is already open rather than racing it.
      const open = client.getQueryData<Workout | null>(qk.openWorkout);
      if (open) return open;

      const now = new Date().toISOString();
      const row: Workout = {
        id: newId(),
        user_id: userId!,
        started_at: now,
        ended_at: null,
        note: null,
        name: name?.trim() || null,
        created_at: now,
      };

      client.setQueryData(qk.openWorkout, row);
      client.setQueryData(qk.workout(row.id), row);
      mutation.mutate(row);
      return row;
    },
    [userId, client, mutation],
  );

  return { start, isPending: mutation.isPending, error: mutation.error };
}

/**
 * Finish a session.
 *
 * The end time is stamped when Finish is tapped, not when the write reaches the
 * server, so a session finished with no signal still records the length it
 * actually was rather than however long the phone took to find a bar of
 * reception.
 */
export function useEndWorkout() {
  const client = useQueryClient();

  const mutation = useMutation({
    mutationKey: mk.endWorkout,
    mutationFn: endWorkoutRow,
    onSettled: (_data, _error, input) => {
      client.invalidateQueries({ queryKey: qk.openWorkout });
      client.invalidateQueries({ queryKey: qk.workouts });
      client.invalidateQueries({ queryKey: qk.workout(input.id) });
      client.invalidateQueries({ queryKey: qk.totals });
      client.invalidateQueries({ queryKey: qk.workoutDates });
      // The finished session is now a post of its own.
      client.invalidateQueries({ queryKey: qk.feed });
    },
  });

  const end = useCallback(
    (id: string): void => {
      const endedAt = new Date().toISOString();
      client.setQueryData<Workout | null>(qk.workout(id), (current) =>
        current ? { ...current, ended_at: endedAt } : current,
      );
      client.setQueryData(qk.openWorkout, null);
      mutation.mutate({ id, endedAt });
    },
    [client, mutation],
  );

  return { end, isPending: mutation.isPending, error: mutation.error };
}

/**
 * Everything derived from logged training, refreshed after a workout is edited
 * or deleted: history, totals, records, streaks, the weight recommendations'
 * set history, the feed and the leaderboard.
 */
function refreshTrainingData(client: QueryClient, workoutId: string): void {
  for (const key of [
    ['workouts'],
    ['sets'],
    ['stats'],
    qk.feed,
    ['leaderboard'],
    qk.workoutSummary(workoutId),
    qk.workoutExercises(workoutId),
  ]) {
    void client.invalidateQueries({ queryKey: key });
  }
}

/**
 * Delete a workout, from history or by cancelling one in progress. Its sets
 * go with it (the database cascades), so they stop counting toward totals,
 * records, streaks and the next weight suggestion.
 */
export function useDeleteWorkout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // No row deleted is fine: a session cancelled before it ever reached
      // the server has nothing there to remove.
      const { error } = await supabase.from('workouts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      // Drop the cached copies straight away, so nothing shows the deleted
      // session while the refetches run.
      client.removeQueries({ queryKey: qk.workout(id) });
      client.removeQueries({ queryKey: qk.setsForWorkout(id) });
      refreshTrainingData(client, id);
    },
  });
}

export interface WorkoutReview {
  id: string;
  name: string | null;
  endedAt: string;
  /** Only the sets that changed, with every column to write. */
  sets: { id: string; patch: SetPatch }[];
}

/** Wait (briefly) for writes still queued from the session to reach the server. */
async function settleQueuedWrites(client: QueryClient, timeoutMs = 10_000): Promise<void> {
  void client.resumePausedMutations();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const busy =
      client.isMutating({ mutationKey: mk.startWorkout }) +
      client.isMutating({ mutationKey: mk.addSet }) +
      client.isMutating({ mutationKey: mk.endWorkout });
    if (busy === 0) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Your workout is still syncing. Check your connection and try again.');
}

/**
 * Save the review of a finished workout: its name, its length (as an end
 * time) and any sets whose weight or reps were corrected.
 *
 * Waits for the session's own queued writes first. Otherwise a Finish sent
 * with no signal could land after this and put the old end time back, and an
 * edit to a set the server has not received yet would change nothing.
 */
export function useSaveWorkoutReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (review: WorkoutReview) => {
      await settleQueuedWrites(client);

      const { data, error } = await supabase
        .from('workouts')
        .update({ name: review.name, ended_at: review.endedAt })
        .eq('id', review.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('That workout could not be found.');

      for (const s of review.sets) {
        const { error: setError } = await supabase.from('sets').update(s.patch).eq('id', s.id);
        if (setError) throw setError;
      }
    },
    onSuccess: (_data, review) => {
      client.setQueryData<Workout | null>(qk.workout(review.id), (current) =>
        current ? { ...current, name: review.name, ended_at: review.endedAt } : current,
      );
      refreshTrainingData(client, review.id);
    },
  });
}

export interface WorkoutSummaryRow {
  exerciseId: string;
  exerciseName: string;
  workingSets: number;
  volume: number;
  bestWeight: number;
  bestReps: number;
  bestE1rm: number;
  prevBestWeight: number | null;
  prevBestE1rm: number | null;
  isWeightPr: boolean;
  isE1rmPr: boolean;
}

/** Per-exercise bests for a session, with the marks they had to beat. */
export function useWorkoutSummary(workoutId: string | undefined) {
  return useQuery({
    queryKey: qk.workoutSummary(workoutId ?? 'none'),
    enabled: !!workoutId,
    queryFn: async (): Promise<WorkoutSummaryRow[]> => {
      const { data, error } = await supabase.rpc('rpc_workout_summary', {
        p_workout_id: workoutId!,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        exerciseId: r.exercise_id,
        exerciseName: r.exercise_name,
        workingSets: Number(r.working_sets) || 0,
        volume: Number(r.volume) || 0,
        bestWeight: Number(r.best_weight) || 0,
        bestReps: Number(r.best_reps) || 0,
        bestE1rm: Number(r.best_e1rm) || 0,
        prevBestWeight: r.prev_best_weight == null ? null : Number(r.prev_best_weight),
        prevBestE1rm: r.prev_best_e1rm == null ? null : Number(r.prev_best_e1rm),
        isWeightPr: !!r.is_weight_pr,
        isE1rmPr: !!r.is_e1rm_pr,
      }));
    },
  });
}
