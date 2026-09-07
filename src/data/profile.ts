import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Database, Profile } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

/** Only the columns a user may change — never user_id or created_at. */
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export function useProfile() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.profile,
    enabled: !!userId,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.profile }),
  });
}
