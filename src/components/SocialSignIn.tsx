import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
 * The two buttons match each other in this dark theme, each within its
 * provider's brand rules (see AppleButton and GoogleButton). Shows nothing on
 * a phone or build that offers neither.
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

/**
 * Apple's own button, in its black style: Apple allows only black, white or
 * white-outlined Sign in with Apple buttons, and black is the one that sits
 * in this dark theme. The outline matches Google's beside it. Loaded only once
 * SocialSignIn has confirmed the native code is in the build.
 */
function AppleButton({ onPress }: { onPress: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
  return (
    <View style={[styles.button, styles.outline, styles.apple]}>
      <Apple.AppleAuthenticationButton
        buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={radius.md}
        style={styles.fill}
        onPress={onPress}
      />
    </View>
  );
}

/**
 * Google's dark-theme button, drawn to Google's sign-in branding rules: its
 * standard four-colour G, "Continue with Google", and Google's dark fill and
 * outline colours. Drawn here rather than with the library's native button so
 * it can match Apple's in size and shape.
 */
function GoogleButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      style={({ pressed }) => [
        styles.button,
        styles.outline,
        styles.google,
        pressed && styles.googlePressed,
        disabled && styles.dimmed,
      ]}
    >
      <GoogleG />
      <Text style={styles.googleText}>Continue with Google</Text>
    </Pressable>
  );
}

/** Google's standard G, from its sign-in button artwork. */
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

// Google's dark theme: fill, outline and text.
const GOOGLE_FILL = '#131314';
const GOOGLE_OUTLINE = '#8E918F';
const GOOGLE_TEXT = '#E3E3E3';

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  button: { height: BUTTON_HEIGHT, width: '100%', borderRadius: radius.md },
  outline: { borderWidth: 1, borderColor: GOOGLE_OUTLINE, overflow: 'hidden' },
  apple: { backgroundColor: '#000000' },
  fill: { flex: 1 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: GOOGLE_FILL,
  },
  googlePressed: { backgroundColor: '#1F1F20' },
  googleText: { color: GOOGLE_TEXT, fontSize: 17, fontWeight: '600' },
  dimmed: { opacity: 0.6 },
  error: { color: colors.danger, fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
