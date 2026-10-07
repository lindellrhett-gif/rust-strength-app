import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { parseRunRow, type RunDetail } from '@/domain/running/detail';
import type { CropInput } from '@/domain/running/edit';
import { forLoad, toHistoryRun, type HistoryRow, type HistoryRun } from '@/domain/running/history';
import { runningLoad, type RunningLoad } from '@/domain/running/load';
import { toLocalDateString, todayLocal } from '@/lib/dates';
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

/** Everything a change to one run can show up in. */
function invalidateRun(client: ReturnType<typeof useQueryClient>, id: string) {
  client.invalidateQueries({ queryKey: qk.run(id) });
  client.invalidateQueries({ queryKey: qk.runs });
  client.invalidateQueries({ queryKey: qk.activities });
  client.invalidateQueries({ queryKey: qk.activityTotals });
  client.invalidateQueries({ queryKey: qk.feed });
}

export interface RunDetailsEdit {
  id: string;
  title: string | null;
  note: string | null;
  effort: number | null;
  /** Leave out to keep as it is. */
  mapVisibility?: 'private' | 'friends';
  shareToFeed?: boolean;
}

/**
 * Title, notes and effort. Needs a connection: an edit is small and easy to
 * try again, and it isn't worth queueing behind a run that hasn't uploaded.
 */
export function useUpdateRunDetails() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (edit: RunDetailsEdit) => {
      const { error } = await supabase.rpc('rpc_update_run_details', {
        p_activity_id: edit.id,
        p_name: edit.title,
        p_note: edit.note,
        p_effort: edit.effort,
        p_map_visibility: edit.mapVisibility ?? null,
        p_share_to_feed: edit.shareToFeed ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, edit) => invalidateRun(client, edit.id),
  });
}

/** Trims a run's start and end (see cropRun in src/domain/running/edit.ts). */
export function useCropRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CropInput) => {
      const { error } = await supabase.rpc('rpc_crop_run', input);
      if (error) throw error;
    },
    onSuccess: (_data, input) => invalidateRun(client, input.p_activity_id),
  });
}

/** Deletes a run. Its route, splits and best efforts go with the activity. */
export function useDeleteRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: qk.run(id) });
      invalidateRun(client, id);
    },
  });
}

/** How many runs the hub loads: years of running for most people. */
const HISTORY_LIMIT = 1000;

/**
 * Every run, newest first: recorded ones with their detail and best efforts,
 * and runs logged by hand before running existed.
 */
export function useRunHistory() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.runHistory,
    enabled: !!userId,
    queryFn: async (): Promise<HistoryRun[]> => {
      const { data, error } = await supabase
        .from('activities')
        .select(
          'id, name, performed_at, distance, distance_unit, duration_seconds, ' +
            'runs(distance_m, moving_seconds, source, effort, run_best_efforts(effort_key, seconds))',
        )
        .eq('user_id', userId!)
        .eq('kind', 'run')
        .order('performed_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw error;
      return ((data ?? []) as unknown as (HistoryRow & { runs: HistoryRow['runs'] | HistoryRow['runs'][] })[])
        .map((row) => ({
          ...row,
          // One detail row per run; older PostgREST versions return it as a list.
          runs: Array.isArray(row.runs) ? (row.runs[0] ?? null) : row.runs,
        }))
        .map((row) => toHistoryRun(row, (iso) => toLocalDateString(iso)))
        .filter((r): r is HistoryRun => r != null);
    },
  });
}

/** Sets or clears the weekly distance goal, in metres. */
export function useSetWeeklyGoal() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (goalM: number | null) => {
      const { error } = await supabase
        .from('run_preferences')
        .upsert(
          { user_id: userId!, weekly_goal_m: goalM, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.runPreferences }),
  });
}

/**
 * How much running someone has done lately (src/domain/running/load.ts):
 * the interface lifting recommendations and the coach will read. Nothing
 * changes a recommendation with it yet.
 */
export function useRunningLoad(): RunningLoad | null {
  const history = useRunHistory();
  return useMemo(() => (history.data ? runningLoad(forLoad(history.data), todayLocal()) : null), [history.data]);
}

/** Settings for running, saved per account. */
export function useUpdateRunPreferences() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (next: RunPreferences) => {
      const { error } = await supabase.from('run_preferences').upsert(
        {
          user_id: userId!,
          auto_pause: next.autoPause,
          audio_cues: next.audioCues,
          share_default: next.shareDefault,
          map_default: next.mapDefault,
          weekly_goal_m: next.weeklyGoalM,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    },
    onMutate: (next) => client.setQueryData(qk.runPreferences, next),
    onSettled: () => client.invalidateQueries({ queryKey: qk.runPreferences }),
  });
}

export interface PrivacyZone {
  id: string;
  label: string | null;
  lat: number;
  lon: number;
  radiusM: number;
}

/** Your privacy zones. Nobody else can read them. */
export function usePrivacyZones() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.privacyZones,
    enabled: !!userId,
    queryFn: async (): Promise<PrivacyZone[]> => {
      const { data, error } = await supabase.rpc('rpc_my_privacy_zones');
      if (error) throw error;
      return (data ?? []).map((z) => ({ id: z.id, label: z.label, lat: z.lat, lon: z.lon, radiusM: z.radius_m }));
    },
  });
}

export function useAddPrivacyZone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (zone: Omit<PrivacyZone, 'id'>) => {
      const { error } = await supabase.rpc('rpc_add_privacy_zone', {
        p_lat: zone.lat,
        p_lon: zone.lon,
        p_radius_m: zone.radiusM,
        p_label: zone.label,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.privacyZones });
      client.invalidateQueries({ queryKey: qk.feed });
    },
  });
}

export function useRemovePrivacyZone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('rpc_remove_privacy_zone', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.privacyZones });
      client.invalidateQueries({ queryKey: qk.feed });
    },
  });
}
