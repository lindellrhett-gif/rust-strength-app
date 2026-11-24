import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Access } from '@/domain/entitlements';
import { NO_PRO, type ProStatus } from '@/domain/subscription';
import {
  forget,
  getProStatus,
  identify,
  onProStatusChange,
  openCustomerCenter,
  restore,
  showPaywall,
  subscriptionsOn,
} from '@/lib/purchases';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Asks the server to read this account's Pro straight from RevenueCat
 * (supabase/functions/sync-subscription). The server checks Pro before it
 * saves anything to the food diary (migration 0039), and RevenueCat's webhook
 * can take a few seconds after a purchase; this closes that gap. It can only
 * ever update the caller's own record, from RevenueCat's own answer.
 */
export async function syncServerPro(): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-subscription', { method: 'POST' });
  if (error) throw error;
}

/** Accounts already synced this run, so a session asks only once. */
const syncedThisRun = new Set<string>();

/**
 * Keeps RevenueCat pointed at the signed-in account, and the cached status
 * current when RevenueCat hears of a change (a renewal, a refund). Mounted
 * once, with the signed-in tabs. Does nothing while subscriptions are off.
 */
export function useSubscriptionIdentity(): void {
  const { userId } = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    if (!subscriptionsOn || !userId) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void identify(userId)
      .then(() => onProStatusChange((status) => client.setQueryData(qk.proStatus, status)))
      .then((unsubscribe) => {
        if (cancelled) unsubscribe();
        else stop = unsubscribe;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
      void forget();
      client.removeQueries({ queryKey: ['subscription'] });
    };
  }, [userId, client]);
}

/** This person's rust_strength_pro status. Never Pro while subscriptions are off. */
export function useProStatus() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.proStatus,
    enabled: subscriptionsOn && !!userId,
    queryFn: async (): Promise<ProStatus> => {
      await identify(userId!);
      const status = await getProStatus();
      // Once a session, in case a webhook went missing. In the background:
      // nothing waits on it, and a failure is tried again next session.
      if (status.active && !syncedThisRun.has(userId!)) {
        syncedThisRun.add(userId!);
        syncServerPro().catch(() => syncedThisRun.delete(userId!));
      }
      return status;
    },
    initialData: subscriptionsOn ? undefined : NO_PRO,
  });
}

/** What hasFeature needs to decide. */
export function useAccess(): Access {
  const status = useProStatus();
  return { subscriptionsOn, pro: status.data?.active === true };
}

/**
 * Shows RevenueCat's paywall (unless the account already has Pro) and
 * refreshes the status after a purchase or restore.
 */
export function useShowPaywall() {
  const { userId } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await identify(userId!);
      const outcome = await showPaywall();
      // Before the diary unlocks, so the first entry isn't refused.
      if (outcome === 'purchased' || outcome === 'restored') await syncServerPro().catch(() => undefined);
      return outcome;
    },
    onSuccess: (outcome) => {
      if (outcome === 'purchased' || outcome === 'restored') {
        void client.invalidateQueries({ queryKey: qk.proStatus });
      }
    },
  });
}

/** Opens RevenueCat's Customer Center, then refreshes the status. */
export function useCustomerCenter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (options?: { lifetime?: boolean }) => openCustomerCenter(options),
    onSettled: () => client.invalidateQueries({ queryKey: qk.proStatus }),
  });
}

export function useRestorePurchases() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const status = await restore();
      if (status.active) await syncServerPro().catch(() => undefined);
      return status;
    },
    onSuccess: (status) => client.setQueryData(qk.proStatus, status),
  });
}
