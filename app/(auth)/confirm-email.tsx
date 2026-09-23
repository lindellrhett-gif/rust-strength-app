import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components';
import {
  RESEND_COOLDOWN_SECONDS,
  codeSentTo,
  confirmCodeProblem,
  confirmErrorMessage,
  normalizeCode,
  normalizeEmail,
} from '@/domain/emailConfirm';
import { looksLikeEmail } from '@/domain/passwordReset';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, text } from '@/theme/typography';

/**
 * Confirm a new account with the code from the email.
 *
 * Reached straight after signing up, and from the sign-in screen when an
 * unconfirmed account tries to sign in. Entering the code signs them in, so the
 * (auth) layout takes them into the app; nothing here navigates on success.
 */
export default function ConfirmEmail() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { confirmEmail, resendConfirmation } = useAuth();

  const [email, setEmail] = useState(emailParam ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(emailParam ? codeSentTo(emailParam) : null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(emailParam ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const submit = async () => {
    setError(null);
    setNotice(null);
    const problem = confirmCodeProblem(code);
    if (problem) {
      setError(problem);
      return;
    }
    if (!looksLikeEmail(email)) {
      setError('That email address does not look right.');
      return;
    }
    setBusy(true);
    try {
      await confirmEmail(normalizeEmail(email), normalizeCode(code));
      // The session lands and the layout redirects; leave the button spinning
      // rather than flashing an empty form in between.
    } catch (e) {
      setError(confirmErrorMessage(e));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    if (!looksLikeEmail(email)) {
      setError('Enter the email you signed up with.');
      return;
    }
    setResending(true);
    try {
      await resendConfirmation(normalizeEmail(email));
      setNotice(codeSentTo(email));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(confirmErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Confirm your email' }} />
      <View style={styles.header}>
        <Text style={text.hero}>Confirm your email</Text>
        <Text style={text.bodyMuted}>
          Enter the 6-digit code from the email to finish setting up your account.
        </Text>
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
          label="Code"
          value={code}
          onChangeText={(t) => setCode(normalizeCode(t))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          maxLength={10}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Button label="Confirm email" onPress={submit} loading={busy} size="lg" />
        <Button
          label={cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
          variant="secondary"
          onPress={resend}
          loading={resending}
          disabled={cooldown > 0}
        />

        <Text style={text.caption}>
          Signed up with the wrong address? Change it above and send a new code, or create the
          account again with the right one.
        </Text>
      </View>

      <Pressable onPress={() => router.replace('/(auth)/sign-in')} hitSlop={8} style={styles.link}>
        <Text style={styles.linkAccent}>Back to sign in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xxl, marginBottom: spacing.md },
  form: { gap: spacing.lg },
  error: { color: '#F26D6D', fontSize: 14 },
  notice: { color: '#3ECf8e', fontSize: 14 },
  link: { marginTop: spacing.xl, alignSelf: 'center' },
  linkAccent: { color: '#4F8CFF', fontWeight: '700' },
});
