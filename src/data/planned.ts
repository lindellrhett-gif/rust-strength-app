import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { PlannedSession } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

export function usePlannedSessions() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.planned,
    enabled: !!userId,
    queryFn: async (): Promise<PlannedSession[]> => {
      const { data, error } = await supabase
        .from('planned_sessions')
        .select('*')
        .order('scheduled_for');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePlannedSession() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      scheduledFor: string;
      title: string;
      note?: string;
      /** Optional preset whose exercises load when the session starts. */
      templateId?: string | null;
    }) => {
      const { error } = await supabase.from('planned_sessions').insert({
        user_id: userId!,
        scheduled_for: input.scheduledFor,
        title: input.title.trim() || 'Workout',
        note: input.note?.trim() || null,
        template_id: input.templateId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.planned }),
  });
}

export function useDeletePlannedSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planned_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.planned }),
  });
}
