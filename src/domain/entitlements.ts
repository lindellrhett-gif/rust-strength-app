/**
 * Which features this person can use. Every entry point asks here, so the
 * paywall is a change to this one function rather than a hunt through the
 * screens.
 *
 * Only new features are paid (see src/domain/subscription.ts): everything in
 * 1.0 and 1.1, running included, is free for good. Until subscriptions are
 * switched on, the paid features are open to everyone too.
 */

export type Feature = 'running' | 'nutrition' | 'coach';

/** Features that need Rust Strength Pro once subscriptions are on. */
export const PRO_FEATURES: readonly Feature[] = ['nutrition', 'coach'];

export interface Access {
  /** Subscriptions are live in this build (see src/lib/purchases.ts). */
  subscriptionsOn: boolean;
  /** This person has an active Pro subscription. */
  pro: boolean;
}

export const OPEN_ACCESS: Access = { subscriptionsOn: false, pro: false };

export function hasFeature(feature: Feature, access: Access = OPEN_ACCESS): boolean {
  if (!PRO_FEATURES.includes(feature)) return true;
  return !access.subscriptionsOn || access.pro;
}
