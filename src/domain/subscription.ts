/**
 * Rust Strength Pro: what the subscription unlocks, and how its status and
 * plans read in the app. Pure, no I/O: RevenueCat itself is wrapped in
 * src/lib/purchases.ts, and these functions take plain shapes that match it.
 *
 * Decided with Rhett (October 2026): only new features are paid. Everything
 * in 1.0 and 1.1 (lifting, running, friends, trophies) stays free. Plans are
 * monthly and yearly; prices and any free trial are set in App Store Connect,
 * and the app shows whatever the store returns.
 */

import type { Feature } from './entitlements';

/** The RevenueCat entitlement that Pro's products grant. */
export const PRO_ENTITLEMENT = 'pro';

export interface ProFeature {
  feature: Feature;
  title: string;
  detail: string;
  /**
   * Whether the feature exists in this build. The paywall lists only these,
   * and with none of them there is nothing to sell, so subscriptions stay off
   * (App Review rejects a subscription to features that aren't there yet).
   * Update the wording when a feature ships, then set this to true.
   */
  available: boolean;
}

export const PRO_FEATURE_LIST: readonly ProFeature[] = [
  {
    feature: 'nutrition',
    title: 'Nutrition tracker',
    detail: 'Log meals and see calories and protein next to your training.',
    available: false,
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
  expirationDate: string | null;
  productIdentifier: string;
}

export interface CustomerInfoLike {
  entitlements: { active: Record<string, EntitlementLike | undefined> };
}

export interface ProStatus {
  active: boolean;
  willRenew: boolean;
  trial: boolean;
  /** When the current period ends; null for a purchase that never expires. */
  expiresAt: string | null;
  productId: string | null;
}

export const NO_PRO: ProStatus = { active: false, willRenew: false, trial: false, expiresAt: null, productId: null };

export function proStatusFrom(info: CustomerInfoLike | null | undefined): ProStatus {
  const e = info?.entitlements.active[PRO_ENTITLEMENT];
  if (!e || !e.isActive) return NO_PRO;
  return {
    active: true,
    willRenew: e.willRenew,
    trial: e.periodType.toUpperCase() === 'TRIAL',
    expiresAt: e.expirationDate,
    productId: e.productIdentifier,
  };
}

/** One line for Profile: "Pro · renews Oct 3, 2027", "Free trial · ends Nov 2". */
export function statusLine(status: ProStatus, formatDate: (iso: string) => string): string {
  if (!status.active) return 'Not subscribed';
  const label = status.trial ? 'Free trial' : 'Pro';
  if (!status.expiresAt) return label;
  const verb = status.willRenew ? (status.trial ? 'then renews' : 'renews') : 'ends';
  return `${label} · ${verb} ${formatDate(status.expiresAt)}`;
}

// --- Plans -----------------------------------------------------------------

export type PlanPeriod = 'month' | 'year';

export interface IntroOffer {
  /** 0 for a free trial. */
  price: number;
  priceString: string;
  /** DAY, WEEK, MONTH or YEAR. */
  periodUnit: string;
  periodNumberOfUnits: number;
  /** How many periods the offer lasts. */
  cycles: number;
}

export interface Plan {
  /** The RevenueCat package identifier, used to buy it. */
  id: string;
  period: PlanPeriod;
  price: number;
  priceString: string;
  intro: IntroOffer | null;
}

/**
 * Whole percent saved by paying yearly instead of twelve months, rounded
 * down so the claim is never more than the truth. Null when there's no saving.
 */
export function yearlySavings(monthlyPrice: number, yearlyPrice: number): number | null {
  if (!(monthlyPrice > 0) || !(yearlyPrice > 0)) return null;
  const percent = Math.floor((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
  return percent >= 1 ? percent : null;
}

function unitWord(unit: string, n: number): string {
  const word = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' }[unit.toUpperCase()] ?? 'period';
  return n === 1 ? word : `${word}s`;
}

/**
 * "1-week free trial", "$0.99 a month for 3 months" (paid each period), "$2.99
 * for 3 months" (paid once), or null without an offer.
 */
export function introLabel(intro: IntroOffer | null): string | null {
  if (!intro) return null;
  const cycles = Math.max(1, intro.cycles);
  const length = intro.periodNumberOfUnits * cycles;
  const span = `${length} ${unitWord(intro.periodUnit, length)}`;
  if (intro.price === 0) return `${length}-${unitWord(intro.periodUnit, 1)} free trial`;
  if (cycles > 1 && intro.periodNumberOfUnits === 1) {
    return `${intro.priceString} a ${unitWord(intro.periodUnit, 1)} for ${span}`;
  }
  return `${intro.priceString} for ${span}`;
}

/** "$59.99 a year". */
export function priceLine(plan: Plan): string {
  return `${plan.priceString} a ${plan.period}`;
}

/**
 * The renewal terms Apple requires near the purchase button: the price and
 * period, that it renews until cancelled, how to cancel, and when payment is
 * taken, including after a free trial.
 */
export function renewalTerms(plan: Plan): string {
  const trial = plan.intro?.price === 0;
  return [
    `Rust Strength Pro renews automatically at ${priceLine(plan)} until you cancel.`,
    trial
      ? 'Payment is charged to your Apple ID when the free trial ends, unless you cancel before then.'
      : 'Payment is charged to your Apple ID when you confirm the purchase.',
    'Cancel any time, at least 24 hours before the current period ends, in Settings > your name > Subscriptions.',
  ].join(' ');
}
