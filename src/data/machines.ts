import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Gym, Machine } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

export function useMachines() {
  return useQuery({
    queryKey: qk.machines,
    queryFn: async (): Promise<Machine[]> => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('label');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGyms() {
  return useQuery({
    queryKey: qk.gyms,
    queryFn: async (): Promise<Gym[]> => {
      const { data, error } = await supabase.from('gyms').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateMachine() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      label: string;
      increment: number;
      gymId?: string | null;
    }): Promise<Machine> => {
      const { data, error } = await supabase
        .from('machines')
        .insert({
          user_id: userId!,
          label: input.label.trim(),
          increment: input.increment,
          gym_id: input.gymId ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.machines }),
  });
}
