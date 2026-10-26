/**
 * Deletes the signed-in person's account once subscriptions are on: their
 * RevenueCat customer first (so its purchase records don't outlive the
 * account), then everything here through rpc_delete_my_account, called as
 * them so it runs exactly as it does from the app.
 *
 * Deleting the account doesn't cancel an Apple subscription; only the person
 * can, in their Apple ID settings. The app says so before they delete.
 *
 * Secrets: REVENUECAT_SECRET_API_KEY. SUPABASE_URL and SUPABASE_ANON_KEY are
 * provided by Supabase. Deploy normally (JWT verification on):
 *   supabase functions deploy delete-account
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const REVENUECAT_SECRET = Deno.env.get('REVENUECAT_SECRET_API_KEY');

const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, 'Method not allowed');
  const authorization = req.headers.get('Authorization');
  if (!authorization) return reply(401, 'Sign in again, then try deleting your account.');

  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return reply(401, 'Sign in again, then try deleting your account.');

  if (REVENUECAT_SECRET) {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(data.user.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${REVENUECAT_SECRET}` },
    });
    // 404: never subscribed, nothing to remove.
    if (!res.ok && res.status !== 404) {
      return reply(502, 'Couldn’t remove your purchase records. Nothing was deleted; please try again.');
    }
  }

  const { error: deleteError } = await asUser.rpc('rpc_delete_my_account');
  if (deleteError) return reply(500, 'Couldn’t delete your account. Please try again.');
  return reply(200, 'Deleted');
});
