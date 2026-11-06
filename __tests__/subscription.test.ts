import { OPEN_ACCESS, PRO_FEATURES, hasFeature } from '../src/domain/entitlements';
import {
  NO_PRO,
  PRO_ENTITLEMENT,
  PRO_FEATURE_LIST,
  hasSellableFeatures,
  keyKind,
  paywallOutcome,
  proStatusFrom,
  statusLine,
  subscriptionsEnabled,
  type EntitlementLike,
} from '../src/domain/subscription';

describe('hasFeature', () => {
  it('keeps everything from 1.0 and 1.1 free, subscribed or not', () => {
    expect(hasFeature('running')).toBe(true);
    expect(hasFeature('running', { subscriptionsOn: true, pro: false })).toBe(true);
  });

  it('opens paid features to everyone until subscriptions are on', () => {
    for (const f of PRO_FEATURES) expect(hasFeature(f, OPEN_ACCESS)).toBe(true);
  });

  it('needs Pro for paid features once subscriptions are on', () => {
    expect(hasFeature('coach', { subscriptionsOn: true, pro: false })).toBe(false);
    expect(hasFeature('coach', { subscriptionsOn: true, pro: true })).toBe(true);
  });

  it('describes every paid feature', () => {
    expect(PRO_FEATURE_LIST.map((f) => f.feature).sort()).toEqual([...PRO_FEATURES].sort());
  });
});

describe('hasSellableFeatures', () => {
  it('sells nothing until a paid feature exists', () => {
    expect(hasSellableFeatures(PRO_FEATURE_LIST.map((f) => ({ ...f, available: false })))).toBe(false);
    expect(hasSellableFeatures([{ ...PRO_FEATURE_LIST[0], available: true }])).toBe(true);
  });

  it('has the food diary to sell from 1.2, and not the coach yet', () => {
    expect(PRO_FEATURE_LIST.find((f) => f.feature === 'nutrition')?.available).toBe(true);
    expect(PRO_FEATURE_LIST.find((f) => f.feature === 'coach')?.available).toBe(false);
    expect(hasSellableFeatures()).toBe(true);
  });
});

describe('proStatusFrom', () => {
  const pro = (over: Partial<EntitlementLike> = {}): EntitlementLike => ({
    isActive: true,
    willRenew: true,
    periodType: 'NORMAL',
    expirationDate: '2027-10-03T12:00:00Z',
    productIdentifier: 'yearly',
    ...over,
  });

  it('reads the rust_strength_pro entitlement', () => {
    expect(PRO_ENTITLEMENT).toBe('rust_strength_pro');
    expect(proStatusFrom({ entitlements: { active: { rust_strength_pro: pro() } } })).toEqual({
      active: true,
      lifetime: false,
      willRenew: true,
      trial: false,
      expiresAt: '2027-10-03T12:00:00Z',
      productId: 'yearly',
    });
  });

  it('knows a lifetime purchase never expires', () => {
    const s = proStatusFrom({
      entitlements: { active: { rust_strength_pro: pro({ expirationDate: null, willRenew: false, productIdentifier: 'lifetime' }) } },
    });
    expect(s.active && s.lifetime).toBe(true);
  });

  it('spots a free trial', () => {
    expect(proStatusFrom({ entitlements: { active: { rust_strength_pro: pro({ periodType: 'TRIAL' }) } } }).trial).toBe(true);
  });

  it('is not Pro without the entitlement, or before RevenueCat answers', () => {
    expect(proStatusFrom({ entitlements: { active: {} } })).toEqual(NO_PRO);
    expect(proStatusFrom({ entitlements: { active: { pro: pro() } } })).toEqual(NO_PRO);
    expect(proStatusFrom(null)).toEqual(NO_PRO);
  });
});

describe('statusLine', () => {
  const date = (iso: string) => iso.slice(0, 10);
  const base = { ...NO_PRO, active: true, expiresAt: '2027-10-03T00:00:00Z', productId: 'yearly' };

  it('says when it renews or ends, that a trial converts, or that it is for life', () => {
    expect(statusLine({ ...base, willRenew: true }, date)).toBe('Pro · renews 2027-10-03');
    expect(statusLine({ ...base, willRenew: false }, date)).toBe('Pro · ends 2027-10-03');
    expect(statusLine({ ...base, willRenew: true, trial: true }, date)).toBe('Free trial · then renews 2027-10-03');
    expect(statusLine({ ...base, lifetime: true, expiresAt: null, productId: 'lifetime' }, date)).toBe('Pro · lifetime');
    expect(statusLine(NO_PRO, date)).toBe('Not subscribed');
  });
});

describe('paywallOutcome', () => {
  it("maps RevenueCat's paywall results", () => {
    expect(paywallOutcome('PURCHASED')).toBe('purchased');
    expect(paywallOutcome('RESTORED')).toBe('restored');
    expect(paywallOutcome('NOT_PRESENTED')).toBe('not-needed');
    expect(paywallOutcome('ERROR')).toBe('error');
    expect(paywallOutcome('CANCELLED')).toBe('cancelled');
    expect(paywallOutcome('SOMETHING_NEW')).toBe('cancelled');
  });
});

describe('subscriptionsEnabled', () => {
  const base = { ios: true, switchOn: true, key: 'test_abc', devBuild: true, sellable: false };

  it('tells the keys apart', () => {
    expect(keyKind('test_abc')).toBe('test-store');
    expect(keyKind('appl_abc')).toBe('app-store');
    expect(keyKind('goog_abc')).toBe('other');
    expect(keyKind(null)).toBe('none');
  });

  it('lets a development build try the Test Store before anything is on sale', () => {
    expect(subscriptionsEnabled(base)).toBe(true);
  });

  it('never uses a Test Store key in a release build, which RevenueCat would crash', () => {
    expect(subscriptionsEnabled({ ...base, devBuild: false })).toBe(false);
    expect(subscriptionsEnabled({ ...base, devBuild: false, sellable: true })).toBe(false);
  });

  it('turns on with the App Store key only once there is something to sell', () => {
    expect(subscriptionsEnabled({ ...base, key: 'appl_abc', devBuild: false })).toBe(false);
    expect(subscriptionsEnabled({ ...base, key: 'appl_abc', devBuild: false, sellable: true })).toBe(true);
  });

  it('stays off without the switch, a key, or on Android', () => {
    expect(subscriptionsEnabled({ ...base, switchOn: false })).toBe(false);
    expect(subscriptionsEnabled({ ...base, key: null })).toBe(false);
    expect(subscriptionsEnabled({ ...base, ios: false })).toBe(false);
  });
});
