import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncDailySteps } from '@/lib/dailySteps';
import { qk } from '@/lib/queryClient';
import { requestStepAccess } from '@/lib/steps';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

import { useProfile } from './profile';

export interface TrophyTotals {
  runDistanceM: number;
  /** Daily steps shared, ever. */
  stepsTotal: number;
  reactionsReceived: number;
}

/**
 * What the running, steps and reactions trophies are worked out from. The
 * reactions count comes from the server because each reaction is visible only
 * to the person who left it.
 */
export function useMyTrophyTotals() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.trophyTotals,
    enabled: !!userId,
    queryFn: async (): Promise<TrophyTotals> => {
      const { data, error } = await supabase.rpc('rpc_my_trophy_totals');
      if (error) throw error;
      const row = data?.[0];
      return {
        runDistanceM: Number(row?.run_distance_m) || 0,
        stepsTotal: Number(row?.steps_total) || 0,
        reactionsReceived: Number(row?.reactions_received) || 0,
      };
    },
  });
}

/**
 * Turns sharing daily steps on or off. Turning it on asks for Motion &
 * Fitness first and fails if that's refused; turning it off deletes every
 * total already shared.
 */
export function useSetShareSteps() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      if (on && (await requestStepAccess()) !== 'granted') {
        throw new Error('Allow Motion & Fitness for Rust Strength in Settings to share your steps.');
      }
      const { error } = await supabase.rpc('rpc_set_share_steps', { p_on: on });
      if (error) throw error;
      if (on) await syncDailySteps({ force: true });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: qk.profile });
      void client.invalidateQueries({ queryKey: qk.trophyTotals });
      void client.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

/**
 * Keeps shared daily steps up to date: on launch and whenever the app comes
 * back, at most every few minutes, and only while sharing is on.
 */
export function useDailyStepsSync(): void {
  const client = useQueryClient();
  const sharing = useProfile().data?.share_steps === true;
  useEffect(() => {
    if (!sharing) return;
    const run = () => {
      void syncDailySteps().then((uploaded) => {
        if (!uploaded) return;
        void client.invalidateQueries({ queryKey: qk.trophyTotals });
        void client.invalidateQueries({ queryKey: ['leaderboard'] });
      });
    };
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [sharing, client]);
}
