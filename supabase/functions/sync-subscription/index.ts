/**
 * Brings the signed-in person's row in public.subscriptions up to date now,
 * instead of waiting for RevenueCat's webhook.
 *
 * Migration 0039 has the server, not only the app, refuse food diary saves
 * without Pro. The webhook usually lands within seconds of a purchase, but
 * the app unlocks the diary at once, so the first entries after buying could
 * otherwise be refused. The app calls this after a purchase or restore, and
 * once a session when RevenueCat says the person has Pro.
 *
 * It only ever updates the caller's own row, and the state comes from
 * RevenueCat's API, never from the request, so calling it can't grant Pro.
 *
 * Secrets: REVENUECAT_SECRET_API_KEY (the same one the webhook uses).
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
 * by Supabase. Deploy normally (JWT verification on):
 *   supabase functions deploy sync-subscription
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { rowFromSubscriber } from '../_shared/subscriber.ts';

const REVENUECAT_SECRET = Deno.env.get('REVENUECAT_SECRET_API_KEY');

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { message: 'Method not allowed' });
  if (!REVENUECAT_SECRET) return reply(500, { message: 'Not configured' });
  const authorization = req.headers.get('Authorization');
  if (!authorization) return reply(401, { message: 'Sign in again.' });

  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return reply(401, { message: 'Sign in again.' });
  const userId = data.user.id;

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${REVENUECAT_SECRET}` },
  });
  if (!res.ok) return reply(502, { message: 'RevenueCat lookup failed' });

  const row = rowFromSubscriber(userId, await res.json(), new Date());
  const { error: saveError } = await admin.from('subscriptions').upsert(row);
  if (saveError) return reply(500, { message: 'Could not save' });

  return reply(200, { pro: row.pro_active });
});
