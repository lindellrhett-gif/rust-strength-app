import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components';
import { Checkbox } from '@/components/Checkbox';
import { confirmErrorMessage } from '@/domain/emailConfirm';
import { LEGAL } from '@/legal/config';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, text } from '@/theme/typography';

export default function SignUp() {
  const { signUp, signIn } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Two separate confirmations: an age gate (13+) and acceptance of the
  // documents. Both are recorded on the profile when the account is created.
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!ageOk || !termsOk) {
      setError('Please confirm your age and accept the Terms and Privacy Policy.');
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
      setError(confirmErrorMessage(e));
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
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Checkbox
            checked={ageOk}
            onToggle={() => setAgeOk((v) => !v)}
            label={`I am at least ${LEGAL.minimumAge} years old`}
          />
          <Checkbox
            checked={termsOk}
            onToggle={() => setTermsOk((v) => !v)}
            label="I agree to the Terms of Service and Privacy Policy"
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

          <Button
            label="Sign up"
            onPress={submit}
            loading={busy}
            size="lg"
            disabled={!ageOk || !termsOk}
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
  error: { color: '#F26D6D', fontSize: 14 },
  notice: { color: '#3ECf8e', fontSize: 14 },
  link: { marginTop: spacing.xl, textAlign: 'center' },
  linkAccent: { color: '#4F8CFF', fontWeight: '700' },
});
