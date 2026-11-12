import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProfileUpdate } from './mutationDefaults';
import { mk, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

export type { ProfileUpdate };

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
  const client = useQueryClient();
  // Counts this save too: it is still running while these callbacks run.
  const isLastSave = () => client.isMutating({ mutationKey: mk.updateProfile }) === 1;

  return useMutation<void, Error, ProfileUpdate, { previous: Profile | undefined }>({
    // The function itself is registered in mutationDefaults, so a change made
    // with no signal is finished after a restart rather than quietly dropped.
    mutationKey: mk.updateProfile,
    // Shown straight away and undone if the save fails, so a number typed into
    // a row or a flipped switch doesn't snap back while the save is on its way.
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: qk.profile });
      const previous = client.getQueryData<Profile>(qk.profile);
      if (previous) client.setQueryData<Profile>(qk.profile, { ...previous, ...patch } as Profile);
      return { previous };
    },
    onError: (_error, _patch, context) => {
      // With another save still going, this snapshot may hold that one's change
      // or miss it. The refetch once they have all finished puts things right.
      if (context?.previous && isLastSave()) client.setQueryData(qk.profile, context.previous);
    },
    onSettled: () => {
      // Waits for the last one: refetching sooner could bring back an old value
      // over a newer change, like a second equipment chip tapped in quick succession.
      if (isLastSave()) void client.invalidateQueries({ queryKey: qk.profile });
    },
  });
}
