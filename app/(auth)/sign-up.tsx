import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components';
import { Checkbox } from '@/components/Checkbox';
import { FrenchLegalLinks } from '@/components/FrenchLegalLinks';
import { SocialSignIn } from '@/components/SocialSignIn';
import { ageConfirmationLabel } from '@/domain/age';
import { HEALTH_CONSENT_LABEL } from '@/domain/consent';
import { EXISTING_ACCOUNT_MESSAGE, confirmErrorMessage } from '@/domain/emailConfirm';
import { LEGAL } from '@/legal/config';
import { deviceRegion } from '@/lib/deviceRegion';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, text } from '@/theme/typography';

export default function SignUp() {
  const { signUp, signIn } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The email already has an account: offer the way in instead of a new one.
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  // Three separate confirmations: an age gate (13+, or 16+ when the phone's
  // region is in the EEA; see src/domain/age.ts), acceptance of the documents,
  // and explicit consent to health information. All three are needed, and
  // the accepted version on the profile records them.
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [healthOk, setHealthOk] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setError(null);
    setNotice(null);
    setExisting(false);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!ageOk || !termsOk || !healthOk) {
      setError('Please confirm your age, accept the Terms and Privacy Policy, and give your consent.');
      return;
    }
    setBusy(true);
    let needsConfirmation = true;
    try {
      // Consent travels with the sign-up request and is saved when the account
      // is created, so it is on record even before the email is confirmed.
      const result = await signUp(email.trim(), password, {
        termsVersion: LEGAL.version,
        ageConfirmed: ageOk,
      });
      needsConfirmation = result.needsConfirmation;
      setSubmitted(true);
    } catch (e) {
      const message = confirmErrorMessage(e);
      setError(message);
      setExisting(message === EXISTING_ACCOUNT_MESSAGE);
      setBusy(false);
      return;
    }

    if (needsConfirmation) {
      // The code goes in on the next screen, which can also send a new one.
      router.replace({ pathname: '/(auth)/confirm-email', params: { email: email.trim() } });
      setBusy(false);
      return;
    }

    // Confirmation is switched off, so the account is usable now: sign in and
    // the (auth) layout redirects into the tabs once the session lands.
    try {
      await signIn(email.trim(), password);
    } catch {
      setNotice('Account created. Sign in to continue.');
    }
    setBusy(false);
  };

  return (
    <Screen scroll>
      {/* The scroll view insets itself for the keyboard; see keyboardAware. */}
      <View>
        <View style={styles.header}>
          <Text style={text.hero}>Create account</Text>
          <Text style={text.bodyMuted}>Track lifts across any gym, any machine.</Text>
        </View>

        {/* Age and Terms for these are asked right after, on the consent screen. */}
        <SocialSignIn style={styles.social} />

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {existing ? (
            <View style={styles.existing}>
              <Button
                label="Sign in"
                variant="secondary"
                onPress={() => router.replace('/(auth)/sign-in')}
                style={styles.flex}
              />
              <Button
                label="Reset password"
                variant="ghost"
                onPress={() =>
                  router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } })
                }
                style={styles.flex}
              />
            </View>
          ) : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Checkbox
            checked={ageOk}
            onToggle={() => setAgeOk((v) => !v)}
            label={ageConfirmationLabel(deviceRegion())}
          />
          <Checkbox
            checked={termsOk}
            onToggle={() => setTermsOk((v) => !v)}
            label="I agree to the Terms of Service and Privacy Policy"
          />
          <Checkbox
            checked={healthOk}
            onToggle={() => setHealthOk((v) => !v)}
            label={HEALTH_CONSENT_LABEL}
          />
          <View style={styles.legalLinks}>
            <Pressable onPress={() => router.push('/legal/terms')} hitSlop={6}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => router.push('/legal/privacy')} hitSlop={6}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
          </View>
          <FrenchLegalLinks />

          <Button
            label="Sign up"
            onPress={submit}
            loading={busy}
            size="lg"
            disabled={!ageOk || !termsOk || !healthOk}
          />
          {/* A sign-up that went through but left them here (confirmation off
              and the sign-in failed) still needs a way on. */}
          {submitted ? (
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: '/(auth)/confirm-email',
                  params: { email: email.trim() },
                })
              }
              hitSlop={8}
            >
              <Text style={styles.legalLink}>Enter the code we emailed</Text>
            </Pressable>
          ) : null}
        </View>

        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text style={text.bodyMuted}>Already have an account? </Text>
          <Text style={styles.linkAccent}>Sign in</Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legalLinks: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  legalLink: { color: '#4F8CFF', fontSize: 13, fontWeight: '700' },
  legalDot: { color: '#5E6B78' },
  header: { gap: spacing.xs, marginTop: spacing.xxl, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  social: { marginBottom: spacing.lg },
  error: { color: '#F26D6D', fontSize: 14 },
  existing: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  notice: { color: '#3ECf8e', fontSize: 14 },
  link: { marginTop: spacing.xl, textAlign: 'center' },
  linkAccent: { color: '#4F8CFF', fontWeight: '700' },
});
