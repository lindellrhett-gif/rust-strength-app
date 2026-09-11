import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface FriendEdge {
  id: string;
  otherUserId: string;
  username: string;
  displayName: string | null;
  status: 'pending' | 'accepted';
  /** true when this user sent the request (so it shows as "sent", not "respond"). */
  outgoing: boolean;
}

interface RawRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
}

/**
 * All friendship edges for the signed-in user, with the other party's profile.
 * Two queries rather than a join: the FK points at auth.users, so PostgREST
 * cannot embed `profiles` directly.
 */
export function useFriendships() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.friendships,
    enabled: !!userId,
    queryFn: async (): Promise<FriendEdge[]> => {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status');
      if (error) throw error;

      const rows = (data ?? []) as RawRow[];
      if (rows.length === 0) return [];

      const others = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, username, display_name')
        .in('user_id', others);
      if (pErr) throw pErr;

      const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return rows.map((r) => {
        const otherUserId = r.requester_id === userId ? r.addressee_id : r.requester_id;
        const p = byId.get(otherUserId);
        return {
          id: r.id,
          otherUserId,
          username: p?.username ?? 'unknown',
          displayName: p?.display_name ?? null,
          status: r.status,
          outgoing: r.requester_id === userId,
        };
      });
    },
  });
}

export function useSearchUsers(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...qk.userSearch, trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_search_users', { q: trimmed });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSendFriendRequest() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (addresseeId: string) => {
      const { error } = await supabase
        .from('friendships')
        .insert({ requester_id: userId!, addressee_id: addresseeId });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.friendships }),
  });
}

export function useRespondToRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; accept: boolean }) => {
      if (input.accept) {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted', responded_at: new Date().toISOString() })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('friendships').delete().eq('id', input.id);
        if (error) throw error;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.friendships }),
  });
}

export function useRemoveFriend() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('friendships').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.friendships }),
  });
}

export interface FriendStats {
  userId: string;
  username: string;
  displayName: string | null;
  totalWorkouts: number;
  totalVolume: number;
  totalReps: number;
  totalSets: number;
  totalSeconds: number;
  workoutDates: string[];
  activitySeconds: number;
  activityCount: number;
  activityKinds: number;
  friendCount: number;
}

export function useFriendStats(targetUserId: string | undefined) {
  return useQuery({
    queryKey: qk.friendStats(targetUserId ?? 'none'),
    enabled: !!targetUserId,
    queryFn: async (): Promise<FriendStats | null> => {
      const { data, error } = await supabase.rpc('rpc_friend_stats', {
        target: targetUserId!,
      });
      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) return null;
      return {
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        totalWorkouts: Number(row.total_workouts) || 0,
        totalVolume: Number(row.total_volume) || 0,
        totalReps: Number(row.total_reps) || 0,
        totalSets: Number(row.total_sets) || 0,
        totalSeconds: Number(row.total_seconds) || 0,
        workoutDates: row.workout_dates ?? [],
        activitySeconds: Number(row.activity_seconds) || 0,
        activityCount: Number(row.activity_count) || 0,
        activityKinds: Number(row.activity_kinds) || 0,
        friendCount: Number(row.friend_count) || 0,
      };
    },
  });
}


export interface FriendPRs {
  /** Best weight per exercise, keyed by lowercased exercise name. */
  bestWeight: Record<string, number>;
  /** Best reps in a single set per exercise, keyed by lowercased name. */
  bestReps: Record<string, number>;
  /** Best estimated 1RM per exercise — the XP "personal records" source. */
  bestE1rm: Record<string, number>;
}

/** A friend's per-exercise bests, so their lift trophies render on their profile. */
export function useFriendPRs(targetUserId: string | undefined) {
  return useQuery({
    queryKey: qk.friendPRs(targetUserId ?? 'none'),
    enabled: !!targetUserId,
    queryFn: async (): Promise<FriendPRs> => {
      const { data, error } = await supabase.rpc('rpc_friend_prs', {
        target: targetUserId!,
      });
      if (error) throw error;
      const bestWeight: Record<string, number> = {};
      const bestReps: Record<string, number> = {};
      const bestE1rm: Record<string, number> = {};
      for (const row of data ?? []) {
        const key = (row.exercise_name ?? '').toLowerCase();
        if (!key) continue;
        bestWeight[key] = Math.max(bestWeight[key] ?? 0, Number(row.best_weight) || 0);
        bestReps[key] = Math.max(bestReps[key] ?? 0, Number(row.best_reps) || 0);
        bestE1rm[key] = Math.max(bestE1rm[key] ?? 0, Number(row.best_e1rm) || 0);
      }
      return { bestWeight, bestReps, bestE1rm };
    },
  });
}
