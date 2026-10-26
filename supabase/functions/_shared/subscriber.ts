/**
 * Turning RevenueCat's records into rows for public.subscriptions. Plain
 * TypeScript with no Deno APIs, so Jest tests it (__tests__/subscriber.test.ts)
 * and both Edge Functions share it.
 */

/** The entitlement Pro's products grant (src/domain/subscription.ts). */
export const PRO_ENTITLEMENT = 'pro';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RevenueCat customer ids are account ids; anything else (anonymous ids) is ignored. */
export function isAccountId(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

/**
 * The accounts a webhook event is about: the customer, plus both sides of a
 * transfer (a purchase restored onto another account moves Pro between them).
 */
export function accountsInEvent(body: unknown): string[] {
  const event = (body as { event?: Record<string, unknown> } | null)?.event;
  if (!event) return [];
  const ids = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
  ];
  return [...new Set(ids.filter(isAccountId))];
}

interface V1Entitlement {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string;
}

interface V1Subscription {
  period_type?: string;
  store?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
}

/** The part of GET /v1/subscribers/{id} that matters here. */
export interface V1Subscriber {
  subscriber?: {
    entitlements?: Record<string, V1Entitlement | undefined>;
    subscriptions?: Record<string, V1Subscription | undefined>;
  };
}

export interface SubscriptionRow {
  user_id: string;
  pro_active: boolean;
  product_id: string | null;
  period_type: string | null;
  store: string | null;
  expires_at: string | null;
  will_renew: boolean | null;
  updated_at: string;
}

function later(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/**
 * Pro is active while the entitlement hasn't expired, counting Apple's
 * billing grace period, during which the person keeps access while Apple
 * retries a failed payment.
 */
export function rowFromSubscriber(userId: string, data: V1Subscriber, now: Date): SubscriptionRow {
  const ent = data.subscriber?.entitlements?.[PRO_ENTITLEMENT];
  const productId = ent?.product_identifier ?? null;
  const sub = productId ? data.subscriber?.subscriptions?.[productId] : undefined;
  const expiresAt = ent ? later(ent.expires_date, ent.grace_period_expires_date) : null;
  const active = !!ent && (expiresAt == null || new Date(expiresAt) > now);
  return {
    user_id: userId,
    pro_active: active,
    product_id: productId,
    period_type: sub?.period_type ? sub.period_type.toUpperCase() : null,
    store: sub?.store ?? null,
    expires_at: expiresAt,
    will_renew: sub ? sub.unsubscribe_detected_at == null && sub.billing_issues_detected_at == null : null,
    updated_at: now.toISOString(),
  };
}

/** Constant-time comparison for the webhook's shared secret. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
