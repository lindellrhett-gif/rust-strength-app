import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Profile } from '@/lib/database.types';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { LEGAL } from '@/legal/config';
import { useAuth } from '@/providers/AuthProvider';

/** Download everything we hold about the signed-in user. */
export function useExportMyData() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('rpc_export_my_data');
      if (error) throw error;
      return JSON.stringify(data, null, 2);
    },
  });
}

/**
 * Permanent account deletion. The RPC removes the auth user, which cascades to
 * every table, so there is nothing left to sign back in to.
 */
export function useDeleteMyAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rpc_delete_my_account');
      if (error) throw error;
      // The session now points at a user that no longer exists.
      await supabase.auth.signOut();
      client.clear();
    },
  });
}

/** Record that the user accepted the current Terms and confirmed their age. */
export function useAcceptTerms() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You are signed out. Sign in again to continue.');
      const now = new Date().toISOString();
      const accepted = {
        terms_accepted_at: now,
        terms_version: LEGAL.version,
        age_confirmed_at: now,
      };
      // An update that matches no row is not an error to the database, so ask
      // for the row back: without it a failed save looks like a successful one.
      const { data, error } = await supabase
        .from('profiles')
        .update(accepted)
        .eq('user_id', userId)
        .select('user_id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Your agreement could not be saved. Sign out, sign back in and try again.');
      }
      return accepted;
    },
    onSuccess: (accepted) => {
      // Update the cached profile now, so the consent screen goes away without
      // waiting on a refetch, then refetch to be sure it matches the server.
      client.setQueryData<Profile>(qk.profile, (current) =>
        current ? { ...current, ...accepted } : current,
      );
      void client.invalidateQueries({ queryKey: qk.profile });
    },
  });
}

// --- Blocking and reporting ------------------------------------------------

export interface BlockedUser {
  id: string;
  blockedId: string;
  username: string | null;
  createdAt: string;
}

export function useBlockedUsers() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.blockedUsers,
    enabled: !!userId,
    queryFn: async (): Promise<BlockedUser[]> => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id, blocked_id, created_at, blocked:profiles!user_blocks_blocked_id_fkey(username)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as {
        id: string;
        blocked_id: string;
        created_at: string;
        blocked: { username: string } | null;
      }[]).map((r) => ({
        id: r.id,
        blockedId: r.blocked_id,
        username: r.blocked?.username ?? null,
        createdAt: r.created_at,
      }));
    },
  });
}

export function useBlockUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase.rpc('rpc_block_user', { target: targetUserId });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.blockedUsers });
      client.invalidateQueries({ queryKey: qk.friendships });
      client.invalidateQueries({ queryKey: qk.userSearch });
    },
  });
}

export function useUnblockUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (blockRowId: string) => {
      const { error } = await supabase.from('user_blocks').delete().eq('id', blockRowId);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.blockedUsers });
      client.invalidateQueries({ queryKey: qk.userSearch });
    },
  });
}

export type ReportReason =
  | 'harassment'
  | 'impersonation'
  | 'inappropriate_name'
  | 'spam'
  | 'other';

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  harassment: 'Harassment or bullying',
  impersonation: 'Pretending to be someone else',
  inappropriate_name: 'Offensive username or name',
  spam: 'Spam',
  other: 'Something else',
};

export function useReportUser() {
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      reportedId: string;
      reason: ReportReason;
      details?: string;
    }) => {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: userId!,
        reported_id: input.reportedId,
        reason: input.reason,
        details: input.details?.trim()?.slice(0, 1000) || null,
      });
      if (error) throw error;
    },
  });
}
