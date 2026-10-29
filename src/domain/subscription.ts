/**
 * Rust Strength Pro: what it unlocks, and how its status reads in the app.
 * Pure, no I/O: RevenueCat itself is wrapped in src/lib/purchases.ts, and
 * these functions take plain shapes that match it.
 *
 * Decided with Rhett (October 2026): only new features are paid. Everything
 * in 1.0 and 1.1 (lifting, running, friends, trophies) stays free. Pro is
 * sold monthly, yearly, or once for life; prices and any free trial are set
 * in App Store Connect, and the paywall itself is designed in RevenueCat.
 */

import type { Feature } from './entitlements';

/** The RevenueCat entitlement that every Pro product grants. */
export const PRO_ENTITLEMENT = 'rust_strength_pro';

/** RevenueCat product identifiers, as set up in its product catalog. */
export const PRO_PRODUCTS = { monthly: 'monthly', yearly: 'yearly', lifetime: 'lifetime' } as const;

export interface ProFeature {
  feature: Feature;
  title: string;
  detail: string;
  /**
   * Whether the feature exists in this build. With none available there is
   * nothing to sell, so subscriptions stay off with a real App Store key (App
   * Review rejects a subscription to features that aren't there yet). Update
   * the wording when a feature ships, then set this to true.
   */
  available: boolean;
}

export const PRO_FEATURE_LIST: readonly ProFeature[] = [
  {
    feature: 'nutrition',
    title: 'Food diary',
    detail: 'Log meals from a food database or a barcode, and track calories, macros, water and weight.',
    available: true,
  },
  {
    feature: 'coach',
    title: 'AI coach',
    detail: 'Plans and advice built from your own lifting and running.',
    available: false,
  },
];

/** Whether there is anything to sell yet. */
export function hasSellableFeatures(list: readonly ProFeature[] = PRO_FEATURE_LIST): boolean {
  return list.some((f) => f.available);
}

// --- Status ----------------------------------------------------------------

/** The parts of a RevenueCat entitlement the app reads. */
export interface EntitlementLike {
  isActive: boolean;
  willRenew: boolean;
  /** "NORMAL", "TRIAL" or "INTRO". */
  periodType: string;
  /** Null for a lifetime purchase, which never expires. */
  expirationDate: string | null;
  productIdentifier: string;
}

export interface CustomerInfoLike {
  entitlements: { active: Record<string, EntitlementLike | undefined> };
}

export interface ProStatus {
  active: boolean;
  /** Bought once, for life: no renewal, nothing to manage. */
  lifetime: boolean;
  willRenew: boolean;
  trial: boolean;
  /** When the current period ends; null for lifetime. */
  expiresAt: string | null;
  productId: string | null;
}

export const NO_PRO: ProStatus = {
  active: false,
  lifetime: false,
  willRenew: false,
  trial: false,
  expiresAt: null,
  productId: null,
};

export function proStatusFrom(info: CustomerInfoLike | null | undefined): ProStatus {
  const e = info?.entitlements.active[PRO_ENTITLEMENT];
  if (!e || !e.isActive) return NO_PRO;
  return {
    active: true,
    lifetime: e.expirationDate == null,
    willRenew: e.willRenew,
    trial: e.periodType.toUpperCase() === 'TRIAL',
    expiresAt: e.expirationDate,
    productId: e.productIdentifier,
  };
}

/** One line for Profile: "Pro · renews Oct 3, 2027", "Pro · lifetime". */
export function statusLine(status: ProStatus, formatDate: (iso: string) => string): string {
  if (!status.active) return 'Not subscribed';
  if (status.lifetime || !status.expiresAt) return 'Pro · lifetime';
  const label = status.trial ? 'Free trial' : 'Pro';
  const verb = status.willRenew ? (status.trial ? 'then renews' : 'renews') : 'ends';
  return `${label} · ${verb} ${formatDate(status.expiresAt)}`;
}

// --- Paywall ---------------------------------------------------------------

/** How a paywall ended, in the app's terms. */
export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'not-needed' | 'error';

/** RevenueCat's PAYWALL_RESULT values, mapped. Unknown values count as cancelled. */
export function paywallOutcome(result: string): PaywallOutcome {
  switch (result) {
    case 'PURCHASED':
      return 'purchased';
    case 'RESTORED':
      return 'restored';
    case 'NOT_PRESENTED':
      return 'not-needed';
    case 'ERROR':
      return 'error';
    default:
      return 'cancelled';
  }
}

// --- Keys ------------------------------------------------------------------

/**
 * Which RevenueCat key the build has. A Test Store key (test_) sells
 * pretend products with no App Store involved, for development; RevenueCat's
 * SDK deliberately crashes a release build that uses one (TestFlight counts),
 * so it is only ever used in a development build.
 */
export type KeyKind = 'none' | 'test-store' | 'app-store' | 'other';

export function keyKind(key: string | null | undefined): KeyKind {
  if (!key) return 'none';
  if (key.startsWith('test_')) return 'test-store';
  if (key.startsWith('appl_')) return 'app-store';
  return 'other';
}

/**
 * Whether subscriptions are on: the launch switch, a key this build can use,
 * and either something real to sell (App Store key) or a development build
 * on the Test Store, where the paywall can be tried before any feature exists.
 */
export function subscriptionsEnabled(input: {
  ios: boolean;
  switchOn: boolean;
  key: string | null | undefined;
  devBuild: boolean;
  sellable: boolean;
}): boolean {
  if (!input.ios || !input.switchOn) return false;
  switch (keyKind(input.key)) {
    case 'test-store':
      return input.devBuild;
    case 'app-store':
      return input.sellable;
    default:
      return false;
  }
}
