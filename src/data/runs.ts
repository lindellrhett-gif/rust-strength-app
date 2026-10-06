import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { parseRunRow, type RunDetail } from '@/domain/running/detail';
import { mk, qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

import { saveRunRow } from './mutationDefaults';

export interface RunPreferences {
  autoPause: boolean;
  audioCues: boolean;
  /** Post finished runs to the friends feed by default. */
  shareDefault: boolean;
  /** Whether friends see the map of a shared run. Stats only unless changed. */
  mapDefault: 'private' | 'friends';
  weeklyGoalM: number | null;
}

/** Used until the runner changes a setting (there is no row until then). */
export const DEFAULT_RUN_PREFERENCES: RunPreferences = {
  autoPause: true,
  audioCues: true,
  shareDefault: true,
  mapDefault: 'private',
  weeklyGoalM: null,
};

export function useRunPreferences() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.runPreferences,
    enabled: !!userId,
    queryFn: async (): Promise<RunPreferences> => {
      const { data, error } = await supabase
        .from('run_preferences')
        .select('auto_pause, audio_cues, share_default, map_default, weekly_goal_m')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_RUN_PREFERENCES;
      return {
        autoPause: data.auto_pause,
        audioCues: data.audio_cues,
        shareDefault: data.share_default,
        mapDefault: data.map_default,
        weeklyGoalM: data.weekly_goal_m,
      };
    },
  });
}

/**
 * Saves a finished run. Registered as a mutation default (mutationDefaults.ts)
 * so a save made with no signal is queued, survives the app closing, and is
 * sent when the connection returns.
 */
export function useSaveRun() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: mk.saveRun,
    mutationFn: saveRunRow,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.activities });
      client.invalidateQueries({ queryKey: qk.activityTotals });
      client.invalidateQueries({ queryKey: qk.runs });
      client.invalidateQueries({ queryKey: qk.feed });
    },
  });
}

/** One of your own runs, with its route. Another person's id finds nothing. */
export function useRun(id: string | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.run(id ?? ''),
    enabled: !!userId && !!id,
    queryFn: async (): Promise<RunDetail | null> => {
      const { data, error } = await supabase.rpc('rpc_get_run', { p_activity_id: id! });
      if (error) throw error;
      const row = data?.[0];
      return row ? parseRunRow(row) : null;
    },
  });
}
