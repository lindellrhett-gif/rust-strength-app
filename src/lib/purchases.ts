/**
 * RevenueCat, for Rust Strength Pro. Everything about money goes through
 * here; the rules about what Pro unlocks are in src/domain/subscription.ts and
 * src/domain/entitlements.ts.
 *
 * Subscriptions are on only with the launch switch (EXPO_PUBLIC_SUBSCRIPTIONS
 * =on) and a key this build can use (EXPO_PUBLIC_REVENUECAT_IOS_KEY):
 *   - a Test Store key (test_) in a development build, to try the paywall
 *     with pretend products before anything is on sale. RevenueCat crashes
 *     any release build that has one, so here it is ignored outside
 *     development, and scripts/check-build-env.js refuses to build with it;
 *   - an App Store key (appl_), once a paid feature exists to sell.
 * Until then the SDK is never started, so nothing at all reaches RevenueCat.
 * Once on, the account id (a random UUID) is the RevenueCat customer id, so
 * purchases follow the account across devices.
 *
 * The paywall is RevenueCat's own, designed in its dashboard; subscribers
 * manage their plan in RevenueCat's Customer Center. Both SDKs load on first
 * use, so an older build without them reports that it needs updating.
 */
import { Platform } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';

import {
  PRO_ENTITLEMENT,
  hasSellableFeatures,
  paywallOutcome,
  proStatusFrom,
  subscriptionsEnabled,
  type PaywallOutcome,
  type ProStatus,
} from '@/domain/subscription';

import { env } from './env';

type PurchasesModule = typeof import('react-native-purchases');
type PurchasesUiModule = typeof import('react-native-purchases-ui');

export const subscriptionsOn = subscriptionsEnabled({
  ios: Platform.OS === 'ios',
  switchOn: env.subscriptionsSwitch,
  key: env.revenueCatIosKey,
  devBuild: __DEV__,
  sellable: hasSellableFeatures(),
});

const UPDATE_APP = 'Update the app to subscribe.';

let sdk: Promise<PurchasesModule> | null = null;
let ui: Promise<PurchasesUiModule> | null = null;
let configuredFor: string | null = null;

function load(): Promise<PurchasesModule> {
  if (!subscriptionsOn) return Promise.reject(new Error('Subscriptions aren’t available yet.'));
  sdk ??= import('react-native-purchases').catch(() => {
    sdk = null;
    throw new Error(UPDATE_APP);
  });
  return sdk;
}

function loadUi(): Promise<PurchasesUiModule> {
  if (!subscriptionsOn) return Promise.reject(new Error('Subscriptions aren’t available yet.'));
  ui ??= import('react-native-purchases-ui').catch(() => {
    ui = null;
    throw new Error(UPDATE_APP);
  });
  return ui;
}

/**
 * Points RevenueCat at this account: configures the SDK the first time (once
 * per app run), then switches customers on sign-in as someone else.
 */
export async function identify(userId: string): Promise<void> {
  if (!subscriptionsOn || configuredFor === userId) return;
  const { default: Purchases, LOG_LEVEL } = await load();
  if (await Purchases.isConfigured()) {
    await Purchases.logIn(userId);
  } else {
    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
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

/** Whether this account has rust_strength_pro, straight from RevenueCat. */
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

/**
 * Shows RevenueCat's paywall for the current offering, unless this account
 * already has Pro. It handles buying, restoring, the Terms and Privacy links
 * and Apple's renewal wording, all set up in the RevenueCat dashboard.
 */
export async function showPaywall(): Promise<PaywallOutcome> {
  const { default: RevenueCatUI } = await loadUi();
  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PRO_ENTITLEMENT,
    displayCloseButton: true,
  });
  return paywallOutcome(String(result));
}

/**
 * RevenueCat's Customer Center: change or cancel the plan, restore, ask for
 * a refund, contact support. It needs a RevenueCat plan that includes it;
 * without one, this falls back to Apple's own subscription settings.
 */
export async function openCustomerCenter(): Promise<void> {
  try {
    const { default: RevenueCatUI } = await loadUi();
    await RevenueCatUI.presentCustomerCenter();
  } catch {
    const { default: Purchases } = await load();
    await Purchases.showManageSubscriptions();
  }
}

/** Restores purchases made on this Apple ID, as Apple requires. */
export async function restore(): Promise<ProStatus> {
  const { default: Purchases } = await load();
  return proStatusFrom(await Purchases.restorePurchases());
}
