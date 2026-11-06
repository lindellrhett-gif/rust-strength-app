/**
 * The native Sign in with Apple and Google sheets, each giving back an ID
 * token that Supabase turns into a session (AuthProvider.signInWith).
 *
 * Both libraries demand their native code the moment they are imported, so,
 * as in deviceUnits.ts, they are only loaded once the native code is known
 * to be in this build. A build without it simply doesn't offer the button.
 *
 * Google is offered only when the build has a Google iOS client id for this
 * app (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, or ..._DEV for the dev app);
 * app.config.js adds Google's native setup in the same case. Neither library
 * is told anything but what it needs to sign the person in: Apple is asked
 * for the email address only, never the name.
 */
import { requireOptionalNativeModule } from 'expo';
import { applicationId } from 'expo-application';
import Constants from 'expo-constants';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { Platform, TurboModuleRegistry } from 'react-native';

import { env } from './env';

/**
 * This app's bundle id, read from the phone: com.ruststrength.app, or
 * com.ruststrength.app.dev for the dev app. Not from the app config, which in
 * the dev app comes from the dev server and names the real app.
 */
export function appBundleId(): string | null {
  return applicationId ?? Constants.expoConfig?.ios?.bundleIdentifier ?? null;
}

/** Google's client id for this app: the real app and the dev app each have their own. */
function googleClientId(): string | null {
  const id = appBundleId()?.endsWith('.dev') ? env.googleIosClientIdDev : env.googleIosClientId;
  return id?.endsWith('.apps.googleusercontent.com') ? id : null;
}

/** The person closed the sheet; nothing to report. */
export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SignInCancelled';
  }
}

type AppleModule = typeof import('expo-apple-authentication');
type GoogleModule = typeof import('@react-native-google-signin/google-signin');

function apple(): AppleModule | null {
  if (Platform.OS !== 'ios' || requireOptionalNativeModule('ExpoAppleAuthentication') == null) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-apple-authentication') as AppleModule;
}

const isAppleCancel = (e: unknown) => (e as { code?: unknown } | null)?.code === 'ERR_REQUEST_CANCELED';

/** Whether this phone can show Sign in with Apple. */
export async function appleSignInAvailable(): Promise<boolean> {
  const Apple = apple();
  return Apple ? Apple.isAvailableAsync().catch(() => false) : false;
}

/**
 * Shows Sign in with Apple and returns its token with the nonce it was made
 * for. Apple only sees the nonce's hash; Supabase gets the nonce itself and
 * checks the two match, so a token caught in transit can't be reused.
 */
export async function appleIdToken(): Promise<{ token: string; nonce: string }> {
  const Apple = apple();
  if (!Apple) throw new Error('Sign in with Apple is not available on this phone.');
  const nonce = randomUUID();
  const hashed = await digestStringAsync(CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credential = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!credential.identityToken) throw new Error('Apple did not return a sign-in token.');
    return { token: credential.identityToken, nonce };
  } catch (e) {
    if (isAppleCancel(e)) throw new SignInCancelled();
    throw e;
  }
}

/**
 * A fresh one-time code from Apple, which the delete-account function trades
 * for the app's Apple tokens and revokes, as Apple requires when an account
 * that uses Sign in with Apple is deleted. Asks nothing new of the person.
 */
export async function appleAuthorizationCode(): Promise<string> {
  const Apple = apple();
  if (!Apple) throw new Error('Sign in with Apple is not available on this phone.');
  try {
    const credential = await Apple.signInAsync({ requestedScopes: [] });
    if (!credential.authorizationCode) throw new Error('Apple did not return a code.');
    return credential.authorizationCode;
  } catch (e) {
    if (isAppleCancel(e)) throw new SignInCancelled();
    throw e;
  }
}

let googleConfigured = false;

function google(): GoogleModule | null {
  const clientId = googleClientId();
  if (Platform.OS !== 'ios' || !clientId) return null;
  if (TurboModuleRegistry.get('RNGoogleSignin') == null) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('@react-native-google-signin/google-signin') as GoogleModule;
  if (!googleConfigured) {
    // No web client: the token is issued to the iOS client, whose id Supabase
    // lists among the Google client ids it accepts.
    module.GoogleSignin.configure({ iosClientId: clientId });
    googleConfigured = true;
  }
  return module;
}

/** Whether this build can show Sign in with Google. */
export function googleSignInAvailable(): boolean {
  try {
    return google() != null;
  } catch {
    return false;
  }
}

/** Shows Google's account picker and returns its ID token. */
export async function googleIdToken(): Promise<string> {
  const Google = google();
  if (!Google) throw new Error('Sign in with Google is not available in this build.');
  const { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } = Google;
  try {
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) throw new SignInCancelled();
    if (!response.data.idToken) throw new Error('Google did not return a sign-in token.');
    return response.data.idToken;
  } catch (e) {
    if (e instanceof SignInCancelled) throw e;
    // A second tap while the sheet is still opening counts as nothing.
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      throw new SignInCancelled();
    }
    throw e;
  }
}

/** Forgets the Google account on this phone, so the next person gets the picker. */
export async function googleSignOut(): Promise<void> {
  try {
    await google()?.GoogleSignin.signOut();
  } catch {
    // Nothing to forget, or Google's library is unavailable: either way done.
  }
}
