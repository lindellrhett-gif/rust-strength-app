import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { RestDay } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

export function useRestDays() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.restDays,
    enabled: !!userId,
    queryFn: async (): Promise<RestDay[]> => {
      const { data, error } = await supabase
        .from('rest_days')
        .select('*')
        .order('rest_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Marking a day as rest is idempotent — the unique index means tapping twice
 * on the same date updates the note rather than creating a duplicate.
 */
export function useSetRestDay() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; note?: string | null }) => {
      const { error } = await supabase
        .from('rest_days')
        .upsert(
          {
            user_id: userId!,
            rest_date: input.date,
            note: input.note?.trim() || null,
          },
          { onConflict: 'user_id,rest_date' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.restDays });
      client.invalidateQueries({ queryKey: qk.workoutDates });
    },
  });
}

export function useDeleteRestDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rest_days').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.restDays });
      client.invalidateQueries({ queryKey: qk.workoutDates });
    },
  });
}
