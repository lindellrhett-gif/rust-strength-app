import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LoadType } from '@/domain/loadType';
import { patchToAssisted } from '@/domain/workoutEdit';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Exercise, MuscleGroup } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

import { settleQueuedWrites } from './workouts';

export function useExercises() {
  return useQuery({
    queryKey: qk.exercises,
    queryFn: async (): Promise<Exercise[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateExercise() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      muscleGroup: MuscleGroup;
      loadType: LoadType;
    }): Promise<Exercise> => {
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          user_id: userId!,
          name: input.name.trim(),
          muscle_group: input.muscleGroup,
          load_type: input.loadType,
          // The workout generator filters by equipment; a bodyweight exercise
          // needs none, so it stays eligible whatever the user has with them.
          equipment: input.loadType === 'bodyweight' ? 'bodyweight' : null,
          is_custom: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.exercises }),
  });
}

/**
 * Turns one of the user's own exercises, set up as Weights, into an assisted
 * one, and rewrites the sets already logged on it: the number typed was the
 * assistance, so the load moved is bodyweight minus it (see patchToAssisted).
 *
 * Sets go first and the type last, so a retry after a dropped connection
 * finishes the job: converted sets are no longer Weights sets and are skipped.
 */
export function useConvertToAssisted() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ exerciseId, bodyWeight }: { exerciseId: string; bodyWeight: number }) => {
      // Sets still queued from this session would otherwise miss the rewrite.
      await settleQueuedWrites(client);

      const { data: sets, error } = await supabase
        .from('sets')
        .select('id, weight, reps, rpe, is_warmup, is_bodyweight, assist_weight, added_weight, duration_seconds')
        .eq('user_id', userId!)
        .eq('exercise_id', exerciseId);
      if (error) throw error;

      for (const s of sets ?? []) {
        const patch = patchToAssisted(s, bodyWeight);
        if (!patch) continue;
        const { error: setError } = await supabase.from('sets').update(patch).eq('id', s.id);
        if (setError) throw setError;
      }

      const { data, error: typeError } = await supabase
        .from('exercises')
        .update({ load_type: 'assisted' })
        .eq('id', exerciseId)
        .eq('user_id', userId!)
        .select('id');
      if (typeError) throw typeError;
      if (!data || data.length === 0) throw new Error('Only exercises you created can be changed.');
    },
    onSuccess: () => {
      for (const key of [qk.exercises, ['sets'], ['stats'], ['workout-summary'], qk.feed, ['leaderboard']]) {
        void client.invalidateQueries({ queryKey: key });
      }
    },
  });
}
