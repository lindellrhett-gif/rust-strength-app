import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Exercise, MuscleGroup } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

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
    mutationFn: async (input: { name: string; muscleGroup: MuscleGroup }): Promise<Exercise> => {
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          user_id: userId!,
          name: input.name.trim(),
          muscle_group: input.muscleGroup,
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
