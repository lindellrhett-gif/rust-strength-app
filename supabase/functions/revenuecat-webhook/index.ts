/**
 * Keeps public.subscriptions in step with RevenueCat (migration 0026), so
 * server code can check Pro without trusting the phone.
 *
 * RevenueCat calls this on every subscription event, sending the
 * Authorization header set in its dashboard; any other request is refused.
 * The event body isn't trusted for the state itself: for each account it
 * names, this asks RevenueCat's API for the current record, so events
 * arriving late or out of order can't leave the wrong answer behind.
 *
 * Secrets (Supabase > Edge Functions > Secrets), never in the app:
 *   REVENUECAT_WEBHOOK_AUTH     the Authorization value set on the webhook
 *   REVENUECAT_SECRET_API_KEY   RevenueCat secret API key (v1)
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 *
 * Deploy with JWT verification off (RevenueCat has no Supabase login):
 *   supabase functions deploy revenuecat-webhook --no-verify-jwt
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { accountsInEvent, rowFromSubscriber, sameSecret } from '../_shared/subscriber.ts';

const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
const REVENUECAT_SECRET = Deno.env.get('REVENUECAT_SECRET_API_KEY');

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const reply = (status: number, body: string) => new Response(body, { status });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'Method not allowed');
  if (!WEBHOOK_AUTH || !REVENUECAT_SECRET) return reply(500, 'Not configured');
  if (!sameSecret(req.headers.get('Authorization') ?? '', WEBHOOK_AUTH)) return reply(401, 'Unauthorized');

  const body = await req.json().catch(() => null);

  for (const userId of accountsInEvent(body)) {
    // An account deleted since: nothing to mirror, and asking RevenueCat
    // about it would recreate the customer that deletion removed.
    const { data: found } = await admin.auth.admin.getUserById(userId);
    if (!found?.user) continue;

    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${REVENUECAT_SECRET}` },
    });
    // A non-2xx reply makes RevenueCat retry the event later.
    if (!res.ok) return reply(502, 'RevenueCat lookup failed');

    const row = rowFromSubscriber(userId, await res.json(), new Date());
    const { error } = await admin.from('subscriptions').upsert(row);
    if (error) return reply(500, 'Could not save');
  }

  return reply(200, 'ok');
});
