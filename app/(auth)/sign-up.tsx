import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components';
import { useAcceptTerms } from '@/data/privacy';
import { LEGAL } from '@/legal/config';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, text } from '@/theme/typography';

export default function SignUp() {
  const { signUp, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Two separate confirmations: an age gate (13+) and acceptance of the
  // documents. Both are recorded on the profile after sign-up.
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const router = useRouter();
  const acceptTerms = useAcceptTerms();

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
    try {
      await signUp(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account.');
      setBusy(false);
      return;
    }

    // If email confirmation is off we can sign straight in, and the (auth)
    // layout redirects into the tabs once the session lands.
    try {
      await signIn(email.trim(), password);
    } catch {
      setNotice('Account created. Check your email to confirm, then sign in.');
      setBusy(false);
      return;
    }

    // Stamp the profile now that there is a session; the trigger has already
    // created the row. Kept in its own block: a failure here means the consent
    // record did not save, which is not the same thing as needing to confirm an
    // email, and telling someone to check their inbox when they are already
    // signed in sends them nowhere.
    try {
      await acceptTerms.mutateAsync();
    } catch {
      setNotice('Signed in. We could not save your acceptance — please reopen the app.');
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
        </View>

        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text style={text.bodyMuted}>Already have an account? </Text>
          <Text style={styles.linkAccent}>Sign in</Text>
        </Link>
      </View>
    </Screen>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkRow}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#2A323C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: '#4F8CFF', borderColor: '#4F8CFF' },
  checkMark: { color: '#0B0D10', fontSize: 14, fontWeight: '900' },
  checkLabel: { color: '#9AA7B4', fontSize: 14, flexShrink: 1 },
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
