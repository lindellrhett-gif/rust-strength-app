import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { toLocalDateString } from '@/lib/dates';
import type { MuscleGroup } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

export interface AllTimeTotals {
  volume: number;
  totalReps: number;
  totalSets: number;
  totalWorkouts: number;
  /** Total time spent training, across all finished workouts. */
  totalSeconds: number;
}

export function useAllTimeTotals() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.totals,
    enabled: !!userId,
    queryFn: async (): Promise<AllTimeTotals> => {
      const { data, error } = await supabase
        .from('v_all_time_totals')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        volume: data?.volume ?? 0,
        totalReps: data?.total_reps ?? 0,
        totalSets: data?.total_sets ?? 0,
        totalWorkouts: data?.total_workouts ?? 0,
        totalSeconds: data?.total_seconds ?? 0,
      };
    },
  });
}

export interface ExercisePR {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  bestE1rm: number;
  bestWeight: number;
  bestReps: number;
}

export function useExercisePRs() {
  return useQuery({
    queryKey: qk.prs,
    queryFn: async (): Promise<ExercisePR[]> => {
      const { data, error } = await supabase
        .from('v_exercise_prs')
        .select('*')
        .order('best_e1rm', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.exercise_id != null)
        .map((r) => ({
          exerciseId: r.exercise_id!,
          exerciseName: r.exercise_name ?? 'Exercise',
          muscleGroup: (r.muscle_group ?? 'core') as MuscleGroup,
          bestE1rm: r.best_e1rm ?? 0,
          bestWeight: r.best_weight ?? 0,
          bestReps: r.best_reps ?? 0,
        }));
    },
  });
}

/** Local calendar dates on which a workout was completed — feeds streak math. */
export function useWorkoutDates() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.workoutDates,
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('started_at, ended_at')
        .not('ended_at', 'is', null);
      if (error) throw error;
      return (data ?? []).map((w) => toLocalDateString(w.started_at));
    },
  });
}

/** Local dates with any activity logged: runs, sports, walks. */
export function useActivityDates() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.activityDates,
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('activities').select('performed_at').eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []).map((a) => toLocalDateString(a.performed_at));
    },
  });
}

/**
 * Every day you trained: a finished workout or any activity, runs included.
 * The streak, best streak, consistency and the streak trophy all count from
 * this. (Before running was added only workouts counted; the server's
 * streak_stats changes to match in migration 0020, applied at release.)
 */
export function useTrainedDates() {
  const workouts = useWorkoutDates();
  const activities = useActivityDates();
  const data = useMemo(
    () => (workouts.data && activities.data ? [...workouts.data, ...activities.data] : undefined),
    [workouts.data, activities.data],
  );
  return {
    data,
    isLoading: workouts.isLoading || activities.isLoading,
    isRefetching: workouts.isRefetching || activities.isRefetching,
    refetch: () => {
      void workouts.refetch();
      void activities.refetch();
    },
  };
}

export interface TodayTotals {
  volume: number;
  sets: number;
  reps: number;
}

/** Set totals for the current local day. */
export function useTodayTotals() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: [...qk.totals, 'today'],
    enabled: !!userId,
    queryFn: async (): Promise<TodayTotals> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('sets')
        .select('weight, reps')
        .gte('performed_at', start.toISOString());
      if (error) throw error;
      let volume = 0;
      let reps = 0;
      for (const s of data ?? []) {
        volume += s.weight * s.reps;
        reps += s.reps;
      }
      return { volume: Math.round(volume), reps, sets: (data ?? []).length };
    },
  });
}

export function useWeeklyCoverage(weekStartDate: string) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.weeklyCoverage(weekStartDate),
    enabled: !!userId,
    queryFn: async (): Promise<Partial<Record<MuscleGroup, number>>> => {
      const { data, error } = await supabase.rpc('rpc_weekly_coverage', {
        week_start: weekStartDate,
      });
      if (error) throw error;
      const out: Partial<Record<MuscleGroup, number>> = {};
      for (const row of data ?? []) out[row.muscle_group] = Number(row.set_count);
      return out;
    },
  });
}


/** Best weight per exercise, keyed by lowercased name — feeds lift trophies. */
export function bestWeightMap(prs: ExercisePR[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pr of prs ?? []) {
    const key = pr.exerciseName.toLowerCase();
    out[key] = Math.max(out[key] ?? 0, pr.bestWeight);
  }
  return out;
}

/** Best reps in one set per exercise — feeds calisthenics trophies. */
export function bestRepsMap(prs: ExercisePR[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pr of prs ?? []) {
    const key = pr.exerciseName.toLowerCase();
    out[key] = Math.max(out[key] ?? 0, pr.bestReps);
  }
  return out;
}

/**
 * Best estimated 1RM per exercise — the input to the XP "personal records"
 * source. Keyed by name and reduced with max, because two exercise rows can
 * share a name (one from the shared library, one the user made).
 */
export function bestE1rmMap(prs: ExercisePR[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pr of prs ?? []) {
    const key = pr.exerciseName.toLowerCase();
    out[key] = Math.max(out[key] ?? 0, pr.bestE1rm);
  }
  return out;
}
