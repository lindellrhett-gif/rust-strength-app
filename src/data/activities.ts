import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import type { ActivityDraft, ActivityRecord } from '@/domain/activities';
import { useAuth } from '@/providers/AuthProvider';

export function useActivities(limit = 100) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.activities,
    enabled: !!userId,
    queryFn: async (): Promise<ActivityRecord[]> => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        kind: a.kind,
        name: a.name,
        performedAt: a.performed_at,
        durationSeconds: a.duration_seconds,
        distance: a.distance,
        distanceUnit: a.distance_unit,
        steps: a.steps,
        calories: a.calories,
      }));
    },
  });
}

export interface ActivityTotalsRow {
  totalSeconds: number;
  totalActivities: number;
  distinctKinds: number;
}

export function useActivityTotals() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.activityTotals,
    enabled: !!userId,
    queryFn: async (): Promise<ActivityTotalsRow> => {
      const { data, error } = await supabase
        .from('v_activity_totals')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        totalSeconds: Number(data?.total_seconds) || 0,
        totalActivities: Number(data?.total_activities) || 0,
        distinctKinds: Number(data?.distinct_kinds) || 0,
      };
    },
  });
}

export function useLogActivity() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (draft: ActivityDraft & { performedAt?: string }) => {
      const { error } = await supabase.from('activities').insert({
        user_id: userId!,
        kind: draft.kind,
        name: draft.name?.trim() || null,
        duration_seconds: Math.round(draft.durationSeconds),
        distance: draft.distance ?? null,
        distance_unit: draft.distance != null ? (draft.distanceUnit ?? 'mi') : null,
        steps: draft.steps ?? null,
        calories: draft.calories ?? null,
        performed_at: draft.performedAt ?? new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.activities });
      client.invalidateQueries({ queryKey: qk.activityTotals });
    },
  });
}

export function useDeleteActivity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.activities });
      client.invalidateQueries({ queryKey: qk.activityTotals });
    },
  });
}
