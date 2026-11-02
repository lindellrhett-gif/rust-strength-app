import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { socialSignInMessage, type SocialProvider } from '@/domain/socialAuth';
import { appleSignInAvailable, googleSignInAvailable } from '@/lib/socialSignIn';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

const BUTTON_HEIGHT = 48;

/**
 * Sign in with Apple and Google, above the email form on the sign-in and
 * create-account screens. The same buttons do both: a first sign-in creates
 * the account, and the consent screen then asks for the age and Terms
 * confirmations before the app opens.
 *
 * Both buttons are the providers' own (Apple's and Google's native buttons),
 * which is what their brand rules ask for. Shows nothing on a phone or build
 * that offers neither.
 */
export function SocialSignIn({ style }: { style?: StyleProp<ViewStyle> }) {
  const { signInWith } = useAuth();
  const [apple, setApple] = useState(false);
  const [google] = useState(googleSignInAvailable);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void appleSignInAvailable().then((ok) => live && setApple(ok));
    return () => {
      live = false;
    };
  }, []);

  if (!apple && !google) return null;

  const go = async (provider: SocialProvider) => {
    if (busy) return;
    setError(null);
    setBusy(provider);
    try {
      // The (auth) layout takes over once the session lands.
      await signInWith(provider);
    } catch (e) {
      setError(socialSignInMessage(e, provider));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      {apple ? <AppleButton onPress={() => void go('apple')} /> : null}
      {google ? <GoogleButton onPress={() => void go('google')} disabled={busy != null} /> : null}
      {busy ? (
        <Text style={text.caption}>Signing in with {busy === 'apple' ? 'Apple' : 'Google'}…</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.divider} accessible accessibilityLabel="Or use your email">
        <View style={styles.line} />
        <Text style={text.caption}>or use your email</Text>
        <View style={styles.line} />
      </View>
    </View>
  );
}

// Loaded only once SocialSignIn has confirmed the native code is in the build.

function AppleButton({ onPress }: { onPress: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
  return (
    <Apple.AppleAuthenticationButton
      buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={Apple.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={radius.md}
      style={styles.button}
      onPress={onPress}
    />
  );
}

function GoogleButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSigninButton } = require('@react-native-google-signin/google-signin') as typeof import(
    '@react-native-google-signin/google-signin'
  );
  return (
    <GoogleSigninButton
      size={GoogleSigninButton.Size.Wide}
      color={GoogleSigninButton.Color.Light}
      style={styles.button}
      onPress={onPress}
      disabled={disabled}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  button: { height: BUTTON_HEIGHT, width: '100%' },
  error: { color: colors.danger, fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
