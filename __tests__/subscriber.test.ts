import {
  accountsInEvent,
  isAccountId,
  rowFromSubscriber,
  sameSecret,
  type V1Subscriber,
} from '../supabase/functions/_shared/subscriber';

const ALICE = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const BOB = '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const NOW = new Date('2026-10-26T12:00:00Z');

describe('accountsInEvent', () => {
  it('names the customer and both sides of a transfer, once each', () => {
    const body = {
      event: {
        type: 'TRANSFER',
        app_user_id: ALICE,
        original_app_user_id: ALICE,
        transferred_from: [ALICE, '$RCAnonymousID:abc'],
        transferred_to: [BOB],
      },
    };
    expect(accountsInEvent(body)).toEqual([ALICE, BOB]);
  });

  it('ignores anonymous ids and malformed bodies', () => {
    expect(isAccountId('$RCAnonymousID:123')).toBe(false);
    expect(accountsInEvent({ event: { app_user_id: '$RCAnonymousID:1' } })).toEqual([]);
    expect(accountsInEvent(null)).toEqual([]);
    expect(accountsInEvent({})).toEqual([]);
  });
});

describe('rowFromSubscriber', () => {
  const subscriber = (over: Partial<NonNullable<V1Subscriber['subscriber']>> = {}): V1Subscriber => ({
    subscriber: {
      entitlements: {
        rust_strength_pro: { expires_date: '2027-10-26T12:00:00Z', grace_period_expires_date: null, product_identifier: 'yearly' },
      },
      subscriptions: {
        yearly: { period_type: 'normal', store: 'app_store', unsubscribe_detected_at: null, billing_issues_detected_at: null },
      },
      ...over,
    },
  });

  it('mirrors an active, renewing subscription', () => {
    expect(rowFromSubscriber(ALICE, subscriber(), NOW)).toEqual({
      user_id: ALICE,
      pro_active: true,
      product_id: 'yearly',
      period_type: 'NORMAL',
      store: 'app_store',
      expires_at: '2027-10-26T12:00:00Z',
      will_renew: true,
      updated_at: NOW.toISOString(),
    });
  });

  it('is not Pro once expired, and notices a cancellation', () => {
    const lapsed = subscriber({
      entitlements: { rust_strength_pro: { expires_date: '2026-10-01T00:00:00Z', product_identifier: 'yearly' } },
      subscriptions: { yearly: { period_type: 'normal', unsubscribe_detected_at: '2026-09-20T00:00:00Z' } },
    });
    const row = rowFromSubscriber(ALICE, lapsed, NOW);
    expect(row.pro_active).toBe(false);
    expect(row.will_renew).toBe(false);
  });

  it('keeps Pro through Apple’s billing grace period', () => {
    const grace = subscriber({
      entitlements: {
        rust_strength_pro: {
          expires_date: '2026-10-20T00:00:00Z',
          grace_period_expires_date: '2026-11-05T00:00:00Z',
          product_identifier: 'yearly',
        },
      },
      subscriptions: { yearly: { period_type: 'normal', billing_issues_detected_at: '2026-10-20T00:00:00Z' } },
    });
    const row = rowFromSubscriber(ALICE, grace, NOW);
    expect(row.pro_active).toBe(true);
    expect(row.expires_at).toBe('2026-11-05T00:00:00Z');
    expect(row.will_renew).toBe(false);
  });

  it('mirrors a lifetime purchase as Pro with no expiry', () => {
    const lifetime: V1Subscriber = {
      subscriber: {
        entitlements: { rust_strength_pro: { expires_date: null, product_identifier: 'lifetime' } },
        subscriptions: {},
        non_subscriptions: { lifetime: [{ store: 'app_store', purchase_date: '2026-10-25T00:00:00Z' }] },
      },
    };
    expect(rowFromSubscriber(ALICE, lifetime, NOW)).toMatchObject({
      pro_active: true,
      product_id: 'lifetime',
      period_type: 'LIFETIME',
      store: 'app_store',
      expires_at: null,
      will_renew: null,
    });
  });

  it('ignores an entitlement under any other name', () => {
    const other = rowFromSubscriber(
      ALICE,
      { subscriber: { entitlements: { pro: { expires_date: null, product_identifier: 'yearly' } } } },
      NOW,
    );
    expect(other.pro_active).toBe(false);
  });

  it('marks trials, and someone who never subscribed', () => {
    const trial = subscriber({
      subscriptions: { yearly: { period_type: 'trial', store: 'app_store' } },
    });
    expect(rowFromSubscriber(ALICE, trial, NOW).period_type).toBe('TRIAL');
    const never = rowFromSubscriber(BOB, { subscriber: { entitlements: {}, subscriptions: {} } }, NOW);
    expect(never).toMatchObject({ user_id: BOB, pro_active: false, product_id: null, expires_at: null });
  });
});

describe('sameSecret', () => {
  it('matches only the exact value', () => {
    expect(sameSecret('Bearer abc', 'Bearer abc')).toBe(true);
    expect(sameSecret('Bearer abd', 'Bearer abc')).toBe(false);
    expect(sameSecret('Bearer ab', 'Bearer abc')).toBe(false);
    expect(sameSecret('', 'Bearer abc')).toBe(false);
  });
});
