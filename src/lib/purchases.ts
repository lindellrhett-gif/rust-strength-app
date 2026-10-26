/**
 * RevenueCat, for Rust Strength Pro. Everything about money goes through
 * here; the rules about what Pro unlocks are in src/domain/subscription.ts and
 * src/domain/entitlements.ts.
 *
 * Subscriptions are on only when all three hold:
 *   - the build has the public RevenueCat key (EXPO_PUBLIC_REVENUECAT_IOS_KEY),
 *   - the launch switch is on (EXPO_PUBLIC_SUBSCRIPTIONS=on),
 *   - a paid feature exists to sell (hasSellableFeatures).
 * Until then the SDK is never configured, so nothing at all is sent to
 * RevenueCat. Once on, the person's account id (a random UUID) is the
 * RevenueCat customer id, so purchases follow the account across devices.
 *
 * The SDK loads on first use, like the share card modules, so a build made
 * before it was added reports that it needs updating instead of crashing.
 */
import { Platform } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';

import { hasSellableFeatures, type Plan, type ProStatus, proStatusFrom } from '@/domain/subscription';

import { env } from './env';

type PurchasesModule = typeof import('react-native-purchases');

export const subscriptionsOn =
  Platform.OS === 'ios' && env.subscriptionsSwitch && !!env.revenueCatIosKey && hasSellableFeatures();

let sdk: Promise<PurchasesModule> | null = null;
let configuredFor: string | null = null;

function load(): Promise<PurchasesModule> {
  if (!subscriptionsOn) return Promise.reject(new Error('Subscriptions aren’t available yet.'));
  sdk ??= import('react-native-purchases').catch(() => {
    sdk = null;
    throw new Error('Update the app to subscribe.');
  });
  return sdk;
}

/**
 * Points RevenueCat at this account: configures the SDK the first time, then
 * switches customers on sign-in as someone else. Does nothing while off.
 */
export async function identify(userId: string): Promise<void> {
  if (!subscriptionsOn || configuredFor === userId) return;
  const { default: Purchases } = await load();
  if (await Purchases.isConfigured()) {
    await Purchases.logIn(userId);
  } else {
    Purchases.configure({ apiKey: env.revenueCatIosKey!, appUserID: userId });
  }
  configuredFor = userId;
}

/** Forgets the account on sign-out, so the next person starts clean. */
export async function forget(): Promise<void> {
  if (!subscriptionsOn || configuredFor == null) return;
  const { default: Purchases } = await load();
  configuredFor = null;
  // logOut makes RevenueCat start an anonymous customer; nothing is bought
  // on it, and the next identify() switches straight to the new account.
  await Purchases.logOut().catch(() => undefined);
}

export async function getProStatus(): Promise<ProStatus> {
  const { default: Purchases } = await load();
  return proStatusFrom(await Purchases.getCustomerInfo());
}

/** Calls back whenever RevenueCat learns of a change (a renewal, a refund). */
export async function onProStatusChange(listener: (status: ProStatus) => void): Promise<() => void> {
  const { default: Purchases } = await load();
  const wrapped = (info: CustomerInfo) => listener(proStatusFrom(info));
  Purchases.addCustomerInfoUpdateListener(wrapped);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(wrapped);
  };
}

/** The monthly and yearly plans of the current offering, as the store prices them. */
export async function getPlans(): Promise<Plan[]> {
  const { default: Purchases } = await load();
  const offering = (await Purchases.getOfferings()).current;
  if (!offering) return [];
  const plans: Plan[] = [];
  for (const [pkg, period] of [
    [offering.monthly, 'month'],
    [offering.annual, 'year'],
  ] as const) {
    if (!pkg) continue;
    const intro = pkg.product.introPrice;
    plans.push({
      id: pkg.identifier,
      period,
      price: pkg.product.price,
      priceString: pkg.product.priceString,
      intro: intro
        ? {
            price: intro.price,
            priceString: intro.priceString,
            periodUnit: intro.periodUnit,
            periodNumberOfUnits: intro.periodNumberOfUnits,
            cycles: intro.cycles,
          }
        : null,
    });
  }
  return plans;
}

/**
 * Buys a plan through Apple. Resolves with the new status, or null when the
 * person cancelled Apple's sheet (not an error).
 */
export async function buy(planId: string): Promise<ProStatus | null> {
  const { default: Purchases } = await load();
  const offering = (await Purchases.getOfferings()).current;
  const pkg = offering?.availablePackages.find((p) => p.identifier === planId);
  if (!pkg) throw new Error('That plan isn’t available right now. Try again in a moment.');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return proStatusFrom(customerInfo);
  } catch (e) {
    if (isCancelled(e, Purchases)) return null;
    throw e;
  }
}

/** Restores purchases made on this Apple ID, as Apple requires. */
export async function restore(): Promise<ProStatus> {
  const { default: Purchases } = await load();
  return proStatusFrom(await Purchases.restorePurchases());
}

/** Opens Apple's own subscription management sheet. */
export async function manageSubscription(): Promise<void> {
  const { default: Purchases } = await load();
  await Purchases.showManageSubscriptions();
}

function isCancelled(e: unknown, Purchases: PurchasesModule['default']): boolean {
  if (typeof e !== 'object' || e == null) return false;
  const err = e as { code?: unknown; userCancelled?: unknown };
  return err.userCancelled === true || err.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}
