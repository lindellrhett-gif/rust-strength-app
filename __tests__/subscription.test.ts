import { OPEN_ACCESS, PRO_FEATURES, hasFeature } from '../src/domain/entitlements';
import {
  NO_PRO,
  PRO_ENTITLEMENT,
  PRO_FEATURE_LIST,
  hasSellableFeatures,
  introLabel,
  priceLine,
  proStatusFrom,
  renewalTerms,
  statusLine,
  yearlySavings,
  type EntitlementLike,
  type Plan,
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

  it('lists every paid feature on the paywall', () => {
    expect(PRO_FEATURE_LIST.map((f) => f.feature).sort()).toEqual([...PRO_FEATURES].sort());
  });
});

describe('hasSellableFeatures', () => {
  it('sells nothing until a paid feature exists', () => {
    expect(hasSellableFeatures()).toBe(false);
    expect(hasSellableFeatures([{ ...PRO_FEATURE_LIST[0], available: true }])).toBe(true);
  });
});

describe('proStatusFrom', () => {
  const pro = (over: Partial<EntitlementLike> = {}): EntitlementLike => ({
    isActive: true,
    willRenew: true,
    periodType: 'NORMAL',
    expirationDate: '2027-10-03T12:00:00Z',
    productIdentifier: 'pro_yearly',
    ...over,
  });

  it('reads an active Pro entitlement', () => {
    expect(proStatusFrom({ entitlements: { active: { [PRO_ENTITLEMENT]: pro() } } })).toEqual({
      active: true,
      willRenew: true,
      trial: false,
      expiresAt: '2027-10-03T12:00:00Z',
      productId: 'pro_yearly',
    });
  });

  it('spots a free trial', () => {
    expect(proStatusFrom({ entitlements: { active: { pro: pro({ periodType: 'TRIAL' }) } } }).trial).toBe(true);
  });

  it('is not Pro without the entitlement, or before RevenueCat answers', () => {
    expect(proStatusFrom({ entitlements: { active: {} } })).toEqual(NO_PRO);
    expect(proStatusFrom({ entitlements: { active: { other: pro() } } })).toEqual(NO_PRO);
    expect(proStatusFrom(null)).toEqual(NO_PRO);
  });
});

describe('statusLine', () => {
  const date = (iso: string) => iso.slice(0, 10);
  const base = { ...NO_PRO, active: true, expiresAt: '2027-10-03T00:00:00Z', productId: 'p' };

  it('says when it renews, ends, or that the trial converts', () => {
    expect(statusLine({ ...base, willRenew: true }, date)).toBe('Pro · renews 2027-10-03');
    expect(statusLine({ ...base, willRenew: false }, date)).toBe('Pro · ends 2027-10-03');
    expect(statusLine({ ...base, willRenew: true, trial: true }, date)).toBe('Free trial · then renews 2027-10-03');
    expect(statusLine(NO_PRO, date)).toBe('Not subscribed');
  });
});

describe('yearlySavings', () => {
  it('rounds the saving down so it never overstates it', () => {
    // $5.99 x 12 = $71.88; $49.99 saves 30.45%.
    expect(yearlySavings(5.99, 49.99)).toBe(30);
  });

  it('claims nothing when yearly is no cheaper, or a price is missing', () => {
    expect(yearlySavings(5, 60)).toBeNull();
    expect(yearlySavings(5, 61)).toBeNull();
    expect(yearlySavings(0, 50)).toBeNull();
  });
});

describe('introLabel', () => {
  const offer = { price: 0, priceString: '$0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 };

  it('describes free trials and paid intro prices', () => {
    expect(introLabel(offer)).toBe('1-week free trial');
    expect(introLabel({ ...offer, periodUnit: 'DAY', periodNumberOfUnits: 7 })).toBe('7-day free trial');
    expect(introLabel({ ...offer, price: 0.99, priceString: '$0.99', periodUnit: 'MONTH', cycles: 3 })).toBe(
      '$0.99 a month for 3 months',
    );
    expect(
      introLabel({ ...offer, price: 2.99, priceString: '$2.99', periodUnit: 'MONTH', periodNumberOfUnits: 3 }),
    ).toBe('$2.99 for 3 months');
    expect(introLabel(null)).toBeNull();
  });
});

describe('renewal terms', () => {
  const yearly: Plan = { id: '$rc_annual', period: 'year', price: 49.99, priceString: '$49.99', intro: null };

  it('states the price, renewal, payment and how to cancel', () => {
    expect(priceLine(yearly)).toBe('$49.99 a year');
    const terms = renewalTerms(yearly);
    expect(terms).toMatch(/renews automatically at \$49\.99 a year until you cancel/);
    expect(terms).toMatch(/charged to your Apple ID when you confirm/);
    expect(terms).toMatch(/24 hours before/);
  });

  it('says payment comes after a free trial', () => {
    const trial = { ...yearly, intro: { price: 0, priceString: '$0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 } };
    expect(renewalTerms(trial)).toMatch(/when the free trial ends/);
  });
});
