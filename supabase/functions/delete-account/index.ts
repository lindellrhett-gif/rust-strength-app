/**
 * Deletes the signed-in person's account, in this order, stopping with
 * nothing deleted if a step fails:
 *
 *  1. Sign in with Apple, if the account uses it. Apple requires an app to
 *     revoke its tokens when such an account is deleted. The app sends a
 *     fresh one-time code from Apple (appleAuthorizationCode, with the
 *     appleClientId it was issued to); this trades it for the app's tokens
 *     and revokes them straight away, so no Apple token is ever stored.
 *  2. Their RevenueCat customer, once subscriptions are on, so its purchase
 *     records don't outlive the account.
 *  3. Everything here, through rpc_delete_my_account, called as them so it
 *     runs exactly as it does from the app.
 *
 * Deleting the account doesn't cancel an Apple subscription; only the person
 * can, in their Apple ID settings. The app says so before they delete.
 *
 * Secrets: REVENUECAT_SECRET_API_KEY (once subscriptions are on), and for
 * Sign in with Apple APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY (the
 * Sign in with Apple key's .p8 file, pasted whole). SUPABASE_URL and
 * SUPABASE_ANON_KEY are provided by Supabase. Deploy normally (JWT
 * verification on):
 *   supabase functions deploy delete-account
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

import {
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  appleAccountId,
  clientSecretClaims,
  idTokenSubject,
  isAppleClientId,
  revokeRequestBody,
  tokenRequestBody,
} from '../_shared/apple.ts';

const REVENUECAT_SECRET = Deno.env.get('REVENUECAT_SECRET_API_KEY');
const APPLE_TEAM_ID = Deno.env.get('APPLE_TEAM_ID');
const APPLE_KEY_ID = Deno.env.get('APPLE_KEY_ID');
// A key pasted with its line breaks written as \n still reads as the key.
const APPLE_PRIVATE_KEY = Deno.env.get('APPLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });

const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };
const APPLE_FAILED = 'Couldn’t disconnect Sign in with Apple. Nothing was deleted; please try again.';

/** A client secret for Apple's token endpoints, made fresh for this request. */
async function appleClientSecret(clientId: string): Promise<string> {
  const key = await importPKCS8(APPLE_PRIVATE_KEY!, 'ES256');
  return new SignJWT(clientSecretClaims(APPLE_TEAM_ID!, clientId, Math.floor(Date.now() / 1000)))
    .setProtectedHeader({ alg: 'ES256', kid: APPLE_KEY_ID! })
    .sign(key);
}

/** Revokes the app's Apple tokens for this account. Returns what went wrong, or null when done. */
async function revokeApple(accountId: string, code: unknown, clientId: unknown): Promise<string | null> {
  if (typeof code !== 'string' || !code || !isAppleClientId(clientId)) {
    return 'Confirm with Apple to delete this account. Nothing was deleted.';
  }
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    return 'Couldn’t disconnect Sign in with Apple. Nothing was deleted; please email us.';
  }
  const secret = await appleClientSecret(clientId);

  const tokenRes = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: FORM,
    body: tokenRequestBody(clientId, secret, code),
  });
  if (!tokenRes.ok) return 'Apple didn’t accept the confirmation. Nothing was deleted; please try again.';
  const tokens = (await tokenRes.json()) as { refresh_token?: string; id_token?: string };
  // The code must come from the Apple ID on this account, not another one.
  if (idTokenSubject(tokens.id_token) !== accountId) {
    return 'That Apple ID isn’t the one on this account. Nothing was deleted.';
  }
  if (!tokens.refresh_token) return APPLE_FAILED;

  const revokeRes = await fetch(APPLE_REVOKE_URL, {
    method: 'POST',
    headers: FORM,
    body: revokeRequestBody(clientId, secret, tokens.refresh_token),
  });
  return revokeRes.ok ? null : APPLE_FAILED;
}

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

  const appleId = appleAccountId(data.user);
  if (appleId) {
    const body = (await req.json().catch(() => ({}))) as {
      appleAuthorizationCode?: unknown;
      appleClientId?: unknown;
    };
    const problem = await revokeApple(appleId, body.appleAuthorizationCode, body.appleClientId).catch(
      () => APPLE_FAILED,
    );
    if (problem) return reply(400, problem);
  }

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
