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
import { useAuth } from '@/providers/AuthProvider';

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
      return getProStatus();
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
      return showPaywall();
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
    mutationFn: () => openCustomerCenter(),
    onSettled: () => client.invalidateQueries({ queryKey: qk.proStatus }),
  });
}

export function useRestorePurchases() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => restore(),
    onSuccess: (status) => client.setQueryData(qk.proStatus, status),
  });
}
