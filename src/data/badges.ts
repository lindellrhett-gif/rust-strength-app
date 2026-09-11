import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Badge ids awarded to a user by hand (Influencer, Beta Tester).
 *
 * Read-only on purpose. `profile_badges` has a select policy and nothing else,
 * so there is no mutation hook to write here — awarding a badge is an operator
 * action taken through the Supabase SQL editor, not something the app can do.
 *
 * Pass no id for the signed-in user. A friend's badges are readable; a
 * stranger's come back empty rather than erroring.
 */
export function useGrantedBadges(targetUserId?: string) {
  const { userId } = useAuth();
  const id = targetUserId ?? userId ?? undefined;

  return useQuery({
    queryKey: qk.badges(id ?? 'none'),
    enabled: !!id,
    // Badges change roughly never, so there is no reason to keep asking.
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('profile_badges')
        .select('badge_id')
        .eq('user_id', id!)
        .order('granted_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => r.badge_id);
    },
  });
}
