import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LatLon } from '@/domain/running/geo';
import { decodePolyline } from '@/domain/running/polyline';
import type { Attempt } from '@/domain/running/routes';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface SavedRouteSummary {
  id: string;
  name: string;
  distanceM: number;
  attempts: number;
  bestSeconds: number | null;
  lastRunAt: string | null;
  outline: LatLon[] | null;
}

export interface SavedRoute {
  id: string;
  name: string;
  distanceM: number;
  line: LatLon[];
  attempts: Attempt[];
}

const decode = (encoded: string | null): LatLon[] | null => {
  if (!encoded) return null;
  try {
    return decodePolyline(encoded);
  } catch {
    return null;
  }
};

/** Your saved routes, newest first, with attempts and best times. */
export function useSavedRoutes() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.savedRoutes,
    enabled: !!userId,
    queryFn: async (): Promise<SavedRouteSummary[]> => {
      const { data, error } = await supabase.rpc('rpc_saved_routes');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        distanceM: r.distance_m,
        attempts: r.attempts,
        bestSeconds: r.best_seconds,
        lastRunAt: r.last_run_at,
        outline: decode(r.outline),
      }));
    },
  });
}

/** One route with its full line and every attempt. */
export function useSavedRoute(id: string | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.savedRoute(id ?? ''),
    enabled: !!userId && !!id,
    queryFn: async (): Promise<SavedRoute | null> => {
      const [route, attempts] = await Promise.all([
        supabase.rpc('rpc_saved_route', { p_id: id! }),
        supabase.rpc('rpc_route_attempts', { p_id: id! }),
      ]);
      if (route.error) throw route.error;
      if (attempts.error) throw attempts.error;
      const row = route.data?.[0];
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        distanceM: row.distance_m,
        line: decode(row.polyline) ?? [],
        attempts: (attempts.data ?? []).map((a) => ({
          activityId: a.activity_id,
          performedAt: a.performed_at,
          name: a.name,
          movingSeconds: a.moving_seconds,
          distanceM: a.distance_m,
        })),
      };
    },
  });
}

function invalidateRoutes(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: qk.savedRoutes });
  client.invalidateQueries({ queryKey: qk.runs });
}

/** Saves a run's route under a name; the run becomes its first attempt. */
export function useSaveRoute() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, name }: { runId: string; name: string }) => {
      const { data, error } = await supabase.rpc('rpc_save_route', { p_activity_id: runId, p_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateRoutes(client),
  });
}

/** Links a run to one of your routes, or unlinks it (null). */
export function useSetRunRoute() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, routeId }: { runId: string; routeId: string | null }) => {
      const { error } = await supabase.rpc('rpc_set_run_route', { p_activity_id: runId, p_route_id: routeId });
      if (error) throw error;
    },
    onSuccess: () => invalidateRoutes(client),
  });
}

export function useRenameRoute() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('saved_routes').update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateRoutes(client),
  });
}

/** Deletes a route. Its runs stay, no longer linked to it. */
export function useDeleteRoute() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      client.removeQueries({ queryKey: qk.savedRoute(id) });
      invalidateRoutes(client);
    },
  });
}
