import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Workout } from '@/lib/database.types';
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

export function useWorkout(id: string | undefined) {
  return useQuery({
    queryKey: qk.workout(id ?? 'none'),
    enabled: !!id,
    queryFn: async (): Promise<Workout> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useStartWorkout() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { name?: string | null }): Promise<Workout> => {
      // Reuse an already-open session if one exists (unique index enforces one).
      const existing = await supabase
        .from('workouts')
        .select('*')
        .is('ended_at', null)
        .maybeSingle();
      if (existing.data) return existing.data;

      const { data, error } = await supabase
        .from('workouts')
        .insert({ user_id: userId!, name: input?.name?.trim() || null })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.openWorkout });
      client.invalidateQueries({ queryKey: qk.workouts });
    },
  });
}

export function useEndWorkout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workouts')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: qk.openWorkout });
      client.invalidateQueries({ queryKey: qk.workouts });
      client.invalidateQueries({ queryKey: qk.workout(id) });
      client.invalidateQueries({ queryKey: qk.totals });
      client.invalidateQueries({ queryKey: qk.workoutDates });
    },
  });
}

export function useDeleteWorkout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.openWorkout });
      client.invalidateQueries({ queryKey: qk.workouts });
      client.invalidateQueries({ queryKey: qk.totals });
      client.invalidateQueries({ queryKey: qk.workoutDates });
      client.invalidateQueries({ queryKey: qk.prs });
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
